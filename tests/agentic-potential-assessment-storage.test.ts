import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hashAgenticAssessment } from "../packages/domain/src/agentic-potential-assessment.ts";
import { AgenticPotentialAssessmentRepository } from "../packages/storage/src/agentic-potential-assessment-repository.ts";
import { OpportunityDiscoveryRepository } from "../packages/storage/src/opportunity-discovery-repository.ts";
import { ProcessCaptureRepository } from "../packages/storage/src/process-capture-repository.ts";
import {
  assessmentAiResult,
  assessmentDefaults,
  completedOpportunity,
} from "./agentic-potential-assessment-fixtures.ts";
import { aiTrace, confirmedProcess } from "./opportunity-fixtures.ts";

const roots: string[] = [];
afterEach(() =>
  Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  ),
);

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "agentic-assessment-storage-"));
  roots.push(root);
  const processes = new ProcessCaptureRepository(root);
  const process = await confirmedProcess(processes);
  const opportunities = new OpportunityDiscoveryRepository(root);
  const opportunity = await completedOpportunity(process, opportunities);
  const assessments = new AgenticPotentialAssessmentRepository(root);
  return { root, process, opportunity, assessments };
}

describe("agentic potential assessment repository", () => {
  test("persists frozen contracts and exactly the agentic scenario inputs", async () => {
    const { process, opportunity, assessments } = await fixture();
    const defaults = await assessmentDefaults();
    let record = await assessments.create(
      process,
      opportunity,
      defaults.config,
      defaults.contracts,
    );
    expect(record.state).toBe("queued");
    expect(record.sourceSnapshot.scenario.id).toBe("SCN-agentic");
    expect(record.sourceSnapshot.hypotheses.map((item) => item.id)).toEqual(
      record.sourceSnapshot.scenario.includedHypothesisIds,
    );
    const frozenSchema = (await assessments.contracts(process.id)).schema as {
      properties: {
        criteria: {
          items: {
            oneOf: Array<{
              properties: {
                evidenceIds: { items: { enum: string[] } };
                hypothesisIds: { items: { enum: string[] } };
              };
            }>;
          };
        };
      };
    };
    for (const variant of frozenSchema.properties.criteria.items.oneOf) {
      expect(variant.properties.evidenceIds.items.enum).toEqual(
        record.sourceSnapshot.opportunity.understanding.evidence.map(
          (item) => item.id,
        ),
      );
      expect(variant.properties.hypothesisIds.items.enum).toEqual(["HYP-001"]);
    }
    record = await assessments.markRunning(process.id);
    record = await assessments.saveResult(
      process.id,
      assessmentAiResult(),
      aiTrace(),
    );
    expect(record.state).toBe("completed");
    expect(record.result?.criteria).toHaveLength(32);
    expect(
      record.result?.criteria.filter(
        (item) => item.status === "policy_excluded",
      ),
    ).toHaveLength(8);
    expect(record.assessmentRevision).toMatch(/^[a-f0-9]{64}$/);
    expect(
      await readFile(
        join(assessments.dir(process.id), "operations.jsonl"),
        "utf8",
      ),
    ).toContain("agentic-potential-assessment");
  });

  test("rejects unknown evidence and detects a modified completed result", async () => {
    const { process, opportunity, assessments } = await fixture();
    const defaults = await assessmentDefaults();
    await assessments.create(
      process,
      opportunity,
      defaults.config,
      defaults.contracts,
    );
    await assessments.markRunning(process.id);
    const invalid = assessmentAiResult();
    invalid.criteria[0]!.evidenceIds = ["unknown-evidence"];
    await expect(
      assessments.saveResult(process.id, invalid, aiTrace()),
    ).rejects.toThrow("unbekannte Evidenz");
    await assessments.markFailed(process.id, "Fiktiver Vertragsfehler.");
    await assessments.prepareTechnicalRetry(process.id);
    await assessments.markRunning(process.id);
    const completed = await assessments.saveResult(
      process.id,
      assessmentAiResult(),
      aiTrace(),
    );
    const path = join(assessments.dir(process.id), "result.json");
    const tampered = structuredClone(completed.result!);
    (tampered.criteria[0] as { rationale: string }).rationale = "Manipuliert";
    await writeFile(path, `${JSON.stringify(tampered, null, 2)}\n`);
    await expect(assessments.required(process.id)).rejects.toThrow(
      "Bewertungsergebnis wurde verändert",
    );
  });

  test("recovers queued and running work as a retryable failure", async () => {
    const { process, opportunity, assessments } = await fixture();
    const defaults = await assessmentDefaults();
    await assessments.create(
      process,
      opportunity,
      defaults.config,
      defaults.contracts,
    );
    await assessments.recoverInterrupted();
    const failed = await assessments.required(process.id);
    expect(failed.state).toBe("failed");
    expect((await assessments.prepareTechnicalRetry(process.id)).state).toBe(
      "queued",
    );
  });
});

test("canonical assessment hashing is deterministic", () => {
  expect(hashAgenticAssessment({ b: [2, 1], a: "x" })).toBe(
    hashAgenticAssessment({ a: "x", b: [2, 1] }),
  );
});
