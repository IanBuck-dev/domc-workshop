import { expect, test } from "bun:test";
import { processCaptureConfigSchema } from "../packages/domain/src/process-understanding.ts";
import { opportunityDiscoveryConfigSchema } from "../packages/domain/src/opportunity-discovery.ts";
import { agenticPotentialAssessmentConfigSchema } from "../packages/domain/src/agentic-potential-assessment.ts";

test("all provider-neutral default configs select the Codex model", async () => {
  const [process, opportunity, assessment] = await Promise.all([
    Bun.file("defaults/process-capture-config.json").json(),
    Bun.file("defaults/opportunity-discovery-config.json").json(),
    Bun.file("defaults/agentic-potential-assessment-config.json").json(),
  ]);
  expect(processCaptureConfigSchema.parse(process).ai.model).toBe(
    "gpt-5.6-sol",
  );
  expect(opportunityDiscoveryConfigSchema.parse(opportunity).ai.model).toBe(
    "gpt-5.6-sol",
  );
  expect(
    agenticPotentialAssessmentConfigSchema.parse(assessment).ai.model,
  ).toBe("gpt-5.6-sol");
});
