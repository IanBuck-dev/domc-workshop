import type { OpportunityDiscoverySummary } from "./opportunity-types";
import type { ProcessCaptureRecord } from "./process-types";

export type ProcessListStatusId =
  | "needs_review"
  | "needs_input"
  | "analysis_needs_review"
  | "draft"
  | "capturing"
  | "ready_for_process_image"
  | "ready_for_analysis"
  | "analysis_running"
  | "completed"
  | "process_confirmed";

export interface ProcessListStatus {
  id: ProcessListStatusId;
  label: string;
  priority: number;
  tone: "neutral" | "info" | "success" | "warning" | "danger";
}

type ProcessListInput = Pick<
  ProcessCaptureRecord,
  | "id"
  | "state"
  | "profile"
  | "cover"
  | "mainAnswers"
  | "workCharacteristicAnswers"
  | "selectedUploadIds"
>;

const statuses: Record<ProcessListStatusId, ProcessListStatus> = {
  needs_review: {
    id: "needs_review",
    label: "Prüfung erforderlich",
    priority: 10,
    tone: "warning",
  },
  needs_input: {
    id: "needs_input",
    label: "Angaben ergänzen",
    priority: 20,
    tone: "warning",
  },
  analysis_needs_review: {
    id: "analysis_needs_review",
    label: "Potenzialanalyse prüfen",
    priority: 30,
    tone: "danger",
  },
  draft: {
    id: "draft",
    label: "Entwurf",
    priority: 40,
    tone: "neutral",
  },
  capturing: {
    id: "capturing",
    label: "In Erfassung",
    priority: 50,
    tone: "info",
  },
  ready_for_process_image: {
    id: "ready_for_process_image",
    label: "Prozessbild erstellen",
    priority: 60,
    tone: "info",
  },
  ready_for_analysis: {
    id: "ready_for_analysis",
    label: "Bereit für Potenzialanalyse",
    priority: 70,
    tone: "neutral",
  },
  analysis_running: {
    id: "analysis_running",
    label: "Potenzialanalyse läuft",
    priority: 80,
    tone: "info",
  },
  completed: {
    id: "completed",
    label: "Abgeschlossen",
    priority: 90,
    tone: "success",
  },
  process_confirmed: {
    id: "process_confirmed",
    label: "Prozess abgeschlossen",
    priority: 100,
    tone: "success",
  },
};

function started(process: ProcessListInput) {
  return (
    process.mainAnswers.length > 0 ||
    process.workCharacteristicAnswers.length > 0 ||
    process.selectedUploadIds.length > 0
  );
}

function analysisNeedsReview(opportunity: OpportunityDiscoverySummary) {
  return (
    opportunity.isStale ||
    opportunity.state === "hypotheses_failed" ||
    opportunity.state === "scenarios_failed"
  );
}

export function processListStatus(
  process: ProcessListInput,
  opportunity?: OpportunityDiscoverySummary,
): ProcessListStatus {
  if (process.state === "review_required") return statuses.needs_review;
  if (process.state === "follow_up_required") return statuses.needs_input;
  if (process.state === "capture_in_progress")
    return started(process) ? statuses.capturing : statuses.draft;
  if (process.state === "synthesis_ready")
    return statuses.ready_for_process_image;

  if (opportunity && analysisNeedsReview(opportunity))
    return statuses.analysis_needs_review;
  if (process.profile.version !== 2) return statuses.process_confirmed;
  if (!opportunity) return statuses.ready_for_analysis;
  if (
    opportunity.state === "hypotheses_queued" ||
    opportunity.state === "hypotheses_running" ||
    opportunity.state === "scenarios_running"
  )
    return statuses.analysis_running;
  return statuses.completed;
}

export function processListSearchText(process: ProcessListInput) {
  return [process.cover.processName, process.cover.department, process.id]
    .join(" ")
    .toLocaleLowerCase("de-DE");
}

export function processListStatusOptions() {
  return Object.values(statuses).sort(
    (left, right) => left.priority - right.priority,
  );
}
