import { ArrowLeft, ArrowRight, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import type { ProcessUnderstanding } from "../lib/process-types";
import { IconButton } from "./ui/button";
import { cn } from "../lib/utils";

export interface ProcessMapProps {
  understanding: ProcessUnderstanding;
  isEditMode: boolean;
  selectedStepId: string | null;
  onSelectStep: (stepId: string) => void;
  onRenameStep: (stepId: string, name: string) => void;
  onInsertStep: (index: number) => void;
  onMoveStep: (stepId: string, direction: -1 | 1) => void;
  onRequestDeleteStep: (stepId: string) => void;
}

export function ProcessMap({
  understanding,
  isEditMode,
  selectedStepId,
  onSelectStep,
  onRenameStep,
  onInsertStep,
  onMoveStep,
  onRequestDeleteStep,
}: ProcessMapProps) {
  const steps = [...understanding.steps].sort((a, b) => a.order - b.order);
  const [draggedStepId, setDraggedStepId] = useState<string | null>(null);

  function dropAt(targetIndex: number) {
    if (!draggedStepId) return;
    const currentIndex = steps.findIndex((step) => step.id === draggedStepId);
    if (currentIndex < 0 || currentIndex === targetIndex) return;
    const direction = currentIndex < targetIndex ? 1 : -1;
    for (let index = currentIndex; index !== targetIndex; index += direction)
      onMoveStep(draggedStepId, direction);
    setDraggedStepId(null);
  }

  return (
    <section
      className={cn("process-map-section", isEditMode && "edit-mode")}
      aria-labelledby="process-map-title"
    >
      <div className="process-map-heading">
        <h2 id="process-map-title">Diagramm</h2>
        {isEditMode && <small>{steps.length} von höchstens 8 Schritten</small>}
      </div>
      <ol className="process-map">
        {steps.map((step, index) => (
          <li
            className={cn("map-node", selectedStepId === step.id && "selected")}
            key={step.id}
            draggable={isEditMode}
            onDragStart={() => setDraggedStepId(step.id)}
            onDragEnd={() => setDraggedStepId(null)}
            onDragOver={(event) => {
              if (isEditMode) event.preventDefault();
            }}
            onDrop={(event) => {
              event.preventDefault();
              dropAt(index);
            }}
            onClick={() => onSelectStep(step.id)}
          >
            <small>Schritt {step.order}</small>
            {isEditMode ? (
              <label
                className={cn(
                  "map-node-name",
                  !step.name.trim() && "missing-field",
                )}
                onClick={(event) => event.stopPropagation()}
              >
                <span className="sr-only">
                  Bezeichnung für Schritt {step.order}
                </span>
                <input
                  name={`map-${step.id}-name`}
                  value={step.name}
                  required
                  aria-invalid={!step.name.trim()}
                  placeholder="Schritt benennen"
                  onChange={(event) =>
                    onRenameStep(step.id, event.target.value)
                  }
                />
                {!step.name.trim() && (
                  <span className="missing-field-label">Angabe fehlt</span>
                )}
              </label>
            ) : (
              <strong>{step.name}</strong>
            )}
            {isEditMode && (
              <div
                className="process-map-edit-actions"
                onClick={(event) => event.stopPropagation()}
              >
                <IconButton
                  label={`Schritt ${step.order} nach links verschieben`}
                  disabled={index === 0}
                  onClick={() => onMoveStep(step.id, -1)}
                >
                  <ArrowLeft />
                </IconButton>
                <IconButton
                  label={`Schritt ${step.order} nach rechts verschieben`}
                  disabled={index === steps.length - 1}
                  onClick={() => onMoveStep(step.id, 1)}
                >
                  <ArrowRight />
                </IconButton>
                <IconButton
                  label={`Schritt ${step.order} löschen`}
                  tone="danger"
                  disabled={steps.length <= 1}
                  aria-describedby={
                    steps.length <= 1 ? "minimum-step-count" : undefined
                  }
                  onClick={() => onRequestDeleteStep(step.id)}
                >
                  <Trash2 />
                </IconButton>
              </div>
            )}
            {isEditMode && (
              <IconButton
                className="map-insert-action"
                label={`Schritt nach Schritt ${step.order} hinzufügen`}
                disabled={steps.length >= 8}
                onClick={(event) => {
                  event.stopPropagation();
                  onInsertStep(index + 1);
                }}
              >
                <Plus />
              </IconButton>
            )}
          </li>
        ))}
      </ol>
      {isEditMode && (
        <div className="process-map-limits" aria-live="polite">
          {steps.length <= 1 && (
            <span className="sr-only" id="minimum-step-count">
              Der einzige verbleibende Schritt kann nicht gelöscht werden.
            </span>
          )}
          {steps.length >= 8 && (
            <small>
              Ein Prozessbild kann höchstens acht Schritte enthalten.
            </small>
          )}
        </div>
      )}
    </section>
  );
}
