import { AlertTriangle, X } from "lucide-react";
import { useEffect, useRef } from "react";
import type { ProcessUnderstanding } from "../lib/process-types";
import { Button, IconButton } from "./ui/button";

export type ProcessStepDeleteReference = {
  stepId: string;
  decisionId: string;
  optionId: string;
};

export function ProcessStepDeleteDialog({
  step,
  steps,
  references,
  onClose,
  onConfirm,
}: {
  step: ProcessUnderstanding["steps"][number] | null;
  steps: ProcessUnderstanding["steps"];
  references: ProcessStepDeleteReference[];
  onClose: () => void;
  onConfirm: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const stepById = new Map(steps.map((item) => [item.id, item]));

  useEffect(() => {
    if (step && dialog.current && !dialog.current.open)
      dialog.current.showModal();
  }, [step]);

  if (!step) return null;
  return (
    <dialog
      ref={dialog}
      className="confirmation-dialog process-step-delete-dialog"
      aria-labelledby="step-delete-title"
      aria-describedby="step-delete-description"
      onClose={onClose}
    >
      <header>
        <div className="confirmation-dialog-icon" aria-hidden="true">
          <AlertTriangle />
        </div>
        <IconButton
          label="Löschen abbrechen"
          onClick={() => dialog.current?.close()}
        >
          <X />
        </IconButton>
      </header>
      <div className="confirmation-dialog-content">
        <h2 id="step-delete-title">Schritt löschen?</h2>
        <p id="step-delete-description">
          „Schritt {step.order}: {step.name || "Ohne Bezeichnung"}“ wird aus dem
          Entwurf entfernt. Gespeichert wird die Änderung erst zusammen mit der
          gesamten Korrektur.
        </p>
        {references.length > 0 && (
          <div className="notice warning" role="alert">
            <b>Dieser Schritt wird noch als Folgeschritt verwendet.</b>
            <ul>
              {references.map((reference) => {
                const source = stepById.get(reference.stepId);
                const decision = source?.decisions.find(
                  (item) => item.id === reference.decisionId,
                );
                return (
                  <li key={`${reference.decisionId}-${reference.optionId}`}>
                    Schritt {source?.order}: {decision?.question}
                  </li>
                );
              })}
            </ul>
            <span>Ändern oder entfernen Sie zuerst diese Verweise.</span>
          </div>
        )}
      </div>
      <footer>
        <Button
          variant="secondary"
          autoFocus
          onClick={() => dialog.current?.close()}
        >
          Abbrechen
        </Button>
        {references.length === 0 && (
          <Button variant="danger" onClick={onConfirm}>
            Schritt löschen
          </Button>
        )}
      </footer>
    </dialog>
  );
}
