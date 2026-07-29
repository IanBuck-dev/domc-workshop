import { CheckCircle2, MessageSquareText } from "lucide-react";
import type { ProcessCaptureRecord } from "../lib/process-types";

export function ProcessValidationComment({
  question,
  hasValidation,
  id,
}: {
  question?: ProcessCaptureRecord["followUps"][number];
  hasValidation: boolean;
  id: string;
}) {
  if (!question)
    return (
      <aside id={id} className="validation-comment is-clear" aria-live="polite">
        <CheckCircle2 aria-hidden="true" />
        <div>
          <b>
            {hasValidation ? "Keine offene Rückfrage" : "Noch nicht geprüft"}
          </b>
          <p>
            {hasValidation
              ? "Für diesen Themenblock besteht derzeit keine materielle Rückfrage."
              : "Nach der Prüfung erscheint hier die fachliche Rückmeldung."}
          </p>
        </div>
      </aside>
    );
  return (
    <aside id={id} className="validation-comment is-open" aria-live="polite">
      <MessageSquareText aria-hidden="true" />
      <div>
        <small>Offene Rückfrage</small>
        <b>{question.question}</b>
        <p>{question.rationale}</p>
        <strong>Ergänzen Sie Ihre Angabe links.</strong>
      </div>
    </aside>
  );
}
