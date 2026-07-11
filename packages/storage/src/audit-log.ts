import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
export async function audit(path: string, event: string, detail: unknown) {
  await mkdir(dirname(path), { recursive: true });
  await appendFile(
    path,
    JSON.stringify({ at: new Date().toISOString(), event, detail }) + "\n",
    "utf8",
  );
}
