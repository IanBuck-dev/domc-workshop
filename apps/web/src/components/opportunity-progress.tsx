import { Link } from "react-router-dom";
import type { OpportunityDiscoveryPublicRecord } from "../lib/opportunity-types";

export function OpportunityProgress({
  record,
  processId,
  active,
}: {
  record: OpportunityDiscoveryPublicRecord;
  processId: string;
  active: "hypotheses" | "scenarios";
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
          <Link
            to={`/processes/${processId}/opportunities/hypotheses`}
            aria-current={active === "hypotheses" ? "step" : undefined}
          >
            <span className="opportunity-step-number">1</span>
            <small>Potenzialhypothesen</small>
          </Link>
        </li>
        <li
          className={
            active === "scenarios"
              ? "active"
              : scenariosAvailable
                ? "available"
                : ""
          }
        >
          {scenariosAvailable ? (
            <Link
              to={`/processes/${processId}/opportunities/scenarios`}
              aria-current={active === "scenarios" ? "step" : undefined}
            >
              <span className="opportunity-step-number">2</span>
              <small>KI-Szenarien</small>
            </Link>
          ) : (
            <span className="opportunity-step-disabled" aria-disabled="true">
              <span className="opportunity-step-number">2</span>
              <small>KI-Szenarien</small>
            </span>
          )}
        </li>
      </ol>
    </div>
  );
}
