import { ArrowDown, ArrowUp, Check, Edit3, Save, X } from "lucide-react";
import { useEffect, useState } from "react";
import { processUnderstandingSchema } from "../../../../packages/domain/src/process-understanding";
import type { ProcessUnderstanding, UploadRecord } from "../lib/process-types";
import { DocumentCoverage } from "./document-coverage";
import { ProcessMap } from "./process-map";
import { ProcessStepCard } from "./process-step-card";
import { ProcessStepDecisionsEditor } from "./process-step-decisions";
import { ProcessStepInformationEditor } from "./process-step-information";
import { ProcessUnknowns } from "./process-unknowns";
import { Button, IconButton } from "./ui/button";
import { Card } from "./ui/card";
import { Kicker } from "./ui/kicker";

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
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => structuredClone(understanding));
  const [note, setNote] = useState("");
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    if (!editing) setDraft(structuredClone(understanding));
  }, [editing, understanding]);

  async function save() {
    const invalid = firstInvalidField(draft);
    if (invalid) {
      setValidationError(invalid.message);
      requestAnimationFrame(() =>
        document
          .querySelector<HTMLElement>(`[name="${CSS.escape(invalid.name)}"]`)
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
    await onSave(
      parsed.data,
      note.trim() || "Fachliche Korrektur des Prozessbildes",
    );
    setEditing(false);
    setNote("");
  }

  const visibleUnderstanding = editing ? draft : understanding;
  const orderedSteps = [...visibleUnderstanding.steps].sort(
    (a, b) => a.order - b.order,
  );

  return (
    <div className="review-layout">
      <Card as="section" className="process-brief process-brief-heading-card">
        <div className="brief-heading">
          <div>
            <Kicker>Ergebnis</Kicker>
            <h1>Prozesssteckbrief</h1>
            <p>
              Prüfen Sie das Diagramm und die Details der einzelnen
              Hauptschritte. Fehlende Angaben bleiben sichtbar.
            </p>
          </div>
          {!confirmed && !editing && (
            <Button variant="secondary" onClick={() => setEditing(true)}>
              <Edit3 /> Prozessbild korrigieren
            </Button>
          )}
        </div>
      </Card>

      <ProcessMap understanding={visibleUnderstanding} />

      <Card as="section" className="process-main-flow">
        <h2>Schritte</h2>
        {editing ? (
          <BriefEditor value={draft} onChange={setDraft} />
        ) : (
          <ol className="step-list">
            {orderedSteps.map((step) => (
              <ProcessStepCard key={step.id} step={step} steps={orderedSteps} />
            ))}
          </ol>
        )}
      </Card>

      {!editing && (
        <DocumentCoverage
          processId={processId}
          understanding={understanding}
          uploads={uploads}
        />
      )}
      {!editing && (
        <ProcessUnknowns knowledgeGaps={understanding.knowledgeGaps} />
      )}

      {editing && (
        <Card as="section" className="edit-actions">
          <label>
            Kurz begründen, was geändert wurde
            <input
              name="correction-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="z. B. Reihenfolge und Informationen berichtigt"
            />
          </label>
          {validationError && (
            <p className="notice error edit-validation-error" role="alert">
              {validationError}
            </p>
          )}
          <div>
            <Button
              variant="secondary"
              disabled={saving}
              onClick={() => {
                setDraft(structuredClone(understanding));
                setValidationError("");
                setEditing(false);
              }}
            >
              <X /> Abbrechen
            </Button>
            <Button
              variant="primary"
              disabled={saving}
              onClick={() => void save()}
            >
              <Save /> {saving ? "Wird gespeichert …" : "Korrektur speichern"}
            </Button>
          </div>
        </Card>
      )}

      {!confirmed && !editing && (
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
      {confirmed && (
        <p className="success-banner" role="status">
          <Check /> Dieses Prozessbild wurde fachlich bestätigt
        </p>
      )}
    </div>
  );
}

function BriefEditor({
  value,
  onChange,
}: {
  value: ProcessUnderstanding;
  onChange: (value: ProcessUnderstanding) => void;
}) {
  return (
    <div className="brief-editor">
      <div className="step-editor-list">
        {value.steps.map((step, index) => (
          <fieldset className="process-step-editor" key={step.id}>
            <legend>
              <span>Schritt {step.order}</span>
              <span className="step-order-actions">
                <IconButton
                  label={`Schritt ${step.order} nach oben verschieben`}
                  disabled={index === 0}
                  onClick={() => moveStep(value, onChange, index, -1)}
                >
                  <ArrowUp />
                </IconButton>
                <IconButton
                  label={`Schritt ${step.order} nach unten verschieben`}
                  disabled={index === value.steps.length - 1}
                  onClick={() => moveStep(value, onChange, index, 1)}
                >
                  <ArrowDown />
                </IconButton>
              </span>
            </legend>

            <div className="step-editor-basics">
              <label>
                Bezeichnung
                <input
                  name={`${step.id}-name`}
                  value={step.name}
                  required
                  onChange={(event) =>
                    updateStep(value, onChange, index, {
                      name: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                Aktivität
                <textarea
                  name={`${step.id}-activity`}
                  rows={2}
                  value={step.activity}
                  required
                  onChange={(event) =>
                    updateStep(value, onChange, index, {
                      activity: event.target.value,
                    })
                  }
                />
              </label>
            </div>

            <div className="step-input-output-editor">
              <StepListEditor
                name={`${step.id}-inputs`}
                title="Input"
                values={step.inputs}
                onChange={(inputs) =>
                  updateStep(value, onChange, index, { inputs })
                }
              />
              <StepListEditor
                name={`${step.id}-outputs`}
                title="Output"
                values={step.outputs}
                onChange={(outputs) =>
                  updateStep(value, onChange, index, { outputs })
                }
              />
            </div>

            <ProcessStepInformationEditor
              stepId={step.id}
              items={step.informationItems}
              onChange={(informationItems) =>
                updateStep(value, onChange, index, { informationItems })
              }
            />
            <ProcessStepDecisionsEditor
              stepId={step.id}
              decisions={step.decisions}
              steps={value.steps}
              onChange={(decisions) =>
                updateStep(value, onChange, index, { decisions })
              }
            />
            <section className="step-editor-section">
              <h3>Sonstiges</h3>
              <label>
                Weitere Angaben
                <textarea
                  name={`${step.id}-miscellaneous`}
                  rows={3}
                  value={step.miscellaneous ?? ""}
                  placeholder="Keine weiteren Angaben"
                  onChange={(event) =>
                    updateStep(value, onChange, index, {
                      miscellaneous: event.target.value || null,
                    })
                  }
                />
              </label>
            </section>
          </fieldset>
        ))}
      </div>
    </div>
  );
}

function StepListEditor({
  name,
  title,
  values,
  onChange,
}: {
  name: string;
  title: "Input" | "Output";
  values: string[];
  onChange: (values: string[]) => void;
}) {
  return (
    <section className="step-editor-section">
      <h3>{title}</h3>
      <label>
        Ein Eintrag je Zeile
        <textarea
          name={name}
          rows={3}
          value={values.join("\n")}
          placeholder="Noch nicht bekannt"
          onChange={(event) => onChange(textLines(event.target.value))}
        />
      </label>
    </section>
  );
}

function updateStep(
  value: ProcessUnderstanding,
  onChange: (value: ProcessUnderstanding) => void,
  index: number,
  next: Partial<ProcessUnderstanding["steps"][number]>,
) {
  const steps = structuredClone(value.steps);
  steps[index] = { ...steps[index]!, ...next };
  onChange({ ...value, steps });
}

function moveStep(
  value: ProcessUnderstanding,
  onChange: (value: ProcessUnderstanding) => void,
  index: number,
  direction: -1 | 1,
) {
  const target = index + direction;
  if (target < 0 || target >= value.steps.length) return;
  const steps = structuredClone(value.steps);
  [steps[index], steps[target]] = [steps[target]!, steps[index]!];
  steps.forEach((step, stepIndex) => {
    step.order = stepIndex + 1;
  });
  onChange({ ...value, steps });
}

function textLines(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function firstInvalidField(value: ProcessUnderstanding) {
  const knownStepIds = new Set(value.steps.map((step) => step.id));
  for (const step of value.steps) {
    if (!step.name.trim())
      return {
        name: `${step.id}-name`,
        message: `Bitte geben Sie für Schritt ${step.order} eine Bezeichnung ein.`,
      };
    if (!step.activity.trim())
      return {
        name: `${step.id}-activity`,
        message: `Bitte beschreiben Sie die Aktivität in Schritt ${step.order}.`,
      };
    for (const item of step.informationItems) {
      if (!item.name.trim())
        return {
          name: `${step.id}-information-${item.id}-name`,
          message: `Bitte benennen Sie die leere Information in Schritt ${step.order} oder entfernen Sie sie.`,
        };
    }
    for (const decision of step.decisions) {
      if (!decision.question.trim())
        return {
          name: `${step.id}-decision-${decision.id}-question`,
          message: `Bitte formulieren Sie die leere Entscheidungsfrage in Schritt ${step.order} oder entfernen Sie sie.`,
        };
      for (const option of decision.options) {
        if (!option.label.trim())
          return {
            name: `${step.id}-decision-${decision.id}-option-${option.id}-label`,
            message: `Bitte benennen Sie die leere Entscheidungsoption in Schritt ${step.order} oder entfernen Sie sie.`,
          };
        if (option.nextStepId && !knownStepIds.has(option.nextStepId))
          return {
            name: `${step.id}-decision-${decision.id}-option-${option.id}-label`,
            message: `Der Folgeschritt in Schritt ${step.order} ist nicht mehr vorhanden.`,
          };
      }
    }
  }
  return null;
}
