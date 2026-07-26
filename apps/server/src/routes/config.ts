import { Hono } from "hono";
import { resolve } from "node:path";
import { z } from "zod";
import {
  processCaptureConfigSchema,
  processInstructionsSchema,
} from "../../../../packages/domain/src/process-understanding.ts";
import {
  composeProcessOperationPrompt,
  loadProcessPrompt,
} from "../../../../packages/claude/src/process-ai-utils.ts";

const instructionPreviewRequestSchema = z.object({
  instructions: processInstructionsSchema,
});

export function configRoutes(defaultsRoot?: string) {
  const app = new Hono();
  app.get("/defaults", async (c) => {
    const root =
      defaultsRoot ??
      process.env.CLAIMS_AI_DEFAULTS_DIR ??
      resolve(process.cwd(), "defaults");
    const value = processCaptureConfigSchema.parse(
      await Bun.file(resolve(root, "process-capture-config.json")).json(),
    );
    return c.json(value);
  });
  app.post("/instruction-preview", async (c) => {
    const { instructions } = instructionPreviewRequestSchema.parse(
      await c.req.json(),
    );
    const [base, followUps, synthesis] = await Promise.all([
      loadProcessPrompt("process-base", defaultsRoot),
      loadProcessPrompt("process-follow-ups", defaultsRoot),
      loadProcessPrompt("process-synthesis", defaultsRoot),
    ]);
    c.header("Cache-Control", "private, no-store");
    return c.json({
      base,
      followUps: composeProcessOperationPrompt(
        followUps,
        instructions.followUps,
      ),
      synthesis: composeProcessOperationPrompt(
        synthesis,
        instructions.synthesis,
      ),
    });
  });
  return app;
}
