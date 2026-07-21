import { Check, MessageCircle, Pencil } from "lucide-react";
import type {
  CriterionDefinition,
  CriterionValue,
} from "../lib/assessment-types";

export function CriterionCard({
  definition,
  record,
  onConfirm,
  onEdit,
  onDiscuss,
}: {
  definition: CriterionDefinition;
  record: CriterionValue;
  onConfirm: () => void;
  onEdit: () => void;
  onDiscuss: () => void;
}) {
  return (
    <article className="criterion-card">
      <div>
        <span className="kicker">VORSCHLAG</span>
        <h3>{definition.name}</h3>
        <p>{definition.description}</p>
      </div>
      <strong className="card-value">
        {record.value === null
          ? "Noch offen"
          : definition.inputType === "currency"
            ? `${Number(record.value).toLocaleString("de-DE")} €`
            : definition.inputType === "boolean"
              ? record.value
                ? "Ja"
                : "Nein"
              : String(record.value)}
      </strong>
      {record.rationale && <p className="card-rationale">{record.rationale}</p>}
      <div className="card-evidence">
        {record.confidence !== null && (
          <small>
            Konfidenz: {record.confidence.toLocaleString("de-DE")} %
          </small>
        )}
        {record.evidence.length > 0 && (
          <ul>
            {record.evidence.map((evidence) => (
              <li key={evidence}>{evidence}</li>
            ))}
          </ul>
        )}
        {record.assumptions.length > 0 && (
          <p>
            <b>Annahmen:</b> {record.assumptions.join(" · ")}
          </p>
        )}
      </div>
      <div className="card-actions">
        <button className="small-button" onClick={onConfirm}>
          <Check />
          Bestätigen
        </button>
        <button className="text-button" onClick={onEdit}>
          <Pencil />
          Ändern
        </button>
        <button className="text-button" onClick={onDiscuss}>
          <MessageCircle />
          Besprechen
        </button>
      </div>
    </article>
  );
}
