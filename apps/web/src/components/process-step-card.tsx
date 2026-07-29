import { ChevronDown, Plus, Trash2 } from "lucide-react";
import type { ProcessUnderstanding } from "../lib/process-types";
import { ProcessStepDecisions } from "./process-step-decisions";
import { ProcessStepInformation } from "./process-step-information";
import { Button, IconButton } from "./ui/button";
import { cn } from "../lib/utils";

type Step = ProcessUnderstanding["steps"][number];

export function ProcessStepCard({
  step,
  steps,
  sourceOptions,
  isEditMode,
  open,
  onOpenChange,
  onChange,
}: {
  step: Step;
  steps: Step[];
  sourceOptions: string[];
  isEditMode: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (step: Step) => void;
}) {
  function update(next: Partial<Step>) {
    onChange({ ...step, ...next });
  }

  return (
    <li className="process-step-card" id={`process-step-${step.id}`}>
      <details
        open={open}
        onToggle={(event) => {
          if (event.currentTarget.open !== open)
            onOpenChange(event.currentTarget.open);
        }}
      >
        <summary>
          <span className="step-number">{step.order}</span>
          <span className="step-summary-copy">
            <strong>{step.name || "Schritt noch nicht benannt"}</strong>
            <small>{step.activity || "Aktivität noch nicht beschrieben"}</small>
          </span>
          <ChevronDown
            className="step-chevron"
            aria-hidden="true"
            data-open={open ? "true" : "false"}
          />
        </summary>
        <div className="step-details">
          {isEditMode && (
            <fieldset className="step-basics-editor">
              <legend>Schrittbeschreibung</legend>
              <label className={!step.name.trim() ? "missing-field" : ""}>
                Bezeichnung
                <input
                  name={`${step.id}-name`}
                  value={step.name}
                  required
                  aria-invalid={!step.name.trim()}
                  placeholder="Schritt benennen"
                  onChange={(event) => update({ name: event.target.value })}
                />
                {!step.name.trim() && (
                  <span className="missing-field-label">Angabe fehlt</span>
                )}
              </label>
              <label className={!step.activity.trim() ? "missing-field" : ""}>
                Aktivität
                <textarea
                  name={`${step.id}-activity`}
                  rows={2}
                  value={step.activity}
                  required
                  aria-invalid={!step.activity.trim()}
                  placeholder="Aktivität beschreiben"
                  onChange={(event) => update({ activity: event.target.value })}
                />
                {!step.activity.trim() && (
                  <span className="missing-field-label">Angabe fehlt</span>
                )}
              </label>
            </fieldset>
          )}
          <StepValueList
            stepId={step.id}
            title="Input"
            values={step.inputs ?? []}
            isEditMode={isEditMode}
            onChange={(inputs) => update({ inputs })}
          />
          <StepValueList
            stepId={step.id}
            title="Output"
            values={step.outputs ?? []}
            isEditMode={isEditMode}
            onChange={(outputs) => update({ outputs })}
          />
          <ProcessStepInformation
            stepId={step.id}
            items={step.informationItems ?? []}
            sourceOptions={sourceOptions}
            isEditMode={isEditMode}
            onChange={(informationItems) => update({ informationItems })}
          />
          <ProcessStepDecisions
            stepId={step.id}
            decisions={step.decisions ?? []}
            steps={steps}
            isEditMode={isEditMode}
            onChange={(decisions) => update({ decisions })}
          />
          <section className="step-detail-section">
            <h3>Sonstiges</h3>
            {isEditMode ? (
              <label>
                <span className="sr-only">Weitere Angaben</span>
                <textarea
                  name={`${step.id}-miscellaneous`}
                  rows={3}
                  value={step.miscellaneous ?? ""}
                  placeholder="Keine weiteren Angaben"
                  onChange={(event) =>
                    update({ miscellaneous: event.target.value || null })
                  }
                />
              </label>
            ) : (
              <p>{step.miscellaneous ?? "Keine weiteren Angaben"}</p>
            )}
          </section>
        </div>
      </details>
    </li>
  );
}

function StepValueList({
  stepId,
  title,
  values,
  isEditMode,
  onChange,
}: {
  stepId: string;
  title: "Input" | "Output";
  values: string[];
  isEditMode: boolean;
  onChange: (values: string[]) => void;
}) {
  if (!isEditMode)
    return (
      <section className="step-detail-section">
        <h3>{title}</h3>
        {values.length ? (
          <ul>
            {values.map((value) => (
              <li key={value}>{value}</li>
            ))}
          </ul>
        ) : (
          <p className="empty-value">Noch nicht bekannt</p>
        )}
      </section>
    );

  const valueKey = title.toLowerCase();
  return (
    <section
      className={cn(
        "step-detail-section",
        "step-list-editor",
        values.length === 0 && "missing-field",
      )}
    >
      <div className="step-editor-section-heading">
        <h3>{title}</h3>
        <Button
          variant="secondary"
          className="compact-button"
          onClick={() => onChange([...values, ""])}
        >
          <Plus /> Eintrag hinzufügen
        </Button>
      </div>
      {values.length === 0 && (
        <span className="missing-field-label">Angabe fehlt</span>
      )}
      {values.map((value, index) => (
        <div
          className={cn(
            "step-list-editor-row",
            !value.trim() && "missing-field",
          )}
          key={`${valueKey}-${index}`}
        >
          <label>
            <span className="sr-only">
              {title} {index + 1}
            </span>
            <input
              name={`${stepId}-${valueKey}-${index}`}
              value={value}
              required
              aria-invalid={!value.trim()}
              placeholder={`${title} benennen`}
              onChange={(event) =>
                onChange(
                  values.map((item, itemIndex) =>
                    itemIndex === index ? event.target.value : item,
                  ),
                )
              }
            />
          </label>
          {!value.trim() && (
            <span className="missing-field-label">Angabe fehlt</span>
          )}
          <IconButton
            label={`${title} ${index + 1} entfernen`}
            tone="danger"
            onClick={() =>
              onChange(values.filter((_, itemIndex) => itemIndex !== index))
            }
          >
            <Trash2 />
          </IconButton>
        </div>
      ))}
    </section>
  );
}
