import type { OpportunityDiscoverySummary } from "./opportunity-types";
import type { ProcessCaptureRecord } from "./process-types";

type ProcessInput = Pick<ProcessCaptureRecord, "state"> & {
  profile: Pick<ProcessCaptureRecord["profile"], "version">;
};

export type NavigationTone =
  "neutral" | "info" | "success" | "warning" | "danger";

export interface ModuleNavigationState {
  status: string;
  tone: NavigationTone;
  actionLabel: string | null;
  action: "capture" | "start_opportunity" | "view_opportunity" | null;
}

export interface ProcessNavigationModel {
  listStatus: string;
  listTone: NavigationTone;
  capture: ModuleNavigationState;
  opportunity: ModuleNavigationState;
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
  },
  follow_up_required: {
    status: "Rückfragen offen",
    tone: "warning",
    actionLabel: "Antworten",
    action: "capture",
  },
  synthesis_ready: {
    status: "Bereit",
    tone: "info",
    actionLabel: "Erstellen",
    action: "capture",
  },
  review_required: {
    status: "Prüfung offen",
    tone: "warning",
    actionLabel: "Prüfen",
    action: "capture",
  },
  confirmed: {
    status: "Fachlich bestätigt",
    tone: "success",
    actionLabel: "Ansehen",
    action: "capture",
  },
};

export function processNavigationModel(
  process: ProcessInput,
  opportunity?: OpportunityDiscoverySummary,
): ProcessNavigationModel {
  const capture = captureStates[process.state];
  const opportunityState = opportunityModuleState(process, opportunity);
  const list = listState(process.state, opportunity);
  return {
    listStatus: list.status,
    listTone: list.tone,
    capture,
    opportunity: opportunityState,
  };
}

function listState(
  state: ProcessCaptureRecord["state"],
  opportunity?: OpportunityDiscoverySummary,
) {
  if (opportunity?.isStale)
    return { status: "Veraltet", tone: "warning" } as const;
  if (opportunity) {
    if (
      opportunity.state === "hypotheses_queued" ||
      opportunity.state === "hypotheses_running" ||
      opportunity.state === "scenarios_running"
    )
      return { status: "Analyse läuft", tone: "info" } as const;
    if (opportunity.state.endsWith("failed"))
      return { status: "Analyse prüfen", tone: "danger" } as const;
    if (opportunity.state === "no_supported_hypotheses")
      return { status: "Analysiert", tone: "success" } as const;
    if (opportunity.state === "completed")
      return {
        status: `${opportunity.scenarioCount} Szenarien`,
        tone: "success",
      } as const;
  }
  if (state === "capture_in_progress" || state === "synthesis_ready")
    return { status: "In Erfassung", tone: "neutral" } as const;
  if (state === "follow_up_required")
    return { status: "Rückfragen", tone: "warning" } as const;
  if (state === "review_required")
    return { status: "Zur Prüfung", tone: "warning" } as const;
  return { status: "Bestätigt", tone: "success" } as const;
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
    };
  if (process.profile.version !== 2)
    return {
      status: "Nicht verfügbar",
      tone: "neutral",
      actionLabel: null,
      action: null,
    };
  if (!opportunity)
    return {
      status: "Nicht gestartet",
      tone: "neutral",
      actionLabel: "Starten",
      action: "start_opportunity",
    };
  if (opportunity.isStale)
    return {
      status: "Veraltet",
      tone: "warning",
      actionLabel: "Ansehen",
      action: "view_opportunity",
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
    };
  if (opportunity.state.endsWith("failed"))
    return {
      status: "Unterbrochen",
      tone: "danger",
      actionLabel: "Prüfen",
      action: "view_opportunity",
    };
  if (opportunity.state === "no_supported_hypotheses")
    return {
      status: "Abgeschlossen",
      tone: "success",
      actionLabel: "Ergebnis",
      action: "view_opportunity",
    };
  return {
    status: "Abgeschlossen",
    tone: "success",
    actionLabel: "Szenarien",
    action: "view_opportunity",
  };
}
