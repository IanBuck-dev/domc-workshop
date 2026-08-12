import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, realpath, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import type { SpawnOptions, SpawnedProcess } from "ai-sdk-provider-claude-code";
import { CLAUDE_NETWORK_ALLOWED_DOMAINS } from "./sandbox-runner.ts";

export interface ChatSandboxSpawnOptions {
  cwd: string;
  sandboxMode?: "required" | "off";
  sandboxCommand?: string;
}

export async function prepareChatSandboxSpawn(
  options: ChatSandboxSpawnOptions,
): Promise<(options: SpawnOptions) => SpawnedProcess> {
  const mode =
    options.sandboxMode ??
    (process.env.AI_SANDBOX_MODE === "off" ? "off" : "required");
  if (mode === "off") {
    if (
      process.env.NODE_ENV === "production" ||
      basename(process.execPath) !== "bun"
    )
      throw new Error(
        "AI_SANDBOX_MODE=off is allowed only with the local Bun development runtime.",
      );
    return (spawnOptions) => spawnClaude(spawnOptions) as SpawnedProcess;
  }

  const sandboxCommand = options.sandboxCommand ?? "srt";
  if (!Bun.which(sandboxCommand))
    throw new Error(
      "Anthropic Sandbox Runtime (srt) is required but unavailable.",
    );
  const home = process.env.HOME ? resolve(process.env.HOME) : null;
  const claudeConfig =
    process.env.CLAUDE_CONFIG_DIR ?? (home ? join(home, ".claude") : null);
  const claudeState = home ? join(home, ".claude.json") : null;
  const claudeExecutable = Bun.which("claude") ?? "claude";
  const executable = await realpath(claudeExecutable).catch(
    () => claudeExecutable,
  );
  const settingsPath = join(options.cwd, "chat", "sandbox-settings.json");
  await mkdir(join(options.cwd, "chat", "tmp"), { recursive: true });
  const allowedRead = [
    join(options.cwd, "uploads"),
    join(options.cwd, "chat", "contracts"),
    join(options.cwd, "chat", "tmp"),
    join(options.cwd, "process-understanding.json"),
    join(options.cwd, "process-definition.json"),
    claudeConfig,
    claudeState,
    claudeExecutable,
    executable,
  ].filter((value): value is string => Boolean(value));
  const allowedWrite = [
    join(options.cwd, "process-understanding.json"),
    join(options.cwd, "process-definition.json"),
    join(options.cwd, "chat", "tmp"),
    claudeConfig,
    claudeState,
  ].filter((value): value is string => Boolean(value));
  const settings = {
    network: {
      allowedDomains: [...CLAUDE_NETWORK_ALLOWED_DOMAINS],
      deniedDomains: [],
      allowLocalBinding: false,
      allowUnixSockets: [],
    },
    filesystem: {
      denyRead: [home, "/root"].filter((value): value is string =>
        Boolean(value),
      ),
      allowRead: allowedRead,
      allowWrite: allowedWrite,
      denyWrite: [],
    },
    enableWeakerNestedSandbox: false,
    enableWeakerNetworkIsolation: false,
  };
  await writeFile(settingsPath, JSON.stringify(settings, null, 2), {
    mode: 0o600,
  });
  return (spawnOptions) =>
    spawnClaude(spawnOptions, [
      sandboxCommand,
      "--settings",
      settingsPath,
    ]) as SpawnedProcess;
}

function spawnClaude(
  options: SpawnOptions,
  prefix: string[] = [],
): ChildProcess {
  const command = prefix.length ? prefix[0] : options.command;
  const args = prefix.length
    ? [...prefix.slice(1), options.command, ...options.args]
    : options.args;
  return spawn(command, args, {
    cwd: options.cwd,
    env: options.env as NodeJS.ProcessEnv,
    stdio: ["pipe", "pipe", "pipe"],
    signal: options.signal,
  });
}
