import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
export async function atomicWrite(path: string, data: string | Uint8Array) {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  await writeFile(tmp, data, "utf8");
  await rename(tmp, path);
}
