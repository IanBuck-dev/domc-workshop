import { afterEach, describe, expect, test } from "bun:test";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ProcessCaptureRepository } from "../packages/storage/src/process-capture-repository.ts";
import { OpportunityDiscoveryRepository } from "../packages/storage/src/opportunity-discovery-repository.ts";
import { WorkspaceRepository } from "../packages/storage/src/workspace-repository.ts";
import {
  aiTrace,
  confirmedProcess,
  normalizedHypotheses,
  opportunityDefaults,
  scenarioResult,
} from "./opportunity-fixtures.ts";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "opportunity-storage-"));
  roots.push(root);
  const processes = new ProcessCaptureRepository(root);
  const process = await confirmedProcess(processes);
  const opportunities = new OpportunityDiscoveryRepository(root);
  const defaults = await opportunityDefaults();
  return { root, processes, process, opportunities, defaults };
}

describe("opportunity discovery repository", () => {
  test("persists immutable snapshots, traces, hypotheses and three scenarios", async () => {
    const { process, opportunities, defaults } = await fixture();
    const processCoverPath = join(
      opportunities.root,
      "process-captures",
      process.id,
      "cover.yaml",
    );
    const processCoverBefore = await readFile(processCoverPath, "utf8");
    let record = await opportunities.create(
      process,
      defaults.config,
      defaults.contracts,
    );
    expect(record.state).toBe("hypotheses_queued");
    expect(JSON.stringify(record.sourceProcess)).not.toContain(
      process.cover.participantEmail,
    );
    record = await opportunities.markHypothesesRunning(process.id);
    record = await opportunities.saveHypotheses(
      process.id,
      normalizedHypotheses(),
      aiTrace(),
    );
    expect(record.state).toBe("scenarios_running");
    record = await opportunities.saveScenarios(
      process.id,
      scenarioResult(),
      aiTrace(),
    );
    expect(record.state).toBe("completed");
    expect(opportunities.summary(record, process)).toMatchObject({
      hypothesisCount: 1,
      highConfidenceHypothesisCount: 1,
      scenarioCount: 3,
      isStale: false,
    });
    expect(
      (await opportunities.history(process.id)).map((entry) => entry.event),
    ).toEqual(
      expect.arrayContaining([
        "opportunity-discovery-created",
        "hypotheses-completed",
        "scenarios-completed",
      ]),
    );
    expect(
      await readFile(
        join(opportunities.dir(process.id), "operations.jsonl"),
        "utf8",
      ),
    ).toContain("opportunity-scenarios");
    expect(await readFile(processCoverPath, "utf8")).toBe(processCoverBefore);
  });

  test("stops neutrally without scenarios when no high-confidence hypothesis exists", async () => {
    const { process, opportunities, defaults } = await fixture();
    await opportunities.create(process, defaults.config, defaults.contracts);
    await opportunities.markHypothesesRunning(process.id);
    const record = await opportunities.saveHypotheses(
      process.id,
      normalizedHypotheses("medium"),
      aiTrace(),
    );
    expect(record.state).toBe("no_supported_hypotheses");
    expect(record.scenarios).toBeNull();
  });

  test("recovers interrupted work as retryable failure and preserves phase output", async () => {
    const { process, opportunities, defaults } = await fixture();
    const abandonedCreate = join(
      opportunities.root,
      "process-captures",
      process.id,
      `.opportunity-discovery-${crypto.randomUUID()}.tmp`,
    );
    await mkdir(abandonedCreate, { recursive: true });
    await writeFile(join(abandonedCreate, "partial.json"), "{}");
    await opportunities.create(process, defaults.config, defaults.contracts);
    await opportunities.markHypothesesRunning(process.id);
    expect(await opportunities.recoverInterrupted()).toBe(1);
    await expect(access(abandonedCreate)).rejects.toThrow();
    let record = await opportunities.required(process.id);
    expect(record.state).toBe("hypotheses_failed");
    record = await opportunities.prepareTechnicalRetry(process.id);
    expect(record.state).toBe("hypotheses_queued");
  });

  test("preserves hypotheses across a scenario failure and retries only phase two", async () => {
    const { process, opportunities, defaults } = await fixture();
    await opportunities.create(process, defaults.config, defaults.contracts);
    await opportunities.markHypothesesRunning(process.id);
    await opportunities.saveHypotheses(
      process.id,
      normalizedHypotheses(),
      aiTrace(),
    );
    const hypothesesPath = join(
      opportunities.dir(process.id),
      "hypotheses.json",
    );
    const hypothesesBefore = await readFile(hypothesesPath, "utf8");
    await opportunities.markPhaseFailed(
      process.id,
      "scenarios",
      "Fiktiver technischer Fehler.",
    );
    const retried = await opportunities.prepareTechnicalRetry(process.id);

    expect(retried.state).toBe("scenarios_running");
    expect(await readFile(hypothesesPath, "utf8")).toBe(hypothesesBefore);
    await expect(
      opportunities.prepareTechnicalRetry(process.id),
    ).rejects.toThrow("Nur eine fehlgeschlagene Phase");
  });

  test("detects modified process and contract snapshots", async () => {
    const { process, opportunities, defaults } = await fixture();
    const record = await opportunities.create(
      process,
      defaults.config,
      defaults.contracts,
    );
    const changed = structuredClone(process);
    changed.understanding!.purpose.value = "Geänderter bestätigter Zweck";
    expect(opportunities.isStale(record, changed)).toBe(true);

    const contract = join(
      opportunities.dir(process.id),
      "contracts",
      "opportunity-base.md",
    );
    await writeFile(contract, "manipuliert");
    await expect(opportunities.contracts(process.id)).rejects.toThrow(
      "verändert",
    );
  });

  test("cascades process deletion and moves the dependent module on reset", async () => {
    const first = await fixture();
    await first.opportunities.create(
      first.process,
      first.defaults.config,
      first.defaults.contracts,
    );
    const deletedOpportunityDir = first.opportunities.dir(first.process.id);
    await first.processes.deleteCapture(first.process.id);
    await expect(access(deletedOpportunityDir)).rejects.toThrow();

    const second = await fixture();
    await second.opportunities.create(
      second.process,
      second.defaults.config,
      second.defaults.contracts,
    );
    const destination = await new WorkspaceRepository(second.root).reset();
    expect(
      await Bun.file(
        join(
          destination,
          second.process.id,
          "opportunity-discovery",
          "metadata.yaml",
        ),
      ).exists(),
    ).toBeTrue();
    await expect(
      access(second.opportunities.dir(second.process.id)),
    ).rejects.toThrow();
  });
});
