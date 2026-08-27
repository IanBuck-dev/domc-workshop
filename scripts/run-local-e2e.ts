import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";

const scenario = "leitungswasserschaden-wohngebaeude";
const screenshotMode = process.argv.includes("--screenshots");

async function freePort() {
  return await new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Kein freier lokaler Port verfügbar."));
        return;
      }
      server.close(() => resolve(address.port));
    });
  });
}

async function waitForHealth(url: string, process: Bun.Subprocess) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (process.exitCode !== null)
      throw new Error(
        `Der lokale Dev-Server wurde mit ${process.exitCode} beendet.`,
      );
    const response = await fetch(`${url}/api/health`).catch(() => null);
    if (response?.ok) return;
    await Bun.sleep(250);
  }
  throw new Error("Der lokale Dev-Server war nach 60 Sekunden nicht bereit.");
}

async function run(command: string[], env: Record<string, string | undefined>) {
  const child = Bun.spawn(command, {
    cwd: process.cwd(),
    env,
    stdout: "inherit",
    stderr: "inherit",
  });
  const code = await child.exited;
  if (code !== 0)
    throw new Error(`${command.join(" ")} endete mit Exit-Code ${code}.`);
}

const workspace = await mkdtemp(join(tmpdir(), "zukunftswerkstatt-e2e-"));
const username = `e2e-${crypto.randomUUID()}`;
const password = crypto.randomUUID();
const passwordHash = await Bun.password.hash(password);
const sessionSecret = `${crypto.randomUUID()}${crypto.randomUUID()}`;
const apiPort = await freePort();
const webPort = await freePort();
const baseURL = `http://127.0.0.1:${webPort}`;
const commonEnv = {
  ...process.env,
  WORKSPACE_PATH: workspace,
  DEMO_SEED: "0",
  NO_OPEN: "1",
  APP_AUTH_USERNAME: username,
  APP_AUTH_PASSWORD_HASH: passwordHash,
  APP_SESSION_SECRET: sessionSecret,
  DEV_API_PORT: String(apiPort),
  DEV_WEB_PORT: String(webPort),
};

let server: Bun.Subprocess | undefined;
let succeeded = false;
try {
  await run(
    screenshotMode
      ? ["bun", "run", "scripts/seed-documentation.ts"]
      : ["bun", "run", "scripts/seed-demo-process.ts", scenario],
    commonEnv,
  );
  server = Bun.spawn(["bun", "run", "scripts/dev.ts"], {
    cwd: process.cwd(),
    env: commonEnv,
    stdout: "inherit",
    stderr: "inherit",
  });
  await waitForHealth(baseURL, server);
  await run(
    [
      "bunx",
      "playwright",
      "test",
      "--config=playwright.config.ts",
      screenshotMode
        ? "e2e/seeded-ui-screenshots.pw.ts"
        : "e2e/real-claude-product-flow.pw.ts",
      ...(process.argv.includes("--headed") ? ["--headed"] : []),
    ],
    {
      ...commonEnv,
      E2E_BASE_URL: baseURL,
      E2E_AUTH_USERNAME: username,
      E2E_AUTH_PASSWORD: password,
    },
  );
  succeeded = true;
} finally {
  server?.kill("SIGTERM");
  if (server) await server.exited.catch(() => undefined);
  if (process.env.E2E_KEEP_WORKSPACE === "1" || !succeeded)
    console.log(`E2E-Workspace bleibt erhalten: ${workspace}`);
  else await rm(workspace, { recursive: true, force: true });
}
