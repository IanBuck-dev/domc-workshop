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
    "gpt-5.6-terra",
  );
  expect(opportunityDiscoveryConfigSchema.parse(opportunity).ai.model).toBe(
    "gpt-5.6-terra",
  );
  expect(
    agenticPotentialAssessmentConfigSchema.parse(assessment).ai.model,
  ).toBe("gpt-5.6-terra");
  expect(opportunity.ai.reasoningEffort).toBe("medium");
  expect(assessment.ai.reasoningEffort).toBe("medium");
});

test("local and Pi demos run Terra Medium in Fast mode", async () => {
  const devScript = await Bun.file("scripts/dev.ts").text();
  const piService = await Bun.file(
    "deploy/pi/claims-ai-portfolio.service",
  ).text();

  for (const source of [devScript, piService]) {
    expect(source).toContain("gpt-5.6-terra");
    expect(source).toContain("medium");
    expect(source).toContain("priority");
  }
});
