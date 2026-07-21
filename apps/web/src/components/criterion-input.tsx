import type {
  CriterionDefinition,
  CriterionValue,
} from "../lib/assessment-types";

export function CriterionInput({
  definition,
  record,
  onChange,
  disabled = false,
}: {
  definition: CriterionDefinition;
  record: CriterionValue;
  onChange: (value: number | boolean | null) => void;
  disabled?: boolean;
}) {
  if (definition.inputType === "boolean") {
    return (
      <select
        name={`criterion-${definition.id}`}
        value={record.value === null ? "" : record.value ? "1" : "0"}
        disabled={disabled}
        onChange={(e) =>
          onChange(e.target.value === "" ? null : e.target.value === "1")
        }
      >
        <option value="">Bitte wählen</option>
        <option value="1">Ja</option>
        <option value="0">Nein</option>
      </select>
    );
  }
  return (
    <div className="input-unit">
      <input
        name={`criterion-${definition.id}`}
        type="number"
        min={definition.minimum}
        max={definition.maximum}
        step={1}
        value={record.value === null ? "" : Number(record.value)}
        disabled={disabled}
        onChange={(e) =>
          onChange(e.target.value === "" ? null : Number(e.target.value))
        }
      />
      {definition.inputType === "currency" && <span>€</span>}
    </div>
  );
}
