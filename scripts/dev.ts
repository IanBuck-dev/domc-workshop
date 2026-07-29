// Keep the backend as a direct child process. Bun's watch supervisor can block
// execution of the separately authenticated Claude CLI on macOS.
const withoutAiSandbox = process.argv.includes("--without-ai-sandbox");
if (withoutAiSandbox)
  console.warn(
    "WARNUNG: Lokaler Präsentationsmodus ohne KI-Sandbox. Nur mit Demo-Daten verwenden.",
  );
const server = Bun.spawn(["bun", "apps/server/src/index.ts"], {
  stdout: "inherit",
  stderr: "inherit",
  env: {
    ...process.env,
    BUN_WATCH: "1",
    ...(withoutAiSandbox ? { AI_SANDBOX_MODE: "off" } : {}),
  },
});
const web = Bun.spawn(
  ["bun", "x", "vite", "--config", "apps/web/vite.config.ts"],
  { stdout: "inherit", stderr: "inherit" },
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
