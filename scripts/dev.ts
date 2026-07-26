// Keep the backend as a direct child process. Bun's watch supervisor can block
// execution of the separately authenticated Claude CLI on macOS.
const server = Bun.spawn(["bun", "apps/server/src/index.ts"], {
  stdout: "inherit",
  stderr: "inherit",
  env: { ...process.env, BUN_WATCH: "1" },
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
