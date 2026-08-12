import type { OpportunityDiscoverySummary } from "./opportunity-types";
import type { ProcessCaptureRecord } from "./process-types";

type ProcessInput = Pick<ProcessCaptureRecord, "state"> &
  Partial<
    Pick<
      ProcessCaptureRecord,
      | "confirmationQuality"
      | "confirmedAt"
      | "understanding"
      | "currentStateDetails"
    >
  > & {
    profile: Pick<ProcessCaptureRecord["profile"], "version">;
  };

export type NavigationTone =
  "neutral" | "info" | "success" | "warning" | "danger";

export interface ModuleNavigationState {
  status: string;
  tone: NavigationTone;
  actionLabel: string | null;
  action:
    "capture" | "start_opportunity" | "view_opportunity" | "export_pdd" | null;
  /**
   * Steht nur bei gesperrten Modulen: der Satz nennt, was fehlt. Ein Etikett
   * wie „Nach Bestätigung“ allein sagt nicht, was zu tun ist.
   */
  blockedReason: string | null;
}

export interface ProcessNavigationModel {
  capture: ModuleNavigationState;
  opportunity: ModuleNavigationState;
  pdd: ModuleNavigationState;
}

export function opportunityEntryPhase(
  opportunity?: OpportunityDiscoverySummary,
): "hypotheses" | "scenarios" {
  return opportunity && opportunity.scenarioCount > 0
    ? "scenarios"
    : "hypotheses";
}

const captureStates: Record<
  ProcessCaptureRecord["state"],
  ModuleNavigationState
> = {
  capture_in_progress: {
    status: "In Bearbeitung",
    tone: "neutral",
    actionLabel: "Fortsetzen",
    action: "capture",
    blockedReason: null,
  },
  follow_up_required: {
    status: "Angaben ergänzen",
    tone: "warning",
    actionLabel: "Ergänzen",
    action: "capture",
    blockedReason: null,
  },
  synthesis_ready: {
    status: "Angaben geprüft",
    tone: "info",
    actionLabel: "Fortfahren",
    action: "capture",
    blockedReason: null,
  },
  review_required: {
    status: "Prüfung offen",
    tone: "warning",
    actionLabel: "Prüfen",
    action: "capture",
    blockedReason: null,
  },
  confirmed: {
    status: "Fachlich bestätigt",
    tone: "success",
    actionLabel: "Ansehen",
    action: "capture",
    blockedReason: null,
  },
};

export function processNavigationModel(
  process: ProcessInput,
  opportunity?: OpportunityDiscoverySummary,
): ProcessNavigationModel {
  const capture = captureStates[process.state];
  const opportunityState = opportunityModuleState(process, opportunity);
  return {
    capture,
    opportunity: opportunityState,
    pdd: pddModuleState(process),
  };
}

function pddModuleState(process: ProcessInput): ModuleNavigationState {
  if (
    process.state !== "confirmed" ||
    !process.understanding ||
    !process.confirmedAt
  )
    return {
      status: "Nach Bestätigung",
      tone: "neutral",
      actionLabel: null,
      action: null,
      blockedReason:
        "Zuerst die Prozessaufnahme abschließen und das Prozessbild fachlich bestätigen.",
    };
  if (process.profile.version !== 3 || !process.currentStateDetails)
    return {
      status: "Nicht verfügbar",
      tone: "neutral",
      actionLabel: null,
      action: null,
      blockedReason:
        "Dieser Prozess wurde ohne die erforderlichen PDD-Ist-Angaben erfasst.",
    };
  if (process.confirmationQuality === "with_gaps")
    return {
      status: "Offene Punkte enthalten",
      tone: "warning",
      actionLabel: "Excel erstellen",
      action: "export_pdd",
      blockedReason: null,
    };
  return {
    status: "Bereit",
    tone: "success",
    actionLabel: "Excel erstellen",
    action: "export_pdd",
    blockedReason: null,
  };
}

function opportunityModuleState(
  process: ProcessInput,
  opportunity?: OpportunityDiscoverySummary,
): ModuleNavigationState {
  if (process.state !== "confirmed")
    return {
      status: "Nach Bestätigung",
      tone: "neutral",
      actionLabel: null,
      action: null,
      blockedReason:
        "Zuerst die Prozessaufnahme abschließen und das Prozessbild fachlich bestätigen.",
    };
  if (![2, 3].includes(process.profile.version))
    return {
      status: "Nicht verfügbar",
      tone: "neutral",
      actionLabel: null,
      action: null,
      blockedReason:
        "Dieser Prozess wurde in einer früheren Fassung erfasst und enthält die dafür nötigen Angaben nicht.",
    };
  if (!opportunity)
    return {
      status: "Nicht gestartet",
      tone: "neutral",
      actionLabel: "Starten",
      action: "start_opportunity",
      blockedReason: null,
    };
  if (opportunity.isStale)
    return {
      status: "Veraltet",
      tone: "warning",
      actionLabel: "Ansehen",
      action: "view_opportunity",
      blockedReason: null,
    };
  if (
    opportunity.state === "hypotheses_queued" ||
    opportunity.state === "hypotheses_running" ||
    opportunity.state === "scenarios_running"
  )
    return {
      status: "Läuft",
      tone: "info",
      actionLabel: "Fortschritt",
      action: "view_opportunity",
      blockedReason: null,
    };
  if (opportunity.state.endsWith("failed"))
    return {
      status: "Unterbrochen",
      tone: "danger",
      actionLabel: "Prüfen",
      action: "view_opportunity",
      blockedReason: null,
    };
  if (opportunity.state === "no_supported_hypotheses")
    return {
      status: "Abgeschlossen",
      tone: "success",
      actionLabel: "Ergebnis",
      action: "view_opportunity",
      blockedReason: null,
    };
  return {
    status: "Abgeschlossen",
    tone: "success",
    actionLabel: "Szenarien",
    action: "view_opportunity",
    blockedReason: null,
  };
}
