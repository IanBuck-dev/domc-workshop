import { resolve } from "node:path";
import { z } from "zod";
import { processDefinitionDraftSchema } from "../packages/domain/src/process-understanding.ts";

const target = resolve(
  process.cwd(),
  "defaults/ai-schemas/process-definition.json",
);
const schema = z.toJSONSchema(processDefinitionDraftSchema, {
  target: "draft-2020-12",
});

await Bun.write(target, `${JSON.stringify(schema, null, 2)}\n`);
console.log(`Generated ${target}`);
