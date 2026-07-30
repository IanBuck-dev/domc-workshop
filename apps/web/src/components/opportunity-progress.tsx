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
    <nav
      aria-label="Fortschritt der Potenzialanalyse"
      className="w-full sm:w-[22rem]"
    >
      <ol className="flex items-start">
        <li className="relative flex flex-1 justify-center after:absolute after:left-1/2 after:top-4 after:h-px after:w-full after:bg-border after:content-['']">
          <Link
            to={`/processes/${processId}/opportunities/hypotheses`}
            aria-current={active === "hypotheses" ? "step" : undefined}
            className="relative z-10 grid justify-items-center gap-2 text-sm font-semibold text-primary"
          >
            <span
              className={
                active === "hypotheses"
                  ? "grid size-8 place-items-center rounded-full border-2 border-primary bg-primary text-primary-foreground"
                  : "grid size-8 place-items-center rounded-full border-2 border-primary bg-secondary text-primary"
              }
            >
              1
            </span>
            <span>Potenzialhypothesen</span>
          </Link>
        </li>
        <li className="relative flex flex-1 justify-center">
          {scenariosAvailable ? (
            <Link
              to={`/processes/${processId}/opportunities/scenarios`}
              aria-current={active === "scenarios" ? "step" : undefined}
              className="relative z-10 grid justify-items-center gap-2 text-sm font-semibold text-primary"
            >
              <span
                className={
                  active === "scenarios"
                    ? "grid size-8 place-items-center rounded-full border-2 border-primary bg-primary text-primary-foreground"
                    : "grid size-8 place-items-center rounded-full border-2 border-primary bg-secondary text-primary"
                }
              >
                2
              </span>
              <span>KI-Szenarien</span>
            </Link>
          ) : (
            <span
              className="relative z-10 grid justify-items-center gap-2 text-sm font-semibold text-muted-foreground"
              aria-disabled="true"
            >
              <span className="grid size-8 place-items-center rounded-full border-2 border-border bg-card">
                2
              </span>
              <span>KI-Szenarien</span>
            </span>
          )}
        </li>
      </ol>
    </nav>
  );
}
