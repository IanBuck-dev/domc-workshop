import { ArrowDown, ArrowUp, Check, Edit3, Save, X } from "lucide-react";
import { useEffect, useState } from "react";
import type {
  ProcessCaptureConfig,
  ProcessUnderstanding,
  UploadRecord,
  WorkCharacteristicAnswer,
  WorkCharacteristicDefinition,
} from "../lib/process-types";
import { DocumentCoverage } from "./document-coverage";
import { ProcessMap } from "./process-map";
import { ProcessStepCard } from "./process-step-card";

type StringFact = ProcessUnderstanding["purpose"];
type ListFact = ProcessUnderstanding["participants"];

const provenanceCopy: Record<StringFact["provenance"], string> = {
  user_stated: "Ihre Angabe",
  file_evidence: "Aus Unterlage",
  ai_structured: "Strukturiert",
  ai_inferred: "Annahme",
  user_confirmed: "Bestätigt",
  unknown: "Noch unbekannt",
};

export function ProcessBrief({
  understanding,
  config,
  workCharacteristicAnswers,
  processId,
  uploads,
  confirmed,
  saving,
  onSave,
  onSaveWorkCharacteristics,
  onConfirm,
}: {
  understanding: ProcessUnderstanding;
  config: ProcessCaptureConfig;
  workCharacteristicAnswers: WorkCharacteristicAnswer[];
  processId: string;
  uploads: UploadRecord[];
  confirmed: boolean;
  saving: boolean;
  onSave: (understanding: ProcessUnderstanding, note: string) => Promise<void>;
  onSaveWorkCharacteristics: (
    answers: WorkCharacteristicAnswer[],
    reason: string,
  ) => Promise<void>;
  onConfirm: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => structuredClone(understanding));
  const [note, setNote] = useState("");
  const [editingCharacteristics, setEditingCharacteristics] = useState(false);
  useEffect(() => {
    if (!editing) setDraft(structuredClone(understanding));
  }, [editing, understanding]);

  async function save() {
    await onSave(draft, note || "Fachliche Korrektur des Prozessbildes");
    setEditing(false);
    setNote("");
  }

  return (
    <div className="review-layout">
      <section className="panel process-brief">
        <div className="brief-heading">
          <div>
            <span className="kicker">ERGEBNIS</span>
            <h1>Prozesssteckbrief</h1>
            <p>
              Prüfen Sie, ob der heutige normale Ablauf fachlich richtig
              wiedergegeben ist. Annahmen und Lücken bleiben sichtbar.
            </p>
          </div>
          {!confirmed && !editing && !editingCharacteristics && (
            <button
              className="button secondary"
              onClick={() => setEditing(true)}
            >
              <Edit3 /> Prozessbild korrigieren
            </button>
          )}
        </div>

        {editing ? (
          <BriefEditor value={draft} onChange={setDraft} />
        ) : (
          <BriefView value={understanding} />
        )}

        {!editing && (
          <WorkCharacteristicsSection
            config={config}
            answers={workCharacteristicAnswers}
            editing={editingCharacteristics}
            saving={saving}
            onEdit={() => setEditingCharacteristics(true)}
            onCancel={() => setEditingCharacteristics(false)}
            onSave={async (answers, reason) => {
              await onSaveWorkCharacteristics(answers, reason);
              setEditingCharacteristics(false);
            }}
          />
        )}

        {editing && (
          <div className="edit-actions">
            <label>
              Kurz begründen, was geändert wurde
              <input
                name="correction-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="z. B. Reihenfolge und Zuständigkeit berichtigt"
              />
            </label>
            <div>
              <button
                className="button secondary"
                disabled={saving}
                onClick={() => {
                  setDraft(structuredClone(understanding));
                  setEditing(false);
                }}
              >
                <X /> Abbrechen
              </button>
              <button
                className="button"
                disabled={saving}
                onClick={() => void save()}
              >
                <Save /> {saving ? "Wird gespeichert …" : "Korrektur speichern"}
              </button>
            </div>
          </div>
        )}
      </section>

      {!editing && <ProcessMap understanding={understanding} />}
      {!editing && (
        <DocumentCoverage
          processId={processId}
          understanding={understanding}
          uploads={uploads}
        />
      )}

      {!confirmed && !editing && !editingCharacteristics && (
        <section className="confirmation-panel panel">
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
          <button
            className="button"
            disabled={saving}
            onClick={() => void onConfirm()}
          >
            Prozessbild fachlich bestätigen
          </button>
        </section>
      )}
      {confirmed && (
        <p className="success-banner" role="status">
          <Check /> Dieses Prozessbild wurde fachlich bestätigt.
        </p>
      )}
    </div>
  );
}

function WorkCharacteristicsSection({
  config,
  answers,
  editing,
  saving,
  onEdit,
  onCancel,
  onSave,
}: {
  config: ProcessCaptureConfig;
  answers: WorkCharacteristicAnswer[];
  editing: boolean;
  saving: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (
    answers: WorkCharacteristicAnswer[],
    reason: string,
  ) => Promise<void>;
}) {
  const definitions =
    "workCharacteristics" in config ? config.workCharacteristics : [];
  const [draft, setDraft] = useState(() => structuredClone(answers));
  const [reason, setReason] = useState("");
  useEffect(() => {
    if (!editing) {
      setDraft(structuredClone(answers));
      setReason("");
    }
  }, [answers, editing]);
  if (!definitions.length)
    return (
      <section className="brief-section work-characteristics-section">
        <h2>Arbeitsmerkmale</h2>
        <p>In dieser älteren Prozessaufnahme nicht erhoben.</p>
      </section>
    );
  return (
    <section className="brief-section work-characteristics-section">
      <div className="list-title">
        <div>
          <h2>Arbeitsmerkmale</h2>
          <p>
            Diese direkten Angaben beschreiben die heutige fachliche Arbeit. Sie
            enthalten keine KI-Bewertung.
          </p>
        </div>
        {!editing && (
          <button className="button secondary" type="button" onClick={onEdit}>
            <Edit3 /> Angaben korrigieren
          </button>
        )}
      </div>
      {editing ? (
        <div className="work-characteristics-editor">
          {definitions.map((definition) => (
            <WorkCharacteristicEditField
              key={definition.id}
              definition={definition}
              selected={
                draft.find(
                  (answer) => answer.characteristicId === definition.id,
                )?.selectedOptionIds ?? []
              }
              onChange={(selectedOptionIds) =>
                setDraft((current) => [
                  ...current.filter(
                    (answer) => answer.characteristicId !== definition.id,
                  ),
                  {
                    characteristicId: definition.id,
                    selectedOptionIds,
                    answeredAt: new Date().toISOString(),
                  },
                ])
              }
            />
          ))}
          <label>
            Korrektur kurz begründen
            <input
              name="work-characteristics-correction-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="z. B. verwendete Unterlagen ergänzt"
              required
            />
          </label>
          <div className="edit-actions-inline">
            <button
              className="button secondary"
              type="button"
              disabled={saving}
              onClick={onCancel}
            >
              <X /> Abbrechen
            </button>
            <button
              className="button"
              type="button"
              disabled={
                saving ||
                reason.trim().length < 3 ||
                definitions.some(
                  (definition) =>
                    !draft.find(
                      (answer) =>
                        answer.characteristicId === definition.id &&
                        answer.selectedOptionIds.length > 0,
                    ),
                )
              }
              onClick={() => void onSave(draft, reason)}
            >
              <Save /> {saving ? "Wird gespeichert …" : "Korrektur speichern"}
            </button>
          </div>
        </div>
      ) : (
        <div className="work-characteristics-review-list">
          {definitions.map((definition) => {
            const answer = answers.find(
              (item) => item.characteristicId === definition.id,
            );
            return (
              <article key={definition.id}>
                <div>
                  <h3>{definition.question}</h3>
                  <span className="provenance provenance-user_confirmed">
                    Direkte Angabe
                  </span>
                </div>
                <ul>
                  {(answer?.selectedOptionIds ?? []).map((optionId) => (
                    <li key={optionId}>
                      {definition.options.find(
                        (option) => option.id === optionId,
                      )?.label ?? optionId}
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function WorkCharacteristicEditField({
  definition,
  selected,
  onChange,
}: {
  definition: WorkCharacteristicDefinition;
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  function toggle(optionId: string, checked: boolean) {
    if (definition.selection === "single") return onChange([optionId]);
    if (optionId === "none" || optionId === "unsure")
      return onChange(checked ? [optionId] : []);
    const positive = selected.filter(
      (id) => id !== "none" && id !== "unsure" && id !== optionId,
    );
    onChange(checked ? [...positive, optionId] : positive);
  }
  return (
    <fieldset className="work-characteristic" aria-required="true">
      <legend>{definition.question}</legend>
      <div className="work-characteristic-options">
        {definition.options.map((option) => (
          <label key={option.id}>
            <input
              type={definition.selection === "single" ? "radio" : "checkbox"}
              name={`review-work-characteristic-${definition.id}`}
              checked={selected.includes(option.id)}
              onChange={(event) => toggle(option.id, event.target.checked)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function FactBadge({ fact }: { fact: StringFact | ListFact }) {
  if (fact.provenance === "ai_structured" || fact.provenance === "user_stated")
    return null;
  return (
    <span className={`provenance provenance-${fact.provenance}`}>
      {provenanceCopy[fact.provenance]}
    </span>
  );
}

function BriefView({ value }: { value: ProcessUnderstanding }) {
  const overview: Array<[string, StringFact]> = [
    ["Zweck", value.purpose],
    ["Auslöser", value.trigger],
    ["Ergebnis", value.outcome],
    ["Abgrenzung", value.boundaries],
  ];
  const lists: Array<[string, ListFact]> = [
    ["Beteiligte", value.participants],
    ["Informationen und Unterlagen", value.informationSources],
    ["Systeme", value.systems],
    ["Entscheidungen", value.decisions],
    ["Kontrollen", value.controls],
    ["Übergaben", value.handoffs],
    ["Mengen und Zeiten", value.volumeAndTime],
    ["Probleme", value.painPoints],
    ["Verbesserungsziele", value.improvementGoals],
  ];
  return (
    <>
      <div className="brief-grid">
        {overview.map(([label, fact]) => (
          <article key={label}>
            <div>
              <h2>{label}</h2>
              <FactBadge fact={fact} />
            </div>
            <p>{fact.value || "Noch nicht bekannt"}</p>
            {fact.assumptions.map((item) => (
              <small className="assumption" key={item}>
                Annahme: {item}
              </small>
            ))}
          </article>
        ))}
      </div>
      <section className="brief-section">
        <h2>Hauptablauf</h2>
        <p>
          Öffnen Sie einen Schritt, um Rollen, Informationen, Systeme und
          Übergaben zu prüfen.
        </p>
        <ol className="step-list">
          {value.steps.map((step) => (
            <ProcessStepCard key={step.id} step={step} />
          ))}
        </ol>
      </section>
      <div className="brief-list-grid">
        {lists.map(([label, fact]) => (
          <section className="brief-section" key={label}>
            <div className="list-title">
              <h2>{label}</h2>
              <FactBadge fact={fact} />
            </div>
            {fact.value?.length ? (
              <ul>
                {fact.value.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <p>Noch nicht bekannt</p>
            )}
          </section>
        ))}
      </div>
    </>
  );
}

function BriefEditor({
  value,
  onChange,
}: {
  value: ProcessUnderstanding;
  onChange: (value: ProcessUnderstanding) => void;
}) {
  const updateString = (
    key: "purpose" | "trigger" | "outcome" | "boundaries",
    next: string,
  ) => onChange({ ...value, [key]: { ...value[key], value: next || null } });
  const listKeys = [
    "participants",
    "informationSources",
    "systems",
    "decisions",
    "controls",
    "handoffs",
    "volumeAndTime",
    "painPoints",
    "improvementGoals",
  ] as const;
  const listLabels = [
    "Beteiligte",
    "Informationen und Unterlagen",
    "Systeme",
    "Entscheidungen",
    "Kontrollen",
    "Übergaben",
    "Mengen und Zeiten",
    "Probleme",
    "Verbesserungsziele",
  ];
  const updateList = (key: (typeof listKeys)[number], next: string) =>
    onChange({ ...value, [key]: { ...value[key], value: lines(next) } });
  return (
    <div className="brief-editor">
      <div className="form-grid">
        {(
          [
            ["purpose", "Zweck"],
            ["trigger", "Auslöser"],
            ["outcome", "Ergebnis"],
            ["boundaries", "Abgrenzung"],
          ] as const
        ).map(([key, label]) => (
          <label key={key}>
            {label}
            <textarea
              name={`brief-${key}`}
              rows={3}
              value={value[key].value ?? ""}
              onChange={(e) => updateString(key, e.target.value)}
            />
          </label>
        ))}
      </div>
      <h2>Hauptablauf</h2>
      <div className="step-editor-list">
        {value.steps.map((step, index) => (
          <fieldset key={step.id}>
            <legend>
              <span>Schritt {step.order}</span>
              <span className="step-order-actions">
                <button
                  type="button"
                  className="icon-button"
                  disabled={index === 0}
                  aria-label={`Schritt ${step.order} nach oben verschieben`}
                  onClick={() => moveStep(value, onChange, index, -1)}
                >
                  <ArrowUp />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  disabled={index === value.steps.length - 1}
                  aria-label={`Schritt ${step.order} nach unten verschieben`}
                  onClick={() => moveStep(value, onChange, index, 1)}
                >
                  <ArrowDown />
                </button>
              </span>
            </legend>
            <div className="form-grid">
              <StepStringInput
                name={`${step.id}-name`}
                label="Bezeichnung"
                value={step.name}
                required
                onChange={(next) =>
                  updateStep(value, onChange, index, "name", next ?? "")
                }
              />
              <StepStringInput
                name={`${step.id}-activity`}
                label="Aktivität"
                value={step.activity}
                required
                onChange={(next) =>
                  updateStep(value, onChange, index, "activity", next ?? "")
                }
              />
              <StepStringInput
                name={`${step.id}-trigger`}
                label="Auslöser"
                value={step.trigger}
                onChange={(next) =>
                  updateStep(value, onChange, index, "trigger", next)
                }
              />
              <StepStringInput
                name={`${step.id}-output`}
                label="Ergebnis"
                value={step.output}
                onChange={(next) =>
                  updateStep(value, onChange, index, "output", next)
                }
              />
              <StepListInput
                name={`${step.id}-responsibleRoles`}
                label="Verantwortliche Rollen"
                value={step.responsibleRoles}
                onChange={(next) =>
                  updateStep(value, onChange, index, "responsibleRoles", next)
                }
              />
              <StepListInput
                name={`${step.id}-information`}
                label="Informationen"
                value={step.information}
                onChange={(next) =>
                  updateStep(value, onChange, index, "information", next)
                }
              />
              <StepListInput
                name={`${step.id}-systems`}
                label="Systeme"
                value={step.systems}
                onChange={(next) =>
                  updateStep(value, onChange, index, "systems", next)
                }
              />
              <StepStringInput
                name={`${step.id}-decision`}
                label="Entscheidung"
                value={step.decision}
                onChange={(next) =>
                  updateStep(value, onChange, index, "decision", next)
                }
              />
              <StepStringInput
                name={`${step.id}-ruleOrJudgement`}
                label="Regel oder fachliche Einschätzung"
                value={step.ruleOrJudgement}
                onChange={(next) =>
                  updateStep(value, onChange, index, "ruleOrJudgement", next)
                }
              />
              <StepStringInput
                name={`${step.id}-handover`}
                label="Übergabe"
                value={step.handover}
                onChange={(next) =>
                  updateStep(value, onChange, index, "handover", next)
                }
              />
              <StepListInput
                name={`${step.id}-controls`}
                label="Kontrollen"
                value={step.controls}
                onChange={(next) =>
                  updateStep(value, onChange, index, "controls", next)
                }
              />
              <StepListInput
                name={`${step.id}-painPoints`}
                label="Probleme"
                value={step.painPoints}
                onChange={(next) =>
                  updateStep(value, onChange, index, "painPoints", next)
                }
              />
            </div>
          </fieldset>
        ))}
      </div>
      <div className="form-grid">
        {listKeys.map((key, index) => (
          <label key={key}>
            {listLabels[index]} <small>Ein Eintrag je Zeile</small>
            <textarea
              name={`brief-${key}`}
              rows={4}
              value={(value[key].value ?? []).join("\n")}
              onChange={(e) => updateList(key, e.target.value)}
            />
          </label>
        ))}
      </div>
      <label>
        Offene Wissenslücken <small>Ein Eintrag je Zeile</small>
        <textarea
          name="brief-knowledgeGaps"
          rows={4}
          value={value.knowledgeGaps.join("\n")}
          onChange={(e) =>
            onChange({ ...value, knowledgeGaps: lines(e.target.value) ?? [] })
          }
        />
      </label>
      <label>
        Widersprüche <small>Ein Eintrag je Zeile</small>
        <textarea
          name="brief-conflicts"
          rows={4}
          value={value.conflicts.join("\n")}
          onChange={(e) =>
            onChange({ ...value, conflicts: lines(e.target.value) ?? [] })
          }
        />
      </label>
    </div>
  );
}

function StepStringInput({
  name,
  label,
  value,
  required = false,
  onChange,
}: {
  name: string;
  label: string;
  value: string | null;
  required?: boolean;
  onChange: (value: string | null) => void;
}) {
  return (
    <label>
      {label}
      <textarea
        name={name}
        rows={2}
        value={value ?? ""}
        required={required}
        onChange={(e) =>
          onChange(required ? e.target.value : e.target.value || null)
        }
      />
    </label>
  );
}
function StepListInput({
  name,
  label,
  value,
  onChange,
}: {
  name: string;
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
}) {
  return (
    <label>
      {label} <small>Ein Eintrag je Zeile</small>
      <textarea
        name={name}
        rows={2}
        value={value.join("\n")}
        onChange={(e) => onChange(lines(e.target.value) ?? [])}
      />
    </label>
  );
}
function updateStep<K extends keyof ProcessUnderstanding["steps"][number]>(
  value: ProcessUnderstanding,
  onChange: (value: ProcessUnderstanding) => void,
  index: number,
  key: K,
  next: ProcessUnderstanding["steps"][number][K],
) {
  const steps = structuredClone(value.steps);
  steps[index] = { ...steps[index]!, [key]: next };
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
function lines(value: string) {
  const result = value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
  return result.length ? result : null;
}
