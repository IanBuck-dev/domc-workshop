import type { OpportunityDiscoveryPublicRecord } from "../lib/opportunity-types";

export function OpportunityProgress({
  record,
  isStale,
  active,
  onSelect,
}: {
  record: OpportunityDiscoveryPublicRecord;
  isStale: boolean;
  active: "hypotheses" | "scenarios";
  onSelect: (value: "hypotheses" | "scenarios") => void;
}) {
  const scenariosAvailable = [
    "scenarios_running",
    "scenarios_failed",
    "completed",
  ].includes(record.state);
  return (
    <div className="opportunity-progress-wrap">
      <ol
        className="opportunity-progress"
        aria-label="Fortschritt der Potenzialanalyse"
      >
        <li className={active === "hypotheses" ? "active" : "complete"}>
          <button type="button" onClick={() => onSelect("hypotheses")}>
            <span>1</span>
            <small>Potenzialhypothesen</small>
          </button>
        </li>
        <li
          className={
            active === "scenarios"
              ? "active"
              : record.state === "completed"
                ? "complete"
                : ""
          }
        >
          <button
            type="button"
            disabled={!scenariosAvailable}
            onClick={() => onSelect("scenarios")}
          >
            <span>2</span>
            <small>KI-Szenarien</small>
          </button>
        </li>
      </ol>
      <p className="opportunity-progress-status" aria-live="polite">
        {progressCopy(record.state, isStale)}
      </p>
    </div>
  );
}

function progressCopy(
  state: OpportunityDiscoveryPublicRecord["state"],
  isStale: boolean,
) {
  if (isStale)
    return "Prozess später geändert · Die vorhandene Analyse bleibt read-only.";
  if (state === "hypotheses_queued" || state === "hypotheses_running")
    return "Phase 1 läuft · Danach folgen Szenarien aus hoch-konfidenten Hypothesen.";
  if (state === "hypotheses_failed")
    return "Phase 1 unterbrochen · Nächster Schritt: technischen Retry starten.";
  if (state === "no_supported_hypotheses")
    return "Analyse abgeschlossen · Keine ausreichend belegten Szenarien.";
  if (state === "scenarios_running")
    return "Phase 2 läuft · Drei Szenarien werden erstellt.";
  if (state === "scenarios_failed")
    return "Phase 2 unterbrochen · Nächster Schritt: technischen Retry starten.";
  return "Analyse abgeschlossen · Drei Szenarien sind verfügbar.";
}
