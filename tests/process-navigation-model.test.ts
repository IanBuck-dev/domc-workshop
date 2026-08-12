import { describe, expect, test } from "bun:test";
import type { OpportunityDiscoverySummary } from "../apps/web/src/lib/opportunity-types.ts";
import {
  opportunityEntryPhase,
  processNavigationModel,
} from "../apps/web/src/lib/process-navigation-model.ts";
import type { ProcessCaptureRecord } from "../apps/web/src/lib/process-types.ts";

function process(
  state: ProcessCaptureRecord["state"],
  version = 2,
  overrides: Partial<ProcessCaptureRecord> = {},
) {
  return { state, profile: { version }, ...overrides } as Pick<
    ProcessCaptureRecord,
    "state" | "profile"
  >;
}

function opportunity(
  state: OpportunityDiscoverySummary["state"],
  overrides: Partial<OpportunityDiscoverySummary> = {},
): OpportunityDiscoverySummary {
  return {
    processId: "PROC-0001",
    state,
    isStale: false,
    hypothesisCount: 3,
    highConfidenceHypothesisCount: 2,
    scenarioCount: state === "completed" ? 3 : 0,
    updatedAt: "2026-07-26T20:00:00.000Z",
    ...overrides,
  };
}

describe("process navigation model", () => {
  test("maps every capture state to a module action", () => {
    expect(
      processNavigationModel(process("capture_in_progress")),
    ).toMatchObject({
      capture: { status: "In Bearbeitung", actionLabel: "Fortsetzen" },
    });
    expect(processNavigationModel(process("follow_up_required"))).toMatchObject(
      {
        capture: { status: "Angaben ergänzen", actionLabel: "Ergänzen" },
      },
    );
    expect(processNavigationModel(process("synthesis_ready"))).toMatchObject({
      capture: { status: "Angaben geprüft", actionLabel: "Fortfahren" },
    });
    expect(processNavigationModel(process("review_required"))).toMatchObject({
      capture: { status: "Prüfung offen", actionLabel: "Prüfen" },
    });
    expect(processNavigationModel(process("confirmed"))).toMatchObject({
      capture: { status: "Fachlich bestätigt", actionLabel: "Ansehen" },
      opportunity: { status: "Nicht gestartet", actionLabel: "Starten" },
    });
  });

  test("maps analysis states and gives stale results precedence", () => {
    expect(
      processNavigationModel(
        process("confirmed"),
        opportunity("hypotheses_running"),
      ),
    ).toMatchObject({
      opportunity: { actionLabel: "Fortschritt" },
    });
    expect(
      processNavigationModel(
        process("confirmed"),
        opportunity("scenarios_failed"),
      ),
    ).toMatchObject({
      opportunity: { status: "Unterbrochen" },
    });
    expect(
      processNavigationModel(
        process("confirmed"),
        opportunity("no_supported_hypotheses"),
      ),
    ).toMatchObject({
      opportunity: { actionLabel: "Ergebnis" },
    });
    expect(
      processNavigationModel(process("confirmed"), opportunity("completed")),
    ).toMatchObject({
      opportunity: { actionLabel: "Szenarien" },
    });
    expect(
      processNavigationModel(
        process("confirmed"),
        opportunity("completed", { isStale: true }),
      ),
    ).toMatchObject({
      opportunity: { status: "Veraltet", actionLabel: "Ansehen" },
    });
  });

  test("keeps analysis unavailable before confirmation and for legacy profiles", () => {
    expect(
      processNavigationModel(process("review_required")).opportunity,
    ).toMatchObject({
      status: "Nach Bestätigung",
      action: null,
      blockedReason:
        "Zuerst die Prozessaufnahme abschließen und das Prozessbild fachlich bestätigen.",
    });
    expect(
      processNavigationModel(process("confirmed", 1)).opportunity,
    ).toMatchObject({
      status: "Nicht verfügbar",
      action: null,
      blockedReason:
        "Dieser Prozess wurde in einer früheren Fassung erfasst und enthält die dafür nötigen Angaben nicht.",
    });
  });

  test("offers the real PDD only for confirmed profile-3 definitions", () => {
    const confirmed = {
      confirmedAt: "2026-08-12T10:00:00.000Z",
      understanding: {},
    } as Partial<ProcessCaptureRecord>;
    expect(
      processNavigationModel(process("confirmed", 2, confirmed)).pdd,
    ).toMatchObject({ status: "Nicht verfügbar", action: null });
    expect(
      processNavigationModel(
        process("confirmed", 3, {
          ...confirmed,
          currentStateDetails: {},
        } as Partial<ProcessCaptureRecord>),
      ).pdd,
    ).toMatchObject({ action: "export_pdd" });
    expect(
      processNavigationModel(process("confirmed", 3, confirmed)).pdd,
    ).toMatchObject({ status: "Nicht verfügbar", action: null });
  });

  test("nennt bei jedem gesperrten Modul einen Grund und sonst keinen", () => {
    const states: Parameters<typeof process>[0][] = [
      "capture_in_progress",
      "follow_up_required",
      "synthesis_ready",
      "review_required",
      "confirmed",
    ];
    const analyses: (OpportunityDiscoverySummary | undefined)[] = [
      undefined,
      opportunity("hypotheses_running"),
      opportunity("scenarios_failed"),
      opportunity("no_supported_hypotheses"),
      opportunity("completed"),
      opportunity("completed", { isStale: true }),
    ];
    for (const version of [1, 2, 3])
      for (const state of states)
        for (const analysis of analyses)
          for (const module of Object.values(
            processNavigationModel(process(state, version), analysis),
          )) {
            if (typeof module === "string") continue;
            // Eine Karte ohne Schaltfläche muss sagen, was ihr fehlt.
            if (module.action === null)
              expect(module.blockedReason).toBeTruthy();
            else expect(module.blockedReason).toBeNull();
          }
  });

  test("öffnet vorhandene Szenarien direkt und sonst die Hypothesen", () => {
    expect(opportunityEntryPhase()).toBe("hypotheses");
    expect(opportunityEntryPhase(opportunity("scenarios_running"))).toBe(
      "hypotheses",
    );
    expect(opportunityEntryPhase(opportunity("completed"))).toBe("scenarios");
    expect(
      opportunityEntryPhase(
        opportunity("completed", { isStale: true, scenarioCount: 3 }),
      ),
    ).toBe("scenarios");
  });
});
