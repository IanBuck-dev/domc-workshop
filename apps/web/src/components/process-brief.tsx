import { Check, Edit3, Save, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  insertProcessStep,
  moveProcessStep,
  referencesToStep,
  removeProcessStep,
} from "../../../../packages/domain/src/process-understanding-editing";
import { processUnderstandingSchema } from "../../../../packages/domain/src/process-understanding";
import type { ProcessUnderstanding, UploadRecord } from "../lib/process-types";
import { DocumentCoverage } from "./document-coverage";
import { ProcessMap } from "./process-map";
import { ProcessStepCard } from "./process-step-card";
import { ProcessStepDeleteDialog } from "./process-step-delete-dialog";
import { ProcessUnknowns } from "./process-unknowns";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { cn } from "../lib/utils";

export function ProcessBrief({
  understanding,
  processId,
  uploads,
  confirmed,
  saving,
  onSave,
  onConfirm,
}: {
  understanding: ProcessUnderstanding;
  processId: string;
  uploads: UploadRecord[];
  confirmed: boolean;
  saving: boolean;
  onSave: (understanding: ProcessUnderstanding, note: string) => Promise<void>;
  onConfirm: () => Promise<void>;
}) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [draft, setDraft] = useState(() => structuredClone(understanding));
  const [correctionNote, setCorrectionNote] = useState("");
  const [validationError, setValidationError] = useState("");
  const [openStepIds, setOpenStepIds] = useState<Set<string>>(new Set());
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [deleteStepId, setDeleteStepId] = useState<string | null>(null);

  useEffect(() => {
    if (!isEditMode) setDraft(structuredClone(understanding));
  }, [isEditMode, understanding]);

  const visibleUnderstanding = isEditMode ? draft : understanding;
  const orderedSteps = useMemo(
    () => [...visibleUnderstanding.steps].sort((a, b) => a.order - b.order),
    [visibleUnderstanding.steps],
  );
  const sourceOptions = useMemo(
    () => collectSourceOptions(visibleUnderstanding),
    [visibleUnderstanding],
  );
  const deleteStep = deleteStepId
    ? (orderedSteps.find((step) => step.id === deleteStepId) ?? null)
    : null;
  const deleteReferences = deleteStep
    ? referencesToStep(visibleUnderstanding, deleteStep.id)
    : [];

  function startEditing() {
    setDraft(structuredClone(understanding));
    setCorrectionNote("");
    setValidationError("");
    setSelectedStepId(null);
    setDeleteStepId(null);
    setIsEditMode(true);
  }

  function cancelEditing() {
    setDraft(structuredClone(understanding));
    setCorrectionNote("");
    setValidationError("");
    setOpenStepIds(new Set());
    setSelectedStepId(null);
    setDeleteStepId(null);
    setIsEditMode(false);
  }

  function updateStep(nextStep: ProcessUnderstanding["steps"][number]) {
    setDraft((current) => ({
      ...current,
      steps: current.steps.map((step) =>
        step.id === nextStep.id ? nextStep : step,
      ),
    }));
  }

  function selectStep(stepId: string) {
    setSelectedStepId(stepId);
    setOpenStepIds((current) => new Set(current).add(stepId));
    requestAnimationFrame(() =>
      document
        .getElementById(`process-step-${stepId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" }),
    );
  }

  function addStep(index: number) {
    const id = crypto.randomUUID();
    setDraft((current) => insertProcessStep(current, index, id));
    setSelectedStepId(id);
    setOpenStepIds((current) => new Set(current).add(id));
    requestAnimationFrame(() => {
      document
        .querySelector<HTMLInputElement>(`[name="map-${CSS.escape(id)}-name"]`)
        ?.focus();
    });
  }

  function changeOpenStep(stepId: string, open: boolean) {
    setOpenStepIds((current) => {
      const next = new Set(current);
      if (open) next.add(stepId);
      else next.delete(stepId);
      return next;
    });
  }

  async function save() {
    const invalid = firstInvalidField(draft);
    if (invalid) {
      setValidationError(invalid.message);
      setOpenStepIds((current) => new Set(current).add(invalid.stepId));
      requestAnimationFrame(() =>
        document
          .querySelector<HTMLElement>(`[name="${CSS.escape(invalid.name)}"]`)
          ?.focus(),
      );
      return;
    }
    if (correctionNote.trim().length < 3) {
      setValidationError("Bitte begründen Sie die fachliche Korrektur kurz.");
      requestAnimationFrame(() =>
        document
          .querySelector<HTMLInputElement>("[name=correction-note]")
          ?.focus(),
      );
      return;
    }
    const parsed = processUnderstandingSchema.safeParse(draft);
    if (!parsed.success) {
      setValidationError(
        parsed.error.issues[0]?.message ??
          "Bitte prüfen Sie die markierten Prozessangaben.",
      );
      return;
    }
    setValidationError("");
    await onSave(parsed.data, correctionNote.trim());
    setIsEditMode(false);
    setCorrectionNote("");
    setOpenStepIds(new Set());
    setSelectedStepId(null);
  }

  return (
    <div className={cn("review-layout", isEditMode && "edit-mode")}>
      <Card as="section" className="process-brief process-brief-heading-card">
        <div className="brief-heading">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.14em] text-primary">
              Ergebnis
            </p>
            <h1>Prozesssteckbrief</h1>
            <p>
              Prüfen Sie das Diagramm und die Details der einzelnen
              Hauptschritte. Fehlende Angaben bleiben sichtbar.
            </p>
          </div>
          {isEditMode ? (
            <div className="brief-edit-mode-actions">
              <Badge tone="warning">Bearbeitungsmodus</Badge>
              <Button
                variant="secondary"
                disabled={saving}
                onClick={cancelEditing}
              >
                <X /> Bearbeitung abbrechen
              </Button>
            </div>
          ) : (
            <Button variant="secondary" onClick={startEditing}>
              <Edit3 /> Prozessbild bearbeiten
            </Button>
          )}
        </div>
      </Card>

      <ProcessMap
        understanding={visibleUnderstanding}
        isEditMode={isEditMode}
        selectedStepId={selectedStepId}
        onSelectStep={selectStep}
        onRenameStep={(stepId, name) =>
          setDraft((current) => ({
            ...current,
            steps: current.steps.map((step) =>
              step.id === stepId ? { ...step, name } : step,
            ),
          }))
        }
        onInsertStep={addStep}
        onMoveStep={(stepId, direction) =>
          setDraft((current) => moveProcessStep(current, stepId, direction))
        }
        onRequestDeleteStep={setDeleteStepId}
      />

      <Card as="section" className="process-main-flow">
        <h2>Schritte</h2>
        <ol className="step-list">
          {orderedSteps.map((step) => (
            <ProcessStepCard
              key={step.id}
              step={step}
              steps={orderedSteps}
              sourceOptions={sourceOptions}
              isEditMode={isEditMode}
              open={openStepIds.has(step.id)}
              onOpenChange={(open) => changeOpenStep(step.id, open)}
              onChange={updateStep}
            />
          ))}
        </ol>
      </Card>

      <DocumentCoverage
        processId={processId}
        understanding={visibleUnderstanding}
        uploads={uploads}
      />
      <ProcessUnknowns knowledgeGaps={visibleUnderstanding.knowledgeGaps} />

      {isEditMode && (
        <Card as="section" className="edit-actions">
          <label>
            Kurz begründen, was geändert wurde
            <input
              name="correction-note"
              value={correctionNote}
              required
              minLength={3}
              aria-invalid={
                validationError.includes("begründen") &&
                correctionNote.trim().length < 3
              }
              onChange={(event) => setCorrectionNote(event.target.value)}
              placeholder="z. B. Reihenfolge und Informationsquellen berichtigt"
            />
          </label>
          {confirmed && (
            <p className="notice warning">
              Durch das Speichern wird die fachliche Bestätigung aufgehoben.
            </p>
          )}
          {validationError && (
            <p className="notice error edit-validation-error" role="alert">
              {validationError}
            </p>
          )}
          <div>
            <Button
              variant="secondary"
              disabled={saving}
              onClick={cancelEditing}
            >
              <X /> Abbrechen
            </Button>
            <Button
              variant="primary"
              disabled={saving}
              onClick={() => void save()}
            >
              <Save /> {saving ? "Wird gespeichert …" : "Änderungen speichern"}
            </Button>
          </div>
        </Card>
      )}

      {!confirmed && !isEditMode && (
        <Card as="section" className="confirmation-panel">
          <div>
            <Check />
            <span>
              <b>Fachlich abschließen</b>
              <small>
                Mit der Bestätigung wird dieses Prozessbild als Grundlage für
                die spätere Ableitung möglicher KI-Use-Cases festgehalten.
              </small>
            </span>
          </div>
          <Button
            variant="primary"
            disabled={saving}
            onClick={() => void onConfirm()}
          >
            Prozessbild fachlich bestätigen
          </Button>
        </Card>
      )}
      {confirmed && !isEditMode && (
        <p className="success-banner" role="status">
          <Check /> Dieses Prozessbild wurde fachlich bestätigt
        </p>
      )}

      <ProcessStepDeleteDialog
        step={deleteStep}
        steps={orderedSteps}
        references={deleteReferences}
        onClose={() => setDeleteStepId(null)}
        onConfirm={() => {
          if (!deleteStep) return;
          setDraft((current) => removeProcessStep(current, deleteStep.id));
          setOpenStepIds((current) => {
            const next = new Set(current);
            next.delete(deleteStep.id);
            return next;
          });
          if (selectedStepId === deleteStep.id) setSelectedStepId(null);
          setDeleteStepId(null);
        }}
      />
    </div>
  );
}

function collectSourceOptions(understanding: ProcessUnderstanding) {
  const values = [
    ...(understanding.informationSources.value ?? []),
    ...(understanding.systems.value ?? []),
    ...understanding.documentCoverage.map((item) => item.name),
    ...understanding.steps.flatMap((step) =>
      step.informationItems.flatMap((item) =>
        item.source?.trim() ? [item.source.trim()] : [],
      ),
    ),
  ];
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function firstInvalidField(value: ProcessUnderstanding) {
  const knownStepIds = new Set(value.steps.map((step) => step.id));
  for (const step of value.steps) {
    if (!step.name.trim())
      return {
        stepId: step.id,
        name: `map-${step.id}-name`,
        message: `Bitte geben Sie für Schritt ${step.order} eine Bezeichnung ein.`,
      };
    if (!step.activity.trim())
      return {
        stepId: step.id,
        name: `${step.id}-activity`,
        message: `Bitte beschreiben Sie die Aktivität in Schritt ${step.order}.`,
      };
    for (const [index, input] of step.inputs.entries())
      if (!input.trim())
        return {
          stepId: step.id,
          name: `${step.id}-input-${index}`,
          message: `Bitte benennen oder entfernen Sie den leeren Input in Schritt ${step.order}.`,
        };
    for (const [index, output] of step.outputs.entries())
      if (!output.trim())
        return {
          stepId: step.id,
          name: `${step.id}-output-${index}`,
          message: `Bitte benennen oder entfernen Sie den leeren Output in Schritt ${step.order}.`,
        };
    for (const item of step.informationItems) {
      if (!item.name.trim())
        return {
          stepId: step.id,
          name: `${step.id}-information-${item.id}-name`,
          message: `Bitte benennen Sie die leere Information in Schritt ${step.order} oder entfernen Sie sie.`,
        };
      if (item.source !== null && !item.source.trim())
        return {
          stepId: step.id,
          name: `${step.id}-information-${item.id}-source`,
          message: `Bitte benennen Sie die ausgewählte andere Quelle in Schritt ${step.order}.`,
        };
      if (item.type === "other" && !item.typeDetail?.trim())
        return {
          stepId: step.id,
          name: `${step.id}-information-${item.id}-type-detail`,
          message: `Bitte benennen Sie die andere Informationsart in Schritt ${step.order}.`,
        };
    }
    for (const decision of step.decisions) {
      if (!decision.question.trim())
        return {
          stepId: step.id,
          name: `${step.id}-decision-${decision.id}-question`,
          message: `Bitte formulieren Sie die leere Entscheidungsfrage in Schritt ${step.order} oder entfernen Sie sie.`,
        };
      for (const option of decision.options) {
        if (!option.label.trim())
          return {
            stepId: step.id,
            name: `${step.id}-decision-${decision.id}-option-${option.id}-label`,
            message: `Bitte benennen Sie die leere Entscheidungsoption in Schritt ${step.order} oder entfernen Sie sie.`,
          };
        if (option.nextStepId && !knownStepIds.has(option.nextStepId))
          return {
            stepId: step.id,
            name: `${step.id}-decision-${decision.id}-option-${option.id}-next-step`,
            message: `Der Folgeschritt in Schritt ${step.order} ist nicht mehr vorhanden.`,
          };
      }
    }
  }
  return null;
}
