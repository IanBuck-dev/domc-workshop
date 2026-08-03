import { ChevronDown, Plus, Trash2 } from "lucide-react";
import type { ProcessUnderstanding } from "../lib/process-types";
import { ProcessStepDecisions } from "./process-step-decisions";
import { ProcessStepInformation } from "./process-step-information";
import { Button, IconButton } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
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
    <li
      className="overflow-hidden rounded-xl border bg-card"
      id={`process-step-${step.id}`}
    >
      <details
        className="group"
        open={open}
        onToggle={(event) => {
          if (event.currentTarget.open !== open)
            onOpenChange(event.currentTarget.open);
        }}
      >
        <summary className="flex cursor-pointer list-none items-center gap-4 px-5 py-4 marker:hidden hover:bg-muted [&::-webkit-details-marker]:hidden">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
            {step.order}
          </span>
          <span className="grid min-w-0 flex-1 gap-1">
            <strong>{step.name || "Schritt noch nicht benannt"}</strong>
            <small className="line-clamp-2 text-sm font-normal text-muted-foreground">
              {step.activity || "Aktivität noch nicht beschrieben"}
            </small>
          </span>
          <ChevronDown
            className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
            aria-hidden="true"
            data-open={open ? "true" : "false"}
          />
        </summary>
        <div className="grid gap-6 border-t px-5 py-6 sm:px-6">
          {isEditMode && (
            <fieldset className="grid gap-4 rounded-lg border bg-muted p-4">
              <legend>Schrittbeschreibung</legend>
              <label
                className={cn(
                  "grid gap-2 text-sm font-semibold",
                  !step.name.trim() && "rounded-md bg-destructive/10 p-2",
                )}
              >
                <span>Bezeichnung</span>
                <Input
                  name={`${step.id}-name`}
                  value={step.name}
                  required
                  aria-invalid={!step.name.trim()}
                  placeholder="Schritt benennen"
                  onChange={(event) => update({ name: event.target.value })}
                />
                {!step.name.trim() && (
                  <span className="text-xs text-destructive">Angabe fehlt</span>
                )}
              </label>
              <label
                className={cn(
                  "grid gap-2 text-sm font-semibold",
                  !step.activity.trim() && "rounded-md bg-destructive/10 p-2",
                )}
              >
                <span>Aktivität</span>
                <Textarea
                  name={`${step.id}-activity`}
                  rows={2}
                  value={step.activity}
                  required
                  aria-invalid={!step.activity.trim()}
                  placeholder="Aktivität beschreiben"
                  onChange={(event) => update({ activity: event.target.value })}
                />
                {!step.activity.trim() && (
                  <span className="text-xs text-destructive">Angabe fehlt</span>
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
          <section className="grid gap-2">
            <h3 className="text-base font-semibold">Sonstiges</h3>
            {isEditMode ? (
              <label>
                <span className="sr-only">Weitere Angaben</span>
                <Textarea
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
              <p className="text-muted-foreground">
                {step.miscellaneous ?? "Keine weiteren Angaben"}
              </p>
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
      <section className="grid gap-2">
        <h3 className="text-base font-semibold">{title}</h3>
        {values.length ? (
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            {values.map((value) => (
              <li key={value}>{value}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Noch nicht bekannt</p>
        )}
      </section>
    );

  const valueKey = title.toLowerCase();
  return (
    <section
      className={cn(
        "grid gap-3 rounded-lg border bg-muted p-4",
        values.length === 0 && "border-destructive bg-destructive/5",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-semibold">{title}</h3>
        <Button
          variant="secondary"
          className="h-8 px-3 text-xs"
          onClick={() => onChange([...values, ""])}
        >
          <Plus /> Eintrag hinzufügen
        </Button>
      </div>
      {values.length === 0 && (
        <span className="text-xs font-semibold text-destructive">
          Angabe fehlt
        </span>
      )}
      {values.map((value, index) => (
        <div
          className={cn(
            "flex items-start gap-2",
            !value.trim() && "rounded-md bg-destructive/10 p-2",
          )}
          key={`${valueKey}-${index}`}
        >
          <label className="flex-1">
            <span className="sr-only">
              {title} {index + 1}
            </span>
            <Input
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
            <span className="mt-1 block text-xs text-destructive">
              Angabe fehlt
            </span>
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
