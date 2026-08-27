export {};

const target = process.argv[2] ?? "local";
const strictPi = target === "pi";
const provider = process.env.AI_PROVIDER ?? "codex-cli";
if (provider !== "codex-cli" && provider !== "claude-cli") {
  console.error("FEHLER AI_PROVIDER muss codex-cli oder claude-cli sein");
  process.exit(1);
}

async function commandVersion(command: string, args: string[] = ["--version"]) {
  const lookup = Bun.spawn(
    ["sh", "-c", 'command -v "$1" >/dev/null 2>&1', "sh", command],
    { stdout: "ignore", stderr: "ignore" },
  );
  if ((await lookup.exited) !== 0) return null;
  const process = Bun.spawn([command, ...args], {
    stdout: "pipe",
    stderr: "pipe",
    env: {
      PATH: Bun.env.PATH,
      HOME: Bun.env.HOME,
      LANG: Bun.env.LANG ?? "C.UTF-8",
      CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
    },
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited,
  ]);
  if (code !== 0) return `vorhanden (Versionsprüfung fehlgeschlagen)`;
  return (stdout || stderr).trim().split("\n")[0] ?? "vorhanden";
}

const checks = [
  ["Bun", "bun", ["--version"], true],
  [
    provider === "codex-cli" ? "Codex CLI" : "Claude CLI",
    provider === "codex-cli" ? "codex" : "claude",
    ["--version"],
    true,
  ],
  ["Sandbox Runtime", "srt", ["--version"], strictPi],
  ["Bubblewrap", "bwrap", ["--version"], strictPi],
  ["socat", "socat", ["-V"], strictPi],
  ["ripgrep", "rg", ["--version"], strictPi],
] as const;

let failed = false;
for (const [label, command, args, required] of checks) {
  const version = await commandVersion(command, [...args]);
  if (version) console.log(`OK   ${label}: ${version}`);
  else {
    console.log(`${required ? "FEHLER" : "HINWEIS"} ${label}: nicht gefunden`);
    failed ||= required;
  }
}

if (strictPi) {
  if (process.platform !== "linux") {
    console.error(
      `FEHLER Pi-Ziel benötigt Linux, gefunden: ${process.platform}`,
    );
    failed = true;
  }
  if (process.arch !== "arm64") {
    console.error(`FEHLER Pi-Ziel benötigt ARM64, gefunden: ${process.arch}`);
    failed = true;
  }
  const requiredEnvironment = [
    "APP_AUTH_USERNAME",
    "APP_AUTH_PASSWORD_HASH",
    "APP_SESSION_SECRET",
    "WORKSPACE_PATH",
    "AI_UPLOAD_ROOT",
    "AI_SANDBOX_SETTINGS",
  ];
  for (const name of requiredEnvironment) {
    if (!Bun.env[name]) {
      console.error(`FEHLER Umgebungsvariable fehlt: ${name}`);
      failed = true;
    }
  }
}

if (failed) process.exit(1);
