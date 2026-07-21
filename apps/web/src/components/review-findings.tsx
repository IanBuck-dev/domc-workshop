import { AlertTriangle, CheckCircle2, Info, ShieldAlert } from "lucide-react";
import type { ReviewRecord } from "../lib/assessment-types";

export function ReviewFindings({
  review,
  onAcknowledge,
  onApplyCorrection,
}: {
  review: ReviewRecord;
  onAcknowledge: (id: string) => void;
  onApplyCorrection: (criterionId: string, value: number | boolean) => void;
}) {
  const findings = [...review.deterministicWarnings, ...review.findings].filter(
    (finding, index, all) =>
      all.findIndex((candidate) => candidate.id === finding.id) === index,
  );
  if (!findings.length)
    return (
      <div className="review-ok">
        <CheckCircle2 />
        <div>
          <b>Prüfung abgeschlossen</b>
          <p>Es wurden keine Unstimmigkeiten gefunden.</p>
        </div>
      </div>
    );
  return (
    <div className="finding-list">
      {findings.map((finding) => (
        <article className={`finding ${finding.severity}`} key={finding.id}>
          {finding.severity === "blocking" ? (
            <ShieldAlert />
          ) : finding.severity === "warning" ? (
            <AlertTriangle />
          ) : (
            <Info />
          )}
          <div>
            <b>
              {finding.severity === "blocking"
                ? "Muss geklärt werden"
                : finding.severity === "warning"
                  ? "Bitte prüfen"
                  : "Hinweis"}
            </b>
            <p>{finding.explanation}</p>
            {finding.proposedCorrection && (
              <div className="proposed-correction">
                <p>
                  <strong>Vorschlag:</strong>{" "}
                  {String(finding.proposedCorrection.value)}
                </p>
                <button
                  className="small-button"
                  onClick={() =>
                    onApplyCorrection(
                      finding.proposedCorrection!.criterionId,
                      finding.proposedCorrection!.value,
                    )
                  }
                >
                  Vorschlag übernehmen
                </button>
              </div>
            )}
            {finding.severity !== "blocking" && !finding.acknowledgedAt && (
              <button
                className="small-button"
                onClick={() => onAcknowledge(finding.id)}
              >
                Hinweis bestätigen
              </button>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
