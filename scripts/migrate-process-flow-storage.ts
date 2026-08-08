/**
 * Hebt vorhandene Prozessstände vor dem V3-only-Betrieb atomar auf den
 * kanonischen Flow-Vertrag. Der Server ruft dieselbe Migration beim Start auf.
 *
 * Aufruf: bun run migrate:process-flow
 */
import { workspacePath } from "../apps/server/src/launcher.ts";
import { migrateProcessFlowStorage } from "../packages/storage/src/process-flow-migration.ts";

const result = await migrateProcessFlowStorage(workspacePath());
console.log(`${result.migrated} Prozessstände auf Flow V3 geprüft.`);
