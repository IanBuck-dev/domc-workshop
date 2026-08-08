import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  migrateProcessFlowStorage,
  migrateProcessUnderstanding,
} from "../packages/storage/src/process-flow-migration.ts";
import { understanding } from "./process-fixtures.ts";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

function v2Fixture() {
  const value = structuredClone(understanding()) as Record<string, unknown>;
  value.schemaVersion = 2;
  delete value.flow;
  value.decisions = {
    value: null,
    provenance: "unknown",
    evidenceIds: [],
    confidence: null,
    assumptions: [],
    confirmed: false,
  };
  const steps = value.steps as Array<Record<string, unknown>>;
  steps.forEach((step) => {
    step.decisions = [];
  });
  return value;
}

describe("Process-flow-Speichermigration", () => {
  test("übersetzt eine vollständige V2-Entscheidung mit nextStepId in Gateway und Kanten", () => {
    const value = v2Fixture();
    (value.steps as Array<Record<string, unknown>>)[0]!.decisions = [
      {
        id: "decision-1",
        question: "Ist die Kontaktaufnahme erlaubt?",
        mode: "rule_based",
        options: [
          {
            id: "option-ja",
            label: "Ja",
            determination: "Einwilligung liegt vor.",
            consequence: "Ansprache fortsetzen.",
            nextStepId: "step-2",
          },
          {
            id: "option-nein",
            label: "Nein",
            determination: null,
            consequence: "Keine Ansprache.",
            nextStepId: null,
          },
        ],
      },
    ];

    const migrated = migrateProcessUnderstanding(value);

    expect(migrated.schemaVersion).toBe(3);
    expect(migrated.flow.nodes).toContainEqual({
      id: "xor-1",
      kind: "gateway",
      question: "Ist die Kontaktaufnahme erlaubt?",
      mode: "rule_based",
    });
    expect(migrated.flow.edges).toEqual(
      expect.arrayContaining([
        { id: "edge-2", source: "step-1", target: "xor-1" },
        {
          id: "edge-3",
          source: "xor-1",
          target: "step-2",
          label: "Ja",
          determination: "Einwilligung liegt vor.",
          consequence: "Ansprache fortsetzen.",
        },
        {
          id: "edge-4",
          source: "xor-1",
          target: "end",
          label: "Nein",
          consequence: "Keine Ansprache.",
        },
      ]),
    );
  });

  test("erzeugt ohne V2-Entscheidungen die lineare Kette", () => {
    const migrated = migrateProcessUnderstanding(v2Fixture());

    expect(migrated.flow.nodes.map((node) => node.id)).toEqual([
      "start",
      "step-1",
      "step-2",
      "step-3",
      "step-4",
      "step-5",
      "end",
    ]);
    expect(migrated.flow.edges).toEqual([
      { id: "edge-1", source: "start", target: "step-1" },
      { id: "edge-2", source: "step-1", target: "step-2" },
      { id: "edge-3", source: "step-2", target: "step-3" },
      { id: "edge-4", source: "step-3", target: "step-4" },
      { id: "edge-5", source: "step-4", target: "step-5" },
      { id: "edge-6", source: "step-5", target: "end" },
    ]);
  });

  test("markiert mehrdeutige Entscheidungen als Wissenslücke und erfindet keinen Zweig", () => {
    const value = v2Fixture();
    (value.steps as Array<Record<string, unknown>>)[0]!.decisions = [
      {
        id: "decision-1",
        question: "Ist die Kontaktaufnahme erlaubt?",
        mode: "rule_based",
        options: [],
      },
      {
        id: "decision-2",
        question: "Muss eine Freigabe erfolgen?",
        mode: "professional_judgement",
        options: [],
      },
    ];

    const migrated = migrateProcessUnderstanding(value);

    expect(migrated.flow.nodes.some((node) => node.kind === "gateway")).toBe(
      false,
    );
    expect(migrated.knowledgeGaps).toEqual(
      expect.arrayContaining([
        "Migration: Entscheidungsverlauf zu „Ist die Kontaktaufnahme erlaubt?“ muss im Prozessbild geklärt werden.",
        "Migration: Entscheidungsverlauf zu „Muss eine Freigabe erfolgen?“ muss im Prozessbild geklärt werden.",
      ]),
    );
  });

  test("schreibt den Bestand atomar auf V3 und überspringt ihn beim zweiten Lauf", async () => {
    const root = await mkdtemp(join(tmpdir(), "process-flow-migration-"));
    roots.push(root);
    const path = join(
      root,
      "process-captures",
      "PROC-0001",
      "process-understanding.json",
    );
    await mkdir(join(root, "process-captures", "PROC-0001"), {
      recursive: true,
    });
    await writeFile(path, JSON.stringify(v2Fixture()));

    expect(await migrateProcessFlowStorage(root)).toEqual({ migrated: 1 });
    const migrated = JSON.parse(await readFile(path, "utf8"));
    expect(migrated.schemaVersion).toBe(3);
    const history = await readFile(
      join(root, "process-captures", "PROC-0001", "history.jsonl"),
      "utf8",
    );
    expect(history).toContain("process-flow-migrated");

    expect(await migrateProcessFlowStorage(root)).toEqual({ migrated: 1 });
    expect(
      await readFile(
        join(root, "process-captures", "PROC-0001", "history.jsonl"),
        "utf8",
      ),
    ).toBe(history);
  });
});
