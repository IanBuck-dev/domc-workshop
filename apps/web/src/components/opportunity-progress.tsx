import { Link } from "react-router-dom";
import type { OpportunityDiscoveryPublicRecord } from "../lib/opportunity-types";

export function OpportunityProgress({
  record,
  processId,
  active,
}: {
  record: OpportunityDiscoveryPublicRecord;
  processId: string;
  active: "hypotheses" | "scenarios" | "assessment";
}) {
  const scenariosAvailable = [
    "scenarios_running",
    "scenarios_failed",
    "completed",
  ].includes(record.state);
  // Die Bewertung ist erst nach abgeschlossener Szenarioanalyse erreichbar; sie
  // steht trotzdem immer im Fortschritt, damit der Weg von Anfang an sichtbar ist.
  const assessmentAvailable = record.state === "completed";
  return (
    <nav
      aria-label="Fortschritt der Potenzialanalyse"
      className="w-full sm:w-[30rem] xl:shrink-0"
    >
      <ol className="flex items-start">
        <li className="relative flex flex-1 justify-center after:absolute after:left-1/2 after:top-4 after:h-px after:w-full after:bg-border after:content-['']">
          <Link
            to={`/processes/${processId}/opportunities/hypotheses`}
            aria-current={active === "hypotheses" ? "step" : undefined}
            className="relative z-10 grid justify-items-center gap-2 text-label text-primary"
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
        <li className="relative flex flex-1 justify-center after:absolute after:left-1/2 after:top-4 after:h-px after:w-full after:bg-border after:content-['']">
          {scenariosAvailable ? (
            <Link
              to={`/processes/${processId}/opportunities/scenarios`}
              aria-current={active === "scenarios" ? "step" : undefined}
              className="relative z-10 grid justify-items-center gap-2 text-label text-primary"
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
              className="relative z-10 grid justify-items-center gap-2 text-label text-muted-foreground"
              aria-disabled="true"
            >
              <span className="grid size-8 place-items-center rounded-full border-2 border-border bg-card">
                2
              </span>
              <span>KI-Szenarien</span>
            </span>
          )}
        </li>
        <li className="relative flex flex-1 justify-center">
          {assessmentAvailable ? (
            <Link
              to={`/processes/${processId}/opportunities/agentic-assessment`}
              aria-current={active === "assessment" ? "step" : undefined}
              className="relative z-10 grid justify-items-center gap-2 text-label text-primary"
            >
              <span
                className={
                  active === "assessment"
                    ? "grid size-8 place-items-center rounded-full border-2 border-primary bg-primary text-primary-foreground"
                    : "grid size-8 place-items-center rounded-full border-2 border-primary bg-secondary text-primary"
                }
              >
                3
              </span>
              <span>Potenzialbewertung</span>
            </Link>
          ) : (
            <span
              className="relative z-10 grid justify-items-center gap-2 text-label text-muted-foreground"
              aria-disabled="true"
            >
              <span className="grid size-8 place-items-center rounded-full border-2 border-border bg-card">
                3
              </span>
              <span>Potenzialbewertung</span>
            </span>
          )}
        </li>
      </ol>
    </nav>
  );
}
