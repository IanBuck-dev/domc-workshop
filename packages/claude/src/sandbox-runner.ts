import {
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { createHash } from "node:crypto";
import { basename, join, relative, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import type { ProcessSelectedUpload } from "./process-ai-contracts.ts";
import type {
  AiRuntimeProvider,
  StructuredAiRequest,
  StructuredAiResult,
} from "../../ai-runtime/src/contracts.ts";
import type { AiTrace } from "../../domain/src/process-understanding.ts";
import { providerModel } from "../../ai-runtime/src/operation-policy.ts";

const NO_NETWORK_TOOLS = ["WebFetch", "WebSearch", "Task", "NotebookEdit"];
const TOOL_NAMES = ["Read", "Glob", "Bash"] as const;

export const CLAUDE_NETWORK_ALLOWED_DOMAINS = [
  "api.anthropic.com",
  "*.anthropic.com",
  "claude.ai",
  "*.claude.ai",
  "platform.claude.com",
] as const;

export interface SandboxOperation<T> extends StructuredAiRequest<T> {
  selectedUploads?: ProcessSelectedUpload[];
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
  sandboxMode?: "required" | "off";
  allowUnsafeLocalFallback?: boolean;
  transport?: (
    request: SandboxTransportRequest,
  ) => Promise<SandboxTransportResult>;
}

function abortError() {
  return new DOMException("AI operation cancelled.", "AbortError");
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

async function denyHomeEntriesExcept(
  home: string,
  allowedPaths: string[],
): Promise<string[]> {
  const allowedWithinHome = allowedPaths.filter((path) => isWithin(home, path));
  const denied: string[] = [];
  const visit = async (directory: string): Promise<void> => {
    const names = await readdir(directory);
    for (const name of names) {
      const entry = join(directory, name);
      if (allowedWithinHome.includes(entry)) continue;
      if (allowedWithinHome.some((allowed) => isWithin(entry, allowed))) {
        await visit(entry);
      } else {
        denied.push(entry);
      }
    }
  };
  await visit(home);
  return denied;
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
function balancedJsonObjectEnd(value: string, start: number) {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < value.length; index += 1) {
    const character = value[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === "{") depth += 1;
    else if (character === "}") {
      depth -= 1;
      if (depth === 0) return index + 1;
    }
  }
  return null;
}

function parsePromptedJson(value: string) {
  const trimmed = value.trim();
  const unfenced = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  try {
    return JSON.parse(unfenced);
  } catch (directError) {
    let searchFrom = 0;
    while (searchFrom < unfenced.length) {
      const start = unfenced.indexOf("{", searchFrom);
      if (start < 0) break;
      const end = balancedJsonObjectEnd(unfenced, start);
      if (end !== null) {
        try {
          return JSON.parse(unfenced.slice(start, end));
        } catch {
          // Continue with a later object candidate in the advisory prose.
        }
      }
      searchFrom = start + 1;
    }
    throw directError;
  }
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

function killProcessTree(proc: Bun.Subprocess<"pipe", "pipe", "pipe">) {
  if (proc.exitCode !== null) return;
  if (process.platform !== "win32") {
    try {
      process.kill(-proc.pid, "SIGKILL");
      return;
    } catch {
      // Fall back to the direct child if a process group is unavailable.
    }
  }
  proc.kill("SIGKILL");
}

export async function runSandboxTransport(
  request: SandboxTransportRequest,
): Promise<SandboxTransportResult> {
  const proc = Bun.spawn(request.command, {
    cwd: request.cwd,
    env: request.env,
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
    detached: process.platform !== "win32",
  });
  const cancel = () => killProcessTree(proc);
  const timeout = setTimeout(cancel, request.timeoutMs);
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

export class SandboxRunner implements AiRuntimeProvider {
  readonly id = "claude-cli" as const;
  private readonly options: Required<
    Pick<
      SandboxRunnerOptions,
      | "tempRoot"
      | "claudeCommand"
      | "sandboxCommand"
      | "sandboxMode"
      | "allowUnsafeLocalFallback"
    >
  > &
    Omit<
      SandboxRunnerOptions,
      | "tempRoot"
      | "claudeCommand"
      | "sandboxCommand"
      | "sandboxMode"
      | "allowUnsafeLocalFallback"
    >;

  constructor(options: SandboxRunnerOptions = {}) {
    this.options = {
      ...options,
      tempRoot: options.tempRoot ?? join(tmpdir(), "claims-ai-operations"),
      uploadRoot: options.uploadRoot ?? process.env.AI_UPLOAD_ROOT,
      claudeCommand: options.claudeCommand ?? Bun.which("claude") ?? "claude",
      sandboxCommand: options.sandboxCommand ?? "srt",
      sandboxSettingsTemplate:
        options.sandboxSettingsTemplate ?? process.env.AI_SANDBOX_SETTINGS,
      sandboxMode:
        options.sandboxMode ??
        (process.env.AI_SANDBOX_MODE === "off" ? "off" : "required"),
      allowUnsafeLocalFallback:
        options.allowUnsafeLocalFallback ??
        process.env.NODE_ENV !== "production",
    };
    if (
      this.options.sandboxMode === "off" &&
      (process.env.NODE_ENV === "production" ||
        basename(process.execPath) !== "bun")
    )
      throw new Error(
        "AI_SANDBOX_MODE=off is allowed only with the local Bun development runtime.",
      );
  }

  runStructured<T>(
    operation: StructuredAiRequest<T>,
  ): Promise<StructuredAiResult<T>> {
    const operationId = crypto.randomUUID();
    return this.execute(operation, operationId);
  }

  private async execute<T>(
    operation: StructuredAiRequest<T>,
    operationId: string,
  ): Promise<StructuredAiResult<T>> {
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
      const basePrompt = `${operation.prompt}\n\n## Verfügbare Dateien\n${
        uploads.length
          ? uploads.map((name) => `- uploads/${name}`).join("\n")
          : "Keine ausgewählten Dateien."
      }`;
      const responseSchema = claudeCompatibleSchema(
        operation.responseJsonSchema,
      );
      const prompt =
        operation.structuredOutput === "prompted"
          ? `${basePrompt}\n\n## Verbindliches Ausgabeschema\n${JSON.stringify(responseSchema)}\n\nGib ausschließlich ein JSON-Objekt ohne Markdown oder Erläuterungen aus.`
          : basePrompt;
      const promptPath = join(operationDir, "operation-prompt.md");
      const schemaPath = join(operationDir, "response-schema.json");
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
      const transport = this.options.transport ?? runSandboxTransport;
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
          ? parsePromptedJson(envelope.result)
          : (envelope.result ?? envelope));
      const value = operation.responseSchema.parse(raw);
      const usage =
        typeof envelope.usage === "object" && envelope.usage !== null
          ? (envelope.usage as Record<string, unknown>)
          : {};
      const trace: AiTrace = {
        provider: "claude-cli",
        operationId,
        sessionId: logicalSessionId,
        model: providerModel("claude-cli", operation.model.model),
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

  private async stageUploads(
    operationDir: string,
    uploads: ProcessSelectedUpload[],
  ) {
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
          `Upload is outside the configured process workspace: ${upload.name}`,
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
      providerModel("claude-cli", operation.model.model),
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
      ...(operation.structuredOutput === "prompted"
        ? []
        : ["--json-schema", JSON.stringify(responseSchema)]),
    ];
    if (this.options.sandboxMode === "off")
      return { command: claudeArgs, sandboxed: false };
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
    const claudeStateFile = home ? join(home, ".claude.json") : null;
    const claudeKeychains =
      process.platform === "darwin" && home
        ? join(home, "Library", "Keychains")
        : null;
    const claudeCommand =
      Bun.which(this.options.claudeCommand) ??
      resolve(this.options.claudeCommand);
    const claudeExecutable = await realpath(claudeCommand).catch(
      () => claudeCommand,
    );
    const localAllowRead = [
      operationDir,
      claudeConfig,
      claudeStateFile,
      claudeKeychains,
      claudeCommand,
      claudeExecutable,
    ].filter((path): path is string => Boolean(path));
    const localDenyRead =
      process.platform === "darwin" && home
        ? await denyHomeEntriesExcept(home, localAllowRead)
        : [home, "/root"].filter((path): path is string => Boolean(path));
    const settings = this.options.sandboxSettingsTemplate
      ? validateSandboxSettings(
          JSON.parse(
            await Bun.file(this.options.sandboxSettingsTemplate).text(),
          ),
        )
      : {
          network: {
            allowedDomains: [...CLAUDE_NETWORK_ALLOWED_DOMAINS],
            deniedDomains: [],
            allowLocalBinding: false,
            allowUnixSockets: [],
          },
          filesystem: {
            denyRead: [...localDenyRead, "/root"],
            allowRead: localAllowRead,
            allowWrite: [operationDir, claudeConfig, claudeStateFile].filter(
              (path): path is string => Boolean(path),
            ),
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
