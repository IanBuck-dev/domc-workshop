// Keep the backend as a direct child process. Bun's watch supervisor can block
// execution of the separately authenticated Claude CLI on macOS.
import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { createServer } from "node:net";
import { join } from "node:path";

async function findFreePort(preferred: number): Promise<number> {
  return await new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(preferred, "127.0.0.1", () => {
      const address = server.address();
      const port =
        typeof address === "object" && address ? address.port : preferred;
      server.close(() => resolve(port));
    });
  }).catch(
    () =>
      new Promise<number>((resolve, reject) => {
        const server = createServer();
        server.once("error", reject);
        server.listen(0, "127.0.0.1", () => {
          const address = server.address();
          if (typeof address === "object" && address)
            server.close(() => resolve(address.port));
          else server.close(() => reject(new Error("Kein Port verfügbar.")));
        });
      }),
  );
}

async function hasSeededProcesses(): Promise<boolean> {
  const dir = join(process.cwd(), "workspace", "process-captures");
  if (!existsSync(dir)) return false;
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  return entries.some(
    (entry) => entry.isDirectory() && entry.name.startsWith("PROC-"),
  );
}

async function autoSeedIfEmpty() {
  if (process.env.DEMO_SEED === "0") return;
  if (await hasSeededProcesses()) return;
  console.log("Workspace leer — Demo-Szenarien werden angelegt …");
  const seedScript = join(process.cwd(), "scripts", "seed-demo-process.ts");
  if (!existsSync(seedScript)) {
    console.warn(
      "WARNUNG: Seed-Skript scripts/seed-demo-process.ts fehlt — Demo-Daten werden nicht angelegt.",
    );
    return;
  }
  try {
    const seed = Bun.spawn(
      ["bun", "run", "scripts/seed-demo-process.ts", "--alle"],
      { stdout: "inherit", stderr: "inherit" },
    );
    const exitCode = await seed.exited;
    if (exitCode !== 0)
      console.warn(
        `WARNUNG: Seed-Skript ist mit Exit-Code ${exitCode} beendet worden — Dev-Start läuft trotzdem weiter.`,
      );
  } catch (error) {
    console.warn(
      `WARNUNG: Seed-Skript konnte nicht ausgeführt werden — Dev-Start läuft trotzdem weiter. (${error instanceof Error ? error.message : String(error)})`,
    );
  }
}

// Auf macOS immer ohne KI-Sandbox starten — die Sandbox ist für die
// Linux-Umgebungen gedacht und bremst lokal nur die Demo aus.
const withoutAiSandbox =
  process.argv.includes("--without-ai-sandbox") ||
  process.platform === "darwin";
if (withoutAiSandbox)
  console.warn(
    "WARNUNG: Lokaler Präsentationsmodus ohne KI-Sandbox. Nur mit Demo-Daten verwenden.",
  );

await autoSeedIfEmpty();

const preferredApiPort = Number(process.env.DEV_API_PORT ?? 3210);
const port = await findFreePort(preferredApiPort);
const apiProxyTarget = `http://127.0.0.1:${port}`;
const webPort = Number(process.env.DEV_WEB_PORT ?? 5173);

const server = Bun.spawn(["bun", "apps/server/src/index.ts"], {
  stdout: "inherit",
  stderr: "inherit",
  env: {
    ...process.env,
    BUN_WATCH: "1",
    PORT: String(port),
    ...(withoutAiSandbox ? { AI_SANDBOX_MODE: "off" } : {}),
  },
});
const web = Bun.spawn(
  [
    "bun",
    "x",
    "vite",
    "--config",
    "apps/web/vite.config.ts",
    "--port",
    String(webPort),
    "--strictPort",
  ],
  {
    stdout: "inherit",
    stderr: "inherit",
    env: {
      ...process.env,
      VITE_API_PROXY_TARGET: apiProxyTarget,
    },
  },
);
const stop = () => {
  server.kill();
  web.kill();
  process.exit();
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
await Promise.all([server.exited, web.exited]);
export {};
