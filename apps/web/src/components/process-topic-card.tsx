import type {
  ProcessCaptureConfig,
  TopicAnswer,
  WorkCharacteristicAnswer,
  WorkCharacteristicDefinition,
} from "../lib/process-types";
export function ProcessTopicCard({
  topic,
  value,
  onChange,
  characteristics,
  selections,
  onSelectionChange,
  invalidCharacteristicIds,
}: {
  topic: ProcessCaptureConfig["topics"][number];
  value: string;
  onChange: (value: string) => void;
  characteristics: WorkCharacteristicDefinition[];
  selections: Record<string, string[]>;
  onSelectionChange: (id: string, optionIds: string[]) => void;
  invalidCharacteristicIds: ReadonlySet<string>;
}) {
  return (
    <article className="topic-card">
      <span className="topic-number">{topic.displayOrder}</span>
      <span className="topic-copy">
        <b>{topic.name}</b>
        <span>{topic.question}</span>
        <small>{topic.helpText}</small>
        <label className="topic-answer-label">
          <span className="sr-only">Antwort zu {topic.name}</span>
          <textarea
            name={`topic-${topic.id}`}
            rows={4}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Antworten Sie gern in Stichpunkten …"
            required
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
          />
        ))}
      </span>
    </article>
  );
}

function WorkCharacteristicFieldset({
  definition,
  selected,
  onChange,
  showValidationError,
}: {
  definition: WorkCharacteristicDefinition;
  selected: string[];
  onChange: (optionIds: string[]) => void;
  showValidationError: boolean;
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
      className={`work-characteristic${showValidationError ? " is-invalid" : ""}`}
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
      <legend>{definition.question}</legend>
      <small>{definition.helpText}</small>
      <div className="work-characteristic-options">
        {definition.options.map((option) => (
          <label key={option.id}>
            <input
              type={definition.selection === "single" ? "radio" : "checkbox"}
              name={`work-characteristic-${definition.id}`}
              value={option.id}
              checked={selected.includes(option.id)}
              onChange={(event) => toggle(option.id, event.target.checked)}
              required={
                definition.selection === "single" && selected.length === 0
              }
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
      {showValidationError && (
        <span
          className="field-error"
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
): TopicAnswer[] {
  const answeredAt = new Date().toISOString();
  return [...config.topics]
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((topic) => ({
      topicId: topic.id,
      text: values[topic.id] ?? "",
      answeredAt,
    }));
}

export function makeWorkCharacteristicAnswers(
  config: ProcessCaptureConfig,
  selections: Record<string, string[]>,
): WorkCharacteristicAnswer[] {
  if (!("workCharacteristics" in config)) return [];
  const answeredAt = new Date().toISOString();
  return config.workCharacteristics.map((definition) => ({
    characteristicId: definition.id,
    selectedOptionIds: selections[definition.id] ?? [],
    answeredAt,
  }));
}
