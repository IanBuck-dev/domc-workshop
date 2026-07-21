import { existsSync } from "node:fs";
import { open, readFile, rm } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { createServer } from "node:net";
export function appBase() {
  if (process.env.APP_BASE_PATH) return process.env.APP_BASE_PATH;
  return basename(process.execPath).startsWith("Claims-Ideenportfolio")
    ? dirname(process.execPath)
    : process.cwd();
}
export async function openBrowser(url: string) {
  if (process.env.NO_OPEN === "1") return;
  const cmd =
    process.platform === "win32"
      ? ["cmd", "/c", "start", "", url]
      : process.platform === "darwin"
        ? ["open", url]
        : ["xdg-open", url];
  Bun.spawn(cmd, { stdout: "ignore", stderr: "ignore" });
}
export function workspacePath() {
  return process.env.WORKSPACE_PATH ?? join(appBase(), "workspace");
}
export function webDist() {
  return basename(process.execPath).startsWith("Claims-Ideenportfolio")
    ? join(appBase(), "web")
    : join(appBase(), "dist", "web");
}
export function hasWebDist() {
  return existsSync(join(webDist(), "index.html"));
}
export async function availablePort(preferred = 3210) {
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
      new Promise<number>((resolve) => {
        const server = createServer();
        server.listen(0, "127.0.0.1", () => {
          const address = server.address();
          const port =
            typeof address === "object" && address ? address.port : 3211;
          server.close(() => resolve(port));
        });
      }),
  );
}
export async function acquireInstanceLock(root: string) {
  const path = join(root, ".instance.lock");
  try {
    const handle = await open(path, "wx");
    await handle.writeFile(String(process.pid));
    await handle.close();
  } catch {
    const pid = Number(await readFile(path, "utf8").catch(() => "0"));
    if (pid === process.pid) return;
    try {
      process.kill(pid, 0);
      throw new Error("KI-Potenziale läuft bereits.");
    } catch (error) {
      if (error instanceof Error && error.message.includes("läuft bereits"))
        throw error;
      await rm(path, { force: true });
      return acquireInstanceLock(root);
    }
  }
  const release = () => void rm(path, { force: true });
  process.once("exit", release);
  process.once("SIGINT", () => {
    release();
    process.exit(0);
  });
  process.once("SIGTERM", () => {
    release();
    process.exit(0);
  });
}
