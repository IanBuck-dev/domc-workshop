import { ArrowLeft, ArrowRight, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import type { ProcessUnderstanding } from "../lib/process-types";
import { IconButton } from "./ui/button";
import { Input } from "./ui/input";
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
    <section aria-labelledby="process-map-title" className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 id="process-map-title">Diagramm</h2>
        {isEditMode && (
          <small className="text-sm text-muted-foreground">
            {steps.length} von höchstens 8 Schritten
          </small>
        )}
      </div>
      <ol className="flex gap-5 overflow-x-auto px-1 pb-3 pt-1">
        {steps.map((step, index) => (
          <li
            className={cn(
              "relative flex w-60 shrink-0 cursor-pointer flex-col gap-2 rounded-xl border border-border border-t-4 border-t-primary bg-card p-5 shadow-sm transition hover:border-primary/50 focus-within:ring-2 focus-within:ring-ring/40",
              selectedStepId === step.id && "ring-2 ring-primary/30",
            )}
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
            <small className="font-semibold text-muted-foreground">
              Schritt {step.order}
            </small>
            {isEditMode ? (
              <label
                className={cn(
                  "grid gap-1",
                  !step.name.trim() && "rounded-md bg-destructive/10 p-2",
                )}
                onClick={(event) => event.stopPropagation()}
              >
                <span className="sr-only">
                  Bezeichnung für Schritt {step.order}
                </span>
                <Input
                  className="h-9"
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
                  <span className="text-xs font-semibold text-destructive">
                    Angabe fehlt
                  </span>
                )}
              </label>
            ) : (
              <strong className="leading-snug">{step.name}</strong>
            )}
            {isEditMode && (
              <div
                className="flex items-center gap-1"
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
                className="absolute -right-9 top-1/2 z-10 -translate-y-1/2 rounded-full border border-border bg-card text-primary shadow-sm hover:bg-accent"
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
        <div className="text-sm text-muted-foreground" aria-live="polite">
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
