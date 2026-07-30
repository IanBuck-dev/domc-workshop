import type {
  ProcessCaptureConfig,
  TopicAnswer,
  WorkCharacteristicAnswer,
  WorkCharacteristicDefinition,
} from "../lib/process-types";
import { Card } from "./ui/card";
import { Textarea } from "./ui/textarea";
export function ProcessTopicCard({
  topic,
  value,
  onChange,
  characteristics,
  selections,
  onSelectionChange,
  invalidCharacteristicIds,
  disabled = false,
  validationCommentId,
}: {
  topic: ProcessCaptureConfig["topics"][number];
  value: string;
  onChange: (value: string) => void;
  characteristics: WorkCharacteristicDefinition[];
  selections: Record<string, string[]>;
  onSelectionChange: (id: string, optionIds: string[]) => void;
  invalidCharacteristicIds: ReadonlySet<string>;
  disabled?: boolean;
  validationCommentId?: string;
}) {
  return (
    <Card as="article" className="gap-0 p-5 sm:p-6">
      <div className="grid grid-cols-[2.25rem_minmax(0,1fr)] items-start gap-4">
        <span className="grid size-9 place-items-center rounded-full bg-secondary text-sm font-bold text-primary">
          {topic.displayOrder}
        </span>
        <div className="min-w-0 space-y-3">
          <h3 className="text-lg font-semibold">{topic.name}</h3>
          <p className="font-medium leading-6">{topic.question}</p>
          <p className="text-sm leading-5 text-muted-foreground">
            {topic.helpText}
          </p>
          <label className="block">
            <span className="sr-only">Antwort zu {topic.name}</span>
            <Textarea
              name={`topic-${topic.id}`}
              rows={4}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="Antworten Sie gern in Stichpunkten …"
              required
              disabled={disabled}
              aria-describedby={validationCommentId}
              className="min-h-28 resize-y"
            />
          </label>
          {characteristics.map((characteristic) => (
            <WorkCharacteristicFieldset
              key={characteristic.id}
              definition={characteristic}
              selected={selections[characteristic.id] ?? []}
              showValidationError={invalidCharacteristicIds.has(
                characteristic.id,
              )}
              onChange={(optionIds) =>
                onSelectionChange(characteristic.id, optionIds)
              }
              disabled={disabled}
            />
          ))}
        </div>
      </div>
    </Card>
  );
}

function WorkCharacteristicFieldset({
  definition,
  selected,
  onChange,
  showValidationError,
  disabled,
}: {
  definition: WorkCharacteristicDefinition;
  selected: string[];
  onChange: (optionIds: string[]) => void;
  showValidationError: boolean;
  disabled: boolean;
}) {
  function toggle(optionId: string, checked: boolean) {
    if (definition.selection === "single") {
      onChange([optionId]);
      return;
    }
    if (optionId === "none" || optionId === "unsure") {
      onChange(checked ? [optionId] : []);
      return;
    }
    const positive = selected.filter(
      (id) => id !== "none" && id !== "unsure" && id !== optionId,
    );
    onChange(checked ? [...positive, optionId] : positive);
  }
  return (
    <fieldset
      className={`mt-5 rounded-lg border bg-muted/30 p-4 ${showValidationError ? "border-destructive" : "border-border"}`}
      aria-describedby={
        showValidationError
          ? `work-characteristic-error-${definition.id}`
          : undefined
      }
      aria-invalid={showValidationError || undefined}
      aria-required="true"
      data-work-characteristic-id={definition.id}
      tabIndex={-1}
    >
      <legend className="max-w-3xl px-1 font-semibold leading-6">
        {definition.question}
      </legend>
      <p className="mb-3 text-sm text-muted-foreground">
        {definition.helpText}
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {definition.options.map((option) => (
          <label
            key={option.id}
            className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-card p-3 text-sm font-medium leading-5 transition-colors has-[:checked]:border-primary has-[:checked]:bg-secondary"
          >
            <input
              type={definition.selection === "single" ? "radio" : "checkbox"}
              name={`work-characteristic-${definition.id}`}
              value={option.id}
              checked={selected.includes(option.id)}
              onChange={(event) => toggle(option.id, event.target.checked)}
              required={
                definition.selection === "single" && selected.length === 0
              }
              disabled={disabled}
              className="mt-0.5 size-4 shrink-0 accent-primary"
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
      {showValidationError && (
        <span
          className="mt-3 block text-sm font-semibold text-destructive"
          id={`work-characteristic-error-${definition.id}`}
          role="alert"
        >
          Bitte wählen Sie mindestens eine Antwort aus.
        </span>
      )}
    </fieldset>
  );
}
export function makeTopicAnswers(
  config: ProcessCaptureConfig,
  values: Record<string, string>,
  previous: TopicAnswer[] = [],
): TopicAnswer[] {
  const answeredAt = new Date().toISOString();
  return [...config.topics]
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((topic) => {
      const text = values[topic.id] ?? "";
      const existing = previous.find((answer) => answer.topicId === topic.id);
      return {
        topicId: topic.id,
        text,
        answeredAt: existing?.text === text ? existing.answeredAt : answeredAt,
      };
    });
}

export function makeWorkCharacteristicAnswers(
  config: ProcessCaptureConfig,
  selections: Record<string, string[]>,
  previous: WorkCharacteristicAnswer[] = [],
): WorkCharacteristicAnswer[] {
  if (!("workCharacteristics" in config)) return [];
  const answeredAt = new Date().toISOString();
  return config.workCharacteristics.map((definition) => {
    const selectedOptionIds = selections[definition.id] ?? [];
    const existing = previous.find(
      (answer) => answer.characteristicId === definition.id,
    );
    return {
      characteristicId: definition.id,
      selectedOptionIds,
      answeredAt:
        existing &&
        JSON.stringify(existing.selectedOptionIds) ===
          JSON.stringify(selectedOptionIds)
          ? existing.answeredAt
          : answeredAt,
    };
  });
}
