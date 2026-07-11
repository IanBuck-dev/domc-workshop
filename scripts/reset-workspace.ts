import { WorkspaceRepository } from "../packages/storage/src/workspace-repository.ts";
if (process.argv[2] !== "ZURÜCKSETZEN") {
  console.error("Aufruf: bun run scripts/reset-workspace.ts ZURÜCKSETZEN");
  process.exit(1);
}
const ws = new WorkspaceRepository(
  process.env.WORKSPACE_PATH ?? `${process.cwd()}/workspace`,
);
await ws.ensure();
console.log(`Sicherung erstellt: ${await ws.reset()}`);
