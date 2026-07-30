import { describe, expect, test } from "bun:test";
import type { OpportunityDiscoverySummary } from "../apps/web/src/lib/opportunity-types.ts";
import {
  processListSearchText,
  processListStatus,
} from "../apps/web/src/lib/process-list-model.ts";
import type { ProcessCaptureRecord } from "../apps/web/src/lib/process-types.ts";

function process(
  state: ProcessCaptureRecord["state"],
  overrides: Partial<ProcessCaptureRecord> = {},
) {
  return {
    id: "PROC-0007",
    state,
    profile: { version: 2 },
    cover: { processName: "Kfz-Schadenaufnahme", department: "Schäden" },
    mainAnswers: [],
    workCharacteristicAnswers: [],
    selectedUploadIds: [],
    ...overrides,
  } as ProcessCaptureRecord;
}

function opportunity(
  state: OpportunityDiscoverySummary["state"],
  overrides: Partial<OpportunityDiscoverySummary> = {},
): OpportunityDiscoverySummary {
  return {
    processId: "PROC-0007",
    state,
    isStale: false,
    hypothesisCount: 3,
    highConfidenceHypothesisCount: 2,
    scenarioCount: state === "completed" ? 3 : 0,
    updatedAt: "2026-07-30T10:00:00.000Z",
    ...overrides,
  };
}

describe("process list status", () => {
  test("covers every capture state including draft and started capture", () => {
    expect(processListStatus(process("capture_in_progress"))).toMatchObject({
      id: "draft",
      label: "Entwurf",
      priority: 40,
    });
    expect(
      processListStatus(
        process("capture_in_progress", {
          mainAnswers: [
            {
              topicId: "purpose-scope",
              text: "Begonnen.",
              answeredAt: "2026-07-30T10:00:00.000Z",
            },
          ],
        }),
      ),
    ).toMatchObject({ id: "capturing", label: "In Erfassung", priority: 50 });
    expect(processListStatus(process("follow_up_required"))).toMatchObject({
      id: "needs_input",
      priority: 20,
    });
    expect(processListStatus(process("synthesis_ready"))).toMatchObject({
      id: "ready_for_process_image",
      priority: 60,
    });
    expect(processListStatus(process("review_required"))).toMatchObject({
      id: "needs_review",
      priority: 10,
    });
  });

  test("covers every confirmed-process and analysis state", () => {
    expect(processListStatus(process("confirmed"))).toMatchObject({
      id: "ready_for_analysis",
      priority: 70,
    });
    expect(
      processListStatus(
        process("confirmed", { profile: { id: "compact-v1", version: 1 } }),
        undefined,
      ),
    ).toMatchObject({ id: "process_confirmed", priority: 100 });
    for (const state of [
      "hypotheses_queued",
      "hypotheses_running",
      "scenarios_running",
    ] as const)
      expect(
        processListStatus(process("confirmed"), opportunity(state)),
      ).toMatchObject({
        id: "analysis_running",
        priority: 80,
      });
    for (const state of ["completed", "no_supported_hypotheses"] as const)
      expect(
        processListStatus(process("confirmed"), opportunity(state)),
      ).toMatchObject({
        id: "completed",
        priority: 90,
      });
    for (const state of ["hypotheses_failed", "scenarios_failed"] as const)
      expect(
        processListStatus(process("confirmed"), opportunity(state)),
      ).toMatchObject({
        id: "analysis_needs_review",
        priority: 30,
      });
    expect(
      processListStatus(
        process("confirmed"),
        opportunity("completed", { isStale: true }),
      ),
    ).toMatchObject({ id: "analysis_needs_review", priority: 30 });
  });

  test("keeps incomplete capture ahead of a technically inconsistent analysis", () => {
    expect(
      processListStatus(
        process("review_required"),
        opportunity("scenarios_failed"),
      ),
    ).toMatchObject({ id: "needs_review" });
  });

  test("search text includes name, department and invisible process identifier", () => {
    const text = processListSearchText(process("capture_in_progress"));
    expect(text).toContain("kfz-schadenaufnahme");
    expect(text).toContain("schäden");
    expect(text).toContain("proc-0007");
  });
});
