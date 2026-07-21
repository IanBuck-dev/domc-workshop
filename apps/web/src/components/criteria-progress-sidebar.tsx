import { MessageCircle, Pencil } from "lucide-react";
import type { AssessmentConfig, CriterionValue } from "../lib/assessment-types";
import { ProgressBar } from "./progress-bar";

export function CriteriaProgressSidebar({
  config,
  values,
  onEdit,
  onDiscuss,
}: {
  config: AssessmentConfig;
  values: CriterionValue[];
  onEdit: (id: string) => void;
  onDiscuss: (id: string) => void;
}) {
  const byId = new Map(values.map((v) => [v.criterionId, v]));
  const filled = values.filter((v) => v.value !== null).length;
  return (
    <aside className="criteria-sidebar panel">
      <h2>Kriterien</h2>
      <ProgressBar
        value={filled}
        max={config.criteria.length}
        label="Fortschritt"
      />
      {[...config.chat.sections]
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map((section) => {
          const criteria = config.criteria
            .filter((c) => c.sectionId === section.id)
            .sort((a, b) => a.displayOrder - b.displayOrder);
          const count = criteria.filter(
            (c) => byId.get(c.id)?.value !== null,
          ).length;
          return (
            <details key={section.id} open={count < criteria.length}>
              <summary>
                <span>{section.name}</span>
                <b>
                  {count}/{criteria.length}
                </b>
              </summary>
              <ul>
                {criteria.map((criterion) => {
                  const value = byId.get(criterion.id);
                  return (
                    <li
                      key={criterion.id}
                      className={value?.value !== null ? "filled" : ""}
                    >
                      <span>
                        <b>{criterion.name}</b>
                        <small>
                          {value?.value === null || !value
                            ? "Noch offen"
                            : formatValue(criterion, value.value)}
                        </small>
                      </span>
                      <button
                        title="Ändern"
                        onClick={() => onEdit(criterion.id)}
                      >
                        <Pencil />
                      </button>
                      <button
                        title="Mit KI besprechen"
                        onClick={() => onDiscuss(criterion.id)}
                      >
                        <MessageCircle />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </details>
          );
        })}
    </aside>
  );
}

function formatValue(
  criterion: AssessmentConfig["criteria"][number],
  value: number | boolean,
) {
  if (typeof value === "boolean") return value ? "Ja" : "Nein";
  if (criterion.inputType === "currency")
    return `${value.toLocaleString("de-DE")} €`;
  return value.toLocaleString("de-DE");
}
