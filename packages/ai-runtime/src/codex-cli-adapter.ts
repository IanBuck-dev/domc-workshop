import { createHash } from "node:crypto";
import {
  lstat,
  mkdir,
  mkdtemp,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { basename, join, relative, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import type {
  AiRuntimeProvider,
  StructuredAiRequest,
  StructuredAiResult,
} from "./contracts.ts";
import { providerModel } from "./operation-policy.ts";

export interface CodexTransportRequest {
  command: string[];
  cwd: string;
  env: Record<string, string | undefined>;
  stdin: string;
  timeoutMs: number;
  maxOutputBytes: number;
  signal?: AbortSignal;
}

export interface CodexTransportResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  sandboxed: boolean;
}

export interface CodexCliAdapterOptions {
  tempRoot?: string;
  uploadRoot?: string;
  codexCommand?: string;
  sandboxCommand?: string;
  sandboxMode?: "required" | "off";
  transport?: (request: CodexTransportRequest) => Promise<CodexTransportResult>;
}

function abortError() {
  return new DOMException("AI operation cancelled.", "AbortError");
}

async function readBounded(
  stream: ReadableStream<Uint8Array>,
  maximumBytes: number,
  onLimit: () => void,
) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let output = "";
  while (true) {
    const next = await reader.read();
    if (next.done) break;
    bytes += next.value.byteLength;
    if (bytes > maximumBytes) {
      onLimit();
      throw new Error("Codex output exceeded the configured safe limit.");
    }
    output += decoder.decode(next.value, { stream: true });
  }
  return output + decoder.decode();
}

function safeName(value: string) {
  return (
    basename(value)
      .replace(/[^\p{L}\p{N}._-]+/gu, "-")
      .slice(0, 120) || "upload"
  );
}

function within(root: string, target: string) {
  const value = relative(root, target);
  return value === "" || (!value.startsWith(`..${sep}`) && value !== "..");
}

/**
 * Codex structured outputs support a strict JSON-Schema subset. Semantic
 * constraints omitted here remain enforced by the request's Zod schema after
 * generation.
 */
export function codexOutputSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(codexOutputSchema);
  if (!value || typeof value !== "object") return value;
  const normalized = Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => key !== "uniqueItems")
      .map(([key, item]) => [
        key === "oneOf" ? "anyOf" : key,
        codexOutputSchema(item),
      ]),
  );
  const jsonType = (item: unknown) =>
    item === null
      ? "null"
      : typeof item === "number" && Number.isInteger(item)
        ? "integer"
        : typeof item;
  if (!("type" in normalized) && "const" in normalized)
    normalized.type = jsonType(normalized.const);
  const enumValues = normalized.enum;
  if (
    !("type" in normalized) &&
    Array.isArray(enumValues) &&
    enumValues.length > 0 &&
    enumValues.every((item) => jsonType(item) === jsonType(enumValues[0]))
  )
    normalized.type = jsonType(enumValues[0]);
  if (normalized.type === "array" && !("items" in normalized))
    normalized.items = { type: "string" };
  return normalized;
}

async function defaultTransport(
  request: CodexTransportRequest,
): Promise<CodexTransportResult> {
  const child = Bun.spawn(request.command, {
    cwd: request.cwd,
    env: request.env,
    stdin: new Blob([request.stdin]),
    stdout: "pipe",
    stderr: "pipe",
  });
  const abort = () => child.kill("SIGTERM");
  request.signal?.addEventListener("abort", abort, { once: true });
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    abort();
  }, request.timeoutMs);
  try {
    const [stdout, stderr, exitCode] = await Promise.all([
      readBounded(child.stdout, request.maxOutputBytes, abort),
      readBounded(child.stderr, 64_000, abort),
      child.exited,
    ]);
    if (request.signal?.aborted) throw abortError();
    if (timedOut) throw new Error("Codex operation timed out.");
    return { stdout, stderr, exitCode, sandboxed: true };
  } finally {
    clearTimeout(timeout);
  }
}

/** One fresh, isolated `codex exec` invocation for a bounded structured operation. */
export class CodexCliAdapter implements AiRuntimeProvider {
  readonly id = "codex-cli" as const;
  private readonly options: Required<
    Pick<
      CodexCliAdapterOptions,
      "tempRoot" | "codexCommand" | "sandboxCommand" | "sandboxMode"
    >
  > &
    CodexCliAdapterOptions;

  constructor(options: CodexCliAdapterOptions = {}) {
    this.options = {
      ...options,
      tempRoot: options.tempRoot ?? join(tmpdir(), "claims-ai-codex"),
      codexCommand: options.codexCommand ?? "codex",
      sandboxCommand: options.sandboxCommand ?? "srt",
      sandboxMode:
        options.sandboxMode ??
        (process.env.AI_SANDBOX_MODE === "off" ? "off" : "required"),
    };
  }

  async runStructured<T>(
    request: StructuredAiRequest<T>,
  ): Promise<StructuredAiResult<T>> {
    if (request.signal?.aborted) throw abortError();
    const operationId = crypto.randomUUID();
    const sessionId = request.sessionId ?? crypto.randomUUID();
    const startedAt = performance.now();
    await mkdir(this.options.tempRoot, { recursive: true, mode: 0o700 });
    const cwd = await mkdtemp(join(this.options.tempRoot, `${operationId}-`));
    try {
      const uploads = await this.stageUploads(cwd, request);
      const schemaPath = join(cwd, "response-schema.json");
      await writeFile(
        schemaPath,
        JSON.stringify(codexOutputSchema(request.responseJsonSchema), null, 2),
        { mode: 0o600 },
      );
      const available = uploads.length
        ? uploads.map((name) => `- uploads/${name}`).join("\n")
        : "Keine ausgewählten Dateien.";
      const prompt = `${request.systemPrompt}\n\n${request.prompt}\n\n## Verfügbare Dateien\n${available}\n\nGib ausschließlich das strukturierte Ergebnis gemäß response-schema.json aus.`;
      const codexCommand = [
        this.options.codexCommand,
        "exec",
        "--ephemeral",
        "--ignore-user-config",
        "--ignore-rules",
        "--skip-git-repo-check",
        "--json",
        "--output-schema",
        schemaPath,
        "--output-last-message",
        join(cwd, "last-message.txt"),
        "--sandbox",
        request.tools === "workspace" ? "workspace-write" : "read-only",
        "--model",
        providerModel("codex-cli", request.model.model),
        "--config",
        `model_reasoning_effort=${request.model.effort}`,
        "-",
      ];
      const command = await this.sandboxCommand(cwd, codexCommand);
      const result = await (this.options.transport ?? defaultTransport)({
        command,
        cwd,
        env: {
          PATH: process.env.PATH,
          HOME: process.env.HOME,
          LANG: process.env.LANG ?? "C.UTF-8",
          TMPDIR: cwd,
          CODEX_DISABLE_NETWORK: "1",
        },
        stdin: prompt,
        timeoutMs: request.model.timeoutMs,
        maxOutputBytes: Math.max(64_000, request.model.maxOutputTokens * 16),
        signal: request.signal,
      });
      if (result.exitCode !== 0)
        throw new Error(
          `Codex operation failed (${result.exitCode}): ${(result.stderr || result.stdout).slice(0, 500)}`,
        );
      const lastMessage = Bun.file(join(cwd, "last-message.txt"));
      const maximumBytes = Math.max(64_000, request.model.maxOutputTokens * 16);
      if ((await lastMessage.exists()) && lastMessage.size > maximumBytes)
        throw new Error("Codex output exceeded the configured safe limit.");
      const rawText = (await lastMessage.exists())
        ? await lastMessage.text()
        : result.stdout;
      let raw: unknown;
      try {
        raw = JSON.parse(rawText);
      } catch {
        const events = rawText
          .trim()
          .split("\n")
          .map((line) => JSON.parse(line) as Record<string, unknown>);
        const completed = [...events]
          .reverse()
          .find(
            (event) =>
              typeof event.last_message === "string" ||
              typeof event.output === "string",
          );
        raw = JSON.parse(
          String(completed?.last_message ?? completed?.output ?? ""),
        );
      }
      return {
        value: request.responseSchema.parse(raw),
        trace: {
          provider: "codex-cli",
          operationId,
          sessionId,
          model: providerModel("codex-cli", request.model.model),
          durationMs: Math.round(performance.now() - startedAt),
          inputTokens: null,
          outputTokens: null,
          sandboxed: result.sandboxed && this.options.sandboxMode !== "off",
        },
      };
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  }

  private async sandboxCommand(cwd: string, command: string[]) {
    if (this.options.sandboxMode === "off") {
      if (process.env.NODE_ENV === "production")
        throw new Error("AI_SANDBOX_MODE=off is not allowed in production.");
      return command;
    }
    if (!Bun.which(this.options.sandboxCommand))
      throw new Error(
        "Anthropic Sandbox Runtime (srt) is required but unavailable.",
      );
    const templatePath = process.env.AI_SANDBOX_SETTINGS;
    if (process.env.NODE_ENV === "production" && !templatePath)
      throw new Error("AI_SANDBOX_SETTINGS must be configured in production.");
    if (templatePath) {
      const template = Bun.file(templatePath);
      if (!(await template.exists()))
        throw new Error("Configured AI_SANDBOX_SETTINGS file is missing.");
      try {
        JSON.parse(await template.text());
      } catch {
        throw new Error("Configured AI_SANDBOX_SETTINGS file is invalid.");
      }
    }
    const home = process.env.HOME ? resolve(process.env.HOME) : null;
    const auth = home ? join(home, ".codex") : null;
    const executable =
      Bun.which(this.options.codexCommand) ?? this.options.codexCommand;
    const settings = {
      network: {
        allowedDomains: ["api.openai.com", "*.openai.com", "chatgpt.com"],
        deniedDomains: [],
        allowLocalBinding: false,
        allowUnixSockets: [],
      },
      filesystem: {
        denyRead: [home, "/root"].filter((value): value is string =>
          Boolean(value),
        ),
        allowRead: [cwd, auth, executable].filter((value): value is string =>
          Boolean(value),
        ),
        allowWrite: [cwd, auth].filter((value): value is string =>
          Boolean(value),
        ),
        denyWrite: [],
      },
      enableWeakerNestedSandbox: false,
      enableWeakerNetworkIsolation: false,
    };
    const settingsPath = join(cwd, "sandbox-settings.json");
    await writeFile(settingsPath, JSON.stringify(settings, null, 2), {
      mode: 0o600,
    });
    return [
      this.options.sandboxCommand,
      "--settings",
      settingsPath,
      ...command,
    ];
  }

  private async stageUploads<T>(cwd: string, request: StructuredAiRequest<T>) {
    const uploads = request.selectedUploads ?? [];
    if (!uploads.length) return [];
    const destination = join(cwd, "uploads");
    await mkdir(destination, { recursive: true, mode: 0o700 });
    const configuredRoot = this.options.uploadRoot
      ? await realpath(resolve(this.options.uploadRoot))
      : null;
    const names: string[] = [];
    for (const upload of uploads) {
      const stat = await lstat(upload.path);
      if (!stat.isFile() || stat.isSymbolicLink())
        throw new Error(`Upload is not a regular file: ${upload.name}`);
      const source = await realpath(upload.path);
      if (configuredRoot && !within(configuredRoot, source))
        throw new Error(
          `Upload is outside the configured process workspace: ${upload.name}`,
        );
      if (!configuredRoot && process.env.NODE_ENV === "production")
        throw new Error("AI_UPLOAD_ROOT must be configured in production.");
      const bytes = new Uint8Array(await Bun.file(source).arrayBuffer());
      if (
        bytes.byteLength !== upload.size ||
        createHash("sha256").update(bytes).digest("hex") !== upload.sha256
      )
        throw new Error(`Upload changed after validation: ${upload.name}`);
      const name = `${upload.id.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40)}-${safeName(upload.name)}`;
      await writeFile(join(destination, name), bytes, { mode: 0o600 });
      names.push(name);
    }
    return names;
  }
}
