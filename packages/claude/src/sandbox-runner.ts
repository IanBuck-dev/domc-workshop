import {
  lstat,
  mkdir,
  mkdtemp,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { createHash } from "node:crypto";
import { basename, join, relative, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import type { ZodType } from "zod";
import type {
  AiModelConfig,
  AiOperationResult,
  AiTrace,
  SelectedUpload,
} from "./assessment-ai-contracts.ts";

const NO_NETWORK_TOOLS = ["WebFetch", "WebSearch", "Task", "NotebookEdit"];
const TOOL_NAMES = ["Read", "Glob", "Bash"] as const;

export interface SandboxOperation<T> {
  assessmentId: string;
  operationName: string;
  prompt: string;
  systemPrompt: string;
  responseSchema: ZodType<T>;
  responseJsonSchema: object;
  model: AiModelConfig;
  tools: "none" | "workspace";
  selectedUploads?: SelectedUpload[];
  sessionId?: string;
  signal?: AbortSignal;
}

export interface SandboxTransportRequest {
  command: string[];
  cwd: string;
  env: Record<string, string | undefined>;
  stdin: string;
  timeoutMs: number;
  maxOutputBytes: number;
  signal?: AbortSignal;
}

export interface SandboxTransportResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  sandboxed: boolean;
}

export interface SandboxRunnerOptions {
  tempRoot?: string;
  uploadRoot?: string;
  claudeCommand?: string;
  sandboxCommand?: string;
  sandboxSettingsTemplate?: string;
  allowUnsafeLocalFallback?: boolean;
  transport?: (
    request: SandboxTransportRequest,
  ) => Promise<SandboxTransportResult>;
}

class FifoQueue {
  private tail: Promise<void> = Promise.resolve();

  async run<T>(
    signal: AbortSignal | undefined,
    task: () => Promise<T>,
  ): Promise<T> {
    let release!: () => void;
    const previous = this.tail;
    this.tail = new Promise<void>((resolvePromise) => {
      release = resolvePromise;
    });
    try {
      await waitForTurn(previous, signal);
      if (signal?.aborted) throw abortError();
      return await task();
    } finally {
      release();
    }
  }
}

const globalAiQueue = new FifoQueue();

export interface AiOperationStatus {
  operationId: string;
  assessmentId: string;
  operationName: string;
  state: "queued" | "running";
  position: number;
  createdAt: string;
}

interface ManagedAiOperation extends Omit<AiOperationStatus, "position"> {
  controller: AbortController;
}

const managedAiOperations = new Map<string, ManagedAiOperation>();

export function listAiOperations(): AiOperationStatus[] {
  let queuedPosition = 0;
  return [...managedAiOperations.values()].map((operation) => ({
    operationId: operation.operationId,
    assessmentId: operation.assessmentId,
    operationName: operation.operationName,
    state: operation.state,
    position: operation.state === "running" ? 0 : ++queuedPosition,
    createdAt: operation.createdAt,
  }));
}

export function cancelAiOperation(operationId: string) {
  const operation = managedAiOperations.get(operationId);
  if (!operation) return false;
  operation.controller.abort();
  return true;
}

function abortError() {
  return new DOMException("AI operation cancelled.", "AbortError");
}

async function waitForTurn(previous: Promise<void>, signal?: AbortSignal) {
  if (!signal) return previous;
  if (signal.aborted) throw abortError();
  await Promise.race([
    previous,
    new Promise<never>((_, reject) =>
      signal.addEventListener("abort", () => reject(abortError()), {
        once: true,
      }),
    ),
  ]);
}

function sanitizeFileName(name: string) {
  const safe = basename(name)
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}._-]+/gu, "-")
    .replace(/^[-.]+/, "")
    .slice(0, 120);
  return safe || "upload";
}

function isWithin(root: string, target: string) {
  const pathFromRoot = relative(root, target);
  return (
    pathFromRoot === "" ||
    (!pathFromRoot.startsWith(`..${sep}`) && pathFromRoot !== "..")
  );
}

async function readStreamBounded(
  stream: ReadableStream<Uint8Array>,
  maximumBytes: number,
  onLimit: () => void,
) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let result = "";
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    bytes += chunk.value.byteLength;
    if (bytes > maximumBytes) {
      onLimit();
      throw new Error("Claude output exceeded the configured safe limit.");
    }
    result += decoder.decode(chunk.value, { stream: true });
  }
  return result + decoder.decode();
}

async function executableExists(command: string) {
  const check = Bun.spawn(
    ["sh", "-c", 'command -v "$1" >/dev/null 2>&1', "sh", command],
    {
      stdout: "ignore",
      stderr: "ignore",
    },
  );
  return (await check.exited) === 0;
}

async function sandboxRuntimeAvailable(command: string) {
  if (!(await executableExists(command))) return false;
  if (process.platform !== "linux") return true;
  return (await executableExists("bwrap")) && (await executableExists("socat"));
}

function childEnvironment(operationDir: string) {
  const allowed: Record<string, string | undefined> = {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    USER: process.env.USER,
    LOGNAME: process.env.LOGNAME,
    LANG: process.env.LANG ?? "C.UTF-8",
    LC_ALL: process.env.LC_ALL,
    TMPDIR: operationDir,
    CLAUDE_CONFIG_DIR: process.env.CLAUDE_CONFIG_DIR,
    XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME,
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
    CLAUDE_CODE_SAFE_MODE: "1",
  };
  return allowed;
}

function claudeCompatibleSchema(schema: object) {
  const value = structuredClone(schema) as Record<string, unknown>;
  delete value.$schema;
  return value;
}

function validateSandboxSettings(value: unknown) {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error("Invalid sandbox settings file.");
  const record = value as Record<string, unknown>;
  const network = record.network as Record<string, unknown> | undefined;
  const filesystem = record.filesystem as Record<string, unknown> | undefined;
  if (
    !network ||
    !filesystem ||
    !Array.isArray(network.allowedDomains) ||
    network.allowLocalBinding !== false ||
    !Array.isArray(filesystem.denyRead) ||
    !Array.isArray(filesystem.allowRead) ||
    !Array.isArray(filesystem.allowWrite) ||
    !Array.isArray(filesystem.denyWrite)
  )
    throw new Error("Invalid sandbox settings file.");
  return value as object;
}

async function defaultTransport(
  request: SandboxTransportRequest,
): Promise<SandboxTransportResult> {
  const proc = Bun.spawn(request.command, {
    cwd: request.cwd,
    env: request.env,
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
  });
  const timeout = setTimeout(() => proc.kill("SIGKILL"), request.timeoutMs);
  const cancel = () => proc.kill("SIGKILL");
  request.signal?.addEventListener("abort", cancel, { once: true });
  if (request.signal?.aborted) cancel();
  proc.stdin.write(request.stdin);
  proc.stdin.end();
  try {
    const [stdout, stderr, exitCode] = await Promise.all([
      readStreamBounded(proc.stdout, request.maxOutputBytes, cancel),
      readStreamBounded(proc.stderr, 32_000, cancel),
      proc.exited,
    ]);
    if (request.signal?.aborted) throw abortError();
    return {
      stdout,
      stderr,
      exitCode,
      sandboxed: request.command[0] === "srt",
    };
  } finally {
    clearTimeout(timeout);
    request.signal?.removeEventListener("abort", cancel);
  }
}

export class SandboxRunner {
  private readonly options: Required<
    Pick<
      SandboxRunnerOptions,
      | "tempRoot"
      | "claudeCommand"
      | "sandboxCommand"
      | "allowUnsafeLocalFallback"
    >
  > &
    Omit<
      SandboxRunnerOptions,
      | "tempRoot"
      | "claudeCommand"
      | "sandboxCommand"
      | "allowUnsafeLocalFallback"
    >;

  constructor(options: SandboxRunnerOptions = {}) {
    this.options = {
      ...options,
      tempRoot: options.tempRoot ?? join(tmpdir(), "claims-ai-operations"),
      uploadRoot: options.uploadRoot ?? process.env.AI_UPLOAD_ROOT,
      claudeCommand: options.claudeCommand ?? "claude",
      sandboxCommand: options.sandboxCommand ?? "srt",
      sandboxSettingsTemplate:
        options.sandboxSettingsTemplate ?? process.env.AI_SANDBOX_SETTINGS,
      allowUnsafeLocalFallback:
        options.allowUnsafeLocalFallback ??
        process.env.NODE_ENV !== "production",
    };
  }

  runStructured<T>(
    operation: SandboxOperation<T>,
  ): Promise<AiOperationResult<T>> {
    const operationId = crypto.randomUUID();
    const controller = new AbortController();
    const signal = operation.signal
      ? AbortSignal.any([operation.signal, controller.signal])
      : controller.signal;
    managedAiOperations.set(operationId, {
      operationId,
      assessmentId: operation.assessmentId,
      operationName: operation.operationName,
      state: "queued",
      createdAt: new Date().toISOString(),
      controller,
    });
    return globalAiQueue
      .run(signal, () => {
        const managed = managedAiOperations.get(operationId);
        if (managed) managed.state = "running";
        return this.execute({ ...operation, signal }, operationId);
      })
      .finally(() => managedAiOperations.delete(operationId));
  }

  private async execute<T>(
    operation: SandboxOperation<T>,
    operationId: string,
  ): Promise<AiOperationResult<T>> {
    const startedAt = performance.now();
    const logicalSessionId = operation.sessionId ?? crypto.randomUUID();
    await mkdir(this.options.tempRoot, { recursive: true, mode: 0o700 });
    const operationDir = await mkdtemp(
      join(this.options.tempRoot, `${operationId}-`),
    );
    try {
      const uploads = await this.stageUploads(
        operationDir,
        operation.selectedUploads ?? [],
      );
      const prompt = `${operation.prompt}\n\n## Verfügbare Dateien\n${
        uploads.length
          ? uploads.map((name) => `- uploads/${name}`).join("\n")
          : "Keine ausgewählten Dateien."
      }`;
      const promptPath = join(operationDir, "operation-prompt.md");
      const schemaPath = join(operationDir, "response-schema.json");
      const responseSchema = claudeCompatibleSchema(
        operation.responseJsonSchema,
      );
      await Promise.all([
        writeFile(promptPath, prompt, { encoding: "utf8", mode: 0o600 }),
        writeFile(schemaPath, JSON.stringify(responseSchema, null, 2), {
          encoding: "utf8",
          mode: 0o600,
        }),
      ]);
      const { command, sandboxed } = await this.buildCommand(
        operation,
        operationDir,
        responseSchema,
      );
      if (operation.signal?.aborted) throw abortError();
      const transport = this.options.transport ?? defaultTransport;
      const result = await transport({
        command,
        cwd: operationDir,
        env: childEnvironment(operationDir),
        stdin: `${prompt}\n\nGib ausschließlich das strukturierte Ergebnis gemäß response-schema.json aus.`,
        timeoutMs: operation.model.timeoutMs,
        maxOutputBytes: Math.max(64_000, operation.model.maxOutputTokens * 16),
        signal: operation.signal,
      });
      if (result.exitCode !== 0)
        throw new Error(
          `Claude operation failed (${result.exitCode}): ${(
            result.stderr || result.stdout
          ).slice(0, 500)}`,
        );
      const envelope = JSON.parse(result.stdout) as Record<string, unknown>;
      const raw =
        envelope.structured_output ??
        (typeof envelope.result === "string"
          ? JSON.parse(envelope.result)
          : (envelope.result ?? envelope));
      const value = operation.responseSchema.parse(raw);
      const usage =
        typeof envelope.usage === "object" && envelope.usage !== null
          ? (envelope.usage as Record<string, unknown>)
          : {};
      const trace: AiTrace = {
        operationId,
        sessionId: logicalSessionId,
        model: operation.model.model,
        durationMs: Math.round(performance.now() - startedAt),
        inputTokens:
          typeof usage.input_tokens === "number" ? usage.input_tokens : null,
        outputTokens:
          typeof usage.output_tokens === "number" ? usage.output_tokens : null,
        sandboxed: result.sandboxed || sandboxed,
      };
      return { value, trace };
    } finally {
      await rm(operationDir, { recursive: true, force: true });
    }
  }

  private async stageUploads(operationDir: string, uploads: SelectedUpload[]) {
    if (!uploads.length) return [];
    const uploadDir = join(operationDir, "uploads");
    await mkdir(uploadDir, { recursive: true, mode: 0o700 });
    const configuredRoot = this.options.uploadRoot
      ? await realpath(resolve(this.options.uploadRoot))
      : null;
    const names: string[] = [];
    for (const upload of uploads) {
      const stat = await lstat(upload.path);
      if (!stat.isFile() || stat.isSymbolicLink())
        throw new Error(`Upload is not a regular file: ${upload.name}`);
      const source = await realpath(upload.path);
      if (configuredRoot && !isWithin(configuredRoot, source))
        throw new Error(
          `Upload is outside the configured assessment workspace: ${upload.name}`,
        );
      if (!configuredRoot && process.env.NODE_ENV === "production")
        throw new Error("AI_UPLOAD_ROOT must be configured in production.");
      const bytes = new Uint8Array(await Bun.file(source).arrayBuffer());
      const sha256 = createHash("sha256").update(bytes).digest("hex");
      if (bytes.byteLength !== upload.size || sha256 !== upload.sha256)
        throw new Error(`Upload changed after validation: ${upload.name}`);
      const name = `${upload.id.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40)}-${sanitizeFileName(upload.name)}`;
      await writeFile(join(uploadDir, name), bytes, { mode: 0o600 });
      names.push(name);
    }
    return names;
  }

  private async buildCommand<T>(
    operation: SandboxOperation<T>,
    operationDir: string,
    responseSchema: object,
  ) {
    const tools = operation.tools === "workspace" ? TOOL_NAMES.join(",") : "";
    const claudeArgs = [
      this.options.claudeCommand,
      "--print",
      "--safe-mode",
      "--disable-slash-commands",
      "--strict-mcp-config",
      "--no-session-persistence",
      "--model",
      operation.model.model,
      "--effort",
      operation.model.effort,
      "--max-budget-usd",
      String(operation.model.maxBudgetUsd),
      "--tools",
      tools,
      "--disallowed-tools",
      NO_NETWORK_TOOLS.join(","),
      "--permission-mode",
      operation.tools === "workspace" ? "bypassPermissions" : "dontAsk",
      ...(operation.tools === "workspace"
        ? ["--dangerously-skip-permissions"]
        : []),
      "--system-prompt",
      operation.systemPrompt,
      "--output-format",
      "json",
      "--json-schema",
      JSON.stringify(responseSchema),
    ];
    if (!(await sandboxRuntimeAvailable(this.options.sandboxCommand))) {
      if (
        !this.options.allowUnsafeLocalFallback ||
        operation.tools === "workspace"
      )
        throw new Error(
          "Anthropic Sandbox Runtime (srt) is required but unavailable.",
        );
      return { command: claudeArgs, sandboxed: false };
    }
    const settingsPath = join(operationDir, "sandbox-settings.json");
    const home = process.env.HOME ? resolve(process.env.HOME) : null;
    const claudeConfig =
      process.env.CLAUDE_CONFIG_DIR ?? (home ? join(home, ".claude") : null);
    const settings = this.options.sandboxSettingsTemplate
      ? validateSandboxSettings(
          JSON.parse(
            await Bun.file(this.options.sandboxSettingsTemplate).text(),
          ),
        )
      : {
          network: {
            allowedDomains: [
              "api.anthropic.com",
              "*.anthropic.com",
              "claude.ai",
              "*.claude.ai",
            ],
            deniedDomains: [],
            allowLocalBinding: false,
            allowUnixSockets: [],
          },
          filesystem: {
            denyRead: [home, "/root"].filter(Boolean),
            allowRead: [operationDir, claudeConfig].filter(Boolean),
            allowWrite: [operationDir],
            denyWrite: [],
          },
          enableWeakerNestedSandbox: false,
          enableWeakerNetworkIsolation: false,
        };
    await writeFile(settingsPath, JSON.stringify(settings, null, 2), {
      mode: 0o600,
    });
    return {
      command: [
        this.options.sandboxCommand,
        "--settings",
        settingsPath,
        ...claudeArgs,
      ],
      sandboxed: true,
    };
  }
}
