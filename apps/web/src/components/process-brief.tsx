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
import { Input } from "./ui/input";
import { Spinner } from "./ui/spinner";
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
    <div className={cn("space-y-6", isEditMode && "pb-8")}>
      <Card as="section" className="gap-0 p-6 sm:p-8">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
          <div>
            <p className="text-eyebrow uppercase text-primary">Ergebnis</p>
            <h1 className="mt-1 text-title sm:text-display">
              Prozesssteckbrief
            </h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Prüfen Sie das Diagramm und die Details der einzelnen
              Hauptschritte. Fehlende Angaben bleiben sichtbar.
            </p>
          </div>
          {isEditMode ? (
            <div className="flex flex-wrap items-center justify-end gap-3">
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

      <Card as="section" className="gap-5 p-6 sm:p-8">
        <h2 className="text-title">Schritte</h2>
        <ol className="space-y-3">
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
        <Card as="section" className="gap-5 p-6 sm:p-8">
          <label className="grid gap-2 text-label">
            <span>Kurz begründen, was geändert wurde</span>
            <Input
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
            <p className="rounded-lg border border-amber-700/30 bg-amber-50 px-4 py-3 text-ui text-amber-950">
              Durch das Speichern wird die fachliche Bestätigung aufgehoben.
            </p>
          )}
          {validationError && (
            <p
              className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-ui text-destructive"
              role="alert"
            >
              {validationError}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-3">
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
              aria-busy={saving}
              onClick={() => void save()}
            >
              {saving ? <Spinner /> : <Save />}{" "}
              {saving ? "Wird gespeichert …" : "Änderungen speichern"}
            </Button>
          </div>
        </Card>
      )}

      {!confirmed && !isEditMode && (
        <Card
          as="section"
          className="flex-row items-center justify-between gap-5 p-6 sm:p-8"
        >
          <div className="flex items-start gap-3">
            <Check className="mt-0.5 size-5 shrink-0 text-primary" />
            <span className="grid gap-1">
              <b>Fachlich abschließen</b>
              <small className="text-ui text-muted-foreground">
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
        <p
          className="flex items-center gap-2 rounded-lg border border-primary/20 bg-secondary px-4 py-3 text-label text-primary"
          role="status"
        >
          <Check className="size-4" /> Dieses Prozessbild wurde fachlich
          bestätigt
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
