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
      <aside
        id={id}
        className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 rounded-lg border border-border bg-muted p-4 text-sm"
        aria-live="polite"
      >
        <CheckCircle2
          className="mt-0.5 size-5 text-primary"
          aria-hidden="true"
        />
        <div className="space-y-1">
          <b className="block">
            {hasValidation ? "Keine offene Rückfrage" : "Noch nicht geprüft"}
          </b>
          <p className="leading-5 text-muted-foreground">
            {hasValidation
              ? "Für diesen Themenblock besteht derzeit keine materielle Rückfrage."
              : "Nach der Prüfung erscheint hier die fachliche Rückmeldung."}
          </p>
        </div>
      </aside>
    );
  return (
    <aside
      id={id}
      className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 rounded-lg border border-amber-700/30 bg-amber-50 p-4 text-sm"
      aria-live="polite"
    >
      <MessageSquareText
        className="mt-0.5 size-5 text-amber-800"
        aria-hidden="true"
      />
      <div className="space-y-2">
        <small className="block font-bold uppercase tracking-[0.12em] text-amber-900">
          Offene Rückfrage
        </small>
        <b className="block leading-5">{question.question}</b>
        <p className="leading-5 text-muted-foreground">{question.rationale}</p>
        <strong className="text-amber-900">
          Ergänzen Sie Ihre Angabe links.
        </strong>
      </div>
    </aside>
  );
}
