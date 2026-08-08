import { describe, expect, test } from "bun:test";
import {
  documentCoverageSchema,
  processCaptureConfigSchema,
  processFlowIdentifierSchema,
  processUnderstandingSchema,
  topicIds,
  validateProcessFlow,
  workCharacteristicAnswersSchema,
} from "../packages/domain/src/process-understanding.ts";
import {
  insertProcessStep,
  moveProcessStep,
  referencesToStep,
  removeProcessStep,
} from "../packages/domain/src/process-understanding-editing.ts";
import {
  answers,
  processConfig,
  understanding,
  workCharacteristicAnswers,
} from "./process-fixtures.ts";

function issues(value: ReturnType<typeof understanding>) {
  return validateProcessFlow(value.flow, value.steps);
}

function expectIssue(value: ReturnType<typeof understanding>, code: string) {
  expect(issues(value).some((issue) => issue.code === code)).toBe(true);
  expect(() => processUnderstandingSchema.parse(value)).toThrow();
}

describe("process-understanding V3", () => {
  test("keeps the compact-v1 configuration and work-characteristic contract", async () => {
    const config = await processConfig();
    expect(config.topics.map((topic) => topic.id)).toEqual([...topicIds]);
    expect(
      workCharacteristicAnswersSchema.parse(workCharacteristicAnswers()),
    ).toHaveLength(4);
    expect(() =>
      processCaptureConfigSchema.parse({
        ...config,
        topics: config.topics.slice(0, 4),
      }),
    ).toThrow();
    expect(answers()).toHaveLength(5);
  });

  test("accepts the minimal canonical graph and exposes no decisions field", () => {
    const value = understanding(1);
    expect(processUnderstandingSchema.parse(value).schemaVersion).toBe(3);
    expect(issues(value)).toEqual([]);
    expect(() =>
      processUnderstandingSchema.parse({
        ...value,
        decisions: value.controls,
      }),
    ).toThrow();
    expect(() =>
      processUnderstandingSchema.parse({
        ...value,
        steps: [{ ...value.steps[0], decisions: [] }],
      }),
    ).toThrow();
  });

  test("accepts only typed graph identifiers", () => {
    for (const id of ["start", "end", "step-1", "xor-2", "edge-3"])
      expect(processFlowIdentifierSchema.parse(id)).toBe(id);
    for (const id of ["step-0", "xor-0", "node-1", "edge-a"])
      expect(() => processFlowIdentifierSchema.parse(id)).toThrow();
  });

  test("allows a gateway branch with a return path to an earlier step", () => {
    const value = understanding(2);
    value.flow.nodes.splice(2, 0, {
      id: "xor-1",
      kind: "gateway",
      question: "Sind die Angaben vollständig?",
      mode: "rule_based",
    });
    value.flow.edges = [
      { id: "edge-1", source: "start", target: "step-1" },
      { id: "edge-2", source: "step-1", target: "xor-1" },
      {
        id: "edge-3",
        source: "xor-1",
        target: "step-2",
        label: "Ja",
        determination: "Alle Pflichtangaben liegen vor.",
      },
      {
        id: "edge-4",
        source: "xor-1",
        target: "step-1",
        label: "Nein",
        consequence: "Angaben werden ergänzt.",
      },
      { id: "edge-5", source: "step-2", target: "end" },
    ];
    expect(issues(value)).toEqual([]);
    expect(processUnderstandingSchema.parse(value).flow.nodes).toHaveLength(5);
  });

  test("reports every graph rule with structured issue codes", () => {
    const cases: Array<{
      code: string;
      mutate: (value: ReturnType<typeof understanding>) => void;
    }> = [
      {
        code: "start_count",
        mutate: (value) =>
          value.flow.nodes.push({ id: "step-9", kind: "startEvent" }),
      },
      {
        code: "end_count",
        mutate: (value) =>
          value.flow.nodes.push({ id: "step-9", kind: "endEvent" }),
      },
      {
        code: "unknown_target",
        mutate: (value) => {
          value.flow.edges[0]!.target = "step-99";
        },
      },
      {
        code: "unknown_source",
        mutate: (value) => {
          value.flow.edges[0]!.source = "step-99";
        },
      },
      {
        code: "duplicate_node_id",
        mutate: (value) => {
          value.flow.nodes[2]!.id = "step-1";
        },
      },
      {
        code: "duplicate_edge_id",
        mutate: (value) => {
          value.flow.edges[1]!.id = "edge-1";
        },
      },
      {
        code: "duplicate_graph_id",
        mutate: (value) => {
          value.flow.edges[0]!.id = "step-1";
        },
      },
      {
        code: "duplicate_step_reference",
        mutate: (value) => {
          const node = value.flow.nodes.find(
            (item) => item.kind === "step" && item.id === "step-2",
          );
          if (node?.kind === "step") node.stepId = "step-1";
        },
      },
      {
        code: "unreachable_node",
        mutate: (value) => {
          value.flow.edges[0]!.target = "step-2";
        },
      },
      {
        code: "dead_end",
        mutate: (value) => {
          value.flow.edges[value.flow.edges.length - 1]!.target = "step-1";
        },
      },
      {
        code: "step_degree",
        mutate: (value) =>
          value.flow.edges.push({
            id: "edge-99",
            source: "step-1",
            target: "end",
          }),
      },
      {
        code: "start_degree",
        mutate: (value) =>
          value.flow.edges.push({
            id: "edge-99",
            source: "start",
            target: "step-1",
          }),
      },
      {
        code: "end_degree",
        mutate: (value) =>
          value.flow.edges.push({
            id: "edge-99",
            source: "end",
            target: "end",
          }),
      },
      {
        code: "missing_step_node",
        mutate: (value) => {
          value.flow.nodes = value.flow.nodes.filter(
            (node) => node.id !== "step-2",
          );
        },
      },
      {
        code: "unknown_step",
        mutate: (value) => {
          const node = value.flow.nodes.find((item) => item.kind === "step");
          if (node?.kind === "step") node.stepId = "step-missing";
        },
      },
      {
        code: "gateway_edge_detail",
        mutate: (value) => {
          value.flow.edges[0]!.determination = "Unzulässig";
        },
      },
    ];
    for (const { code, mutate } of cases) {
      const value = understanding(2);
      mutate(value);
      expectIssue(value, code);
    }
  });

  test("enforces gateway outgoing branches and labels", () => {
    const value = understanding(1);
    value.flow.nodes.splice(2, 0, {
      id: "xor-1",
      kind: "gateway",
      question: "Ist der Vorgang vollständig?",
      mode: "unknown",
    });
    value.flow.edges = [
      { id: "edge-1", source: "start", target: "step-1" },
      { id: "edge-2", source: "step-1", target: "xor-1" },
      { id: "edge-3", source: "xor-1", target: "end" },
    ];
    expectIssue(value, "gateway_degree");
    expectIssue(value, "gateway_label");
  });

  test("enforces gateway ownership and gateway branch targets", () => {
    const orphan = understanding(1);
    orphan.flow.nodes.push({
      id: "xor-1",
      kind: "gateway",
      question: "Ist der Vorgang vollständig?",
      mode: "unknown",
    });
    expectIssue(orphan, "gateway_source");

    const invalidTarget = understanding(1);
    invalidTarget.flow.nodes.splice(2, 0, {
      id: "xor-1",
      kind: "gateway",
      question: "Ist der Vorgang vollständig?",
      mode: "unknown",
    });
    invalidTarget.flow.edges = [
      { id: "edge-1", source: "start", target: "step-1" },
      { id: "edge-2", source: "step-1", target: "xor-1" },
      { id: "edge-3", source: "xor-1", target: "step-1", label: "Ja" },
      { id: "edge-4", source: "xor-1", target: "start", label: "Nein" },
    ];
    expectIssue(invalidTarget, "gateway_target");
  });

  test("preserves graph IDs while editing steps and reports graph references", () => {
    const original = understanding(2);
    const inserted = insertProcessStep(original, 1, "step-new");
    expect(inserted.steps.map((step) => step.order)).toEqual([1, 2, 3]);
    expect(
      inserted.flow.nodes.find(
        (node) => node.kind === "step" && node.stepId === "step-new",
      ),
    ).toMatchObject({ id: "step-3" });

    const moved = moveProcessStep(inserted, "step-1", 1);
    expect(
      moved.flow.nodes.find(
        (node) => node.kind === "step" && node.stepId === "step-1",
      ),
    ).toMatchObject({ id: "step-1" });
    expect(referencesToStep(original, "step-2")).toEqual([
      { edgeId: "edge-2", sourceNodeId: "step-1" },
    ]);
    expect(() => removeProcessStep(original, "step-2")).toThrow("Ablaufkante");
    expect(() => removeProcessStep(inserted, "step-new")).toThrow(
      "Ablaufkante",
    );
    expect(validateProcessFlow(inserted.flow, inserted.steps)).toEqual([]);
  });

  test("retains evidence and document-coverage validation", () => {
    const invalidEvidence = understanding(1);
    invalidEvidence.purpose.evidenceIds = ["missing"];
    expect(() => processUnderstandingSchema.parse(invalidEvidence)).toThrow(
      "Unknown evidence ID",
    );
    expect(() =>
      documentCoverageSchema.parse({
        uploadId: "00000000-0000-4000-8000-000000000001",
        name: "prozess.pdf",
        status: "partial",
        processedCharacters: 12,
        limitation: null,
      }),
    ).toThrow("requires a limitation");
  });
});
