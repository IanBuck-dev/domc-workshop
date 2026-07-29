import { Plus, Trash2 } from "lucide-react";
import type { ProcessUnderstanding } from "../lib/process-types";
import { Button, IconButton } from "./ui/button";

type Step = ProcessUnderstanding["steps"][number];
type InformationItem = Step["informationItems"][number];

const informationTypeCopy: Record<InformationItem["type"], string> = {
  system_field: "Systemfeld",
  email: "E-Mail",
  spreadsheet: "Tabelle",
  document: "Dokument",
  image_or_scan: "Bild oder Scan",
  free_text: "Freitext",
  database_or_report: "Datenbank oder Bericht",
  other: "Sonstige Art",
  unknown: "Art noch unbekannt",
};

export function ProcessStepInformation({
  items,
}: {
  items: InformationItem[];
}) {
  return (
    <section className="step-detail-section">
      <h3>Informationen</h3>
      {items.length ? (
        <div className="step-table-wrap">
          <table className="step-information-table">
            <thead>
              <tr>
                <th scope="col">Information</th>
                <th scope="col">Quelle</th>
                <th scope="col">Art</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td data-label="Information">{item.name}</td>
                  <td data-label="Quelle">
                    {item.source ?? "Quelle noch unbekannt"}
                  </td>
                  <td data-label="Art">{informationTypeCopy[item.type]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="empty-value">Keine Informationen benannt</p>
      )}
    </section>
  );
}

export function ProcessStepInformationEditor({
  stepId,
  items,
  onChange,
}: {
  stepId: string;
  items: InformationItem[];
  onChange: (items: InformationItem[]) => void;
}) {
  function update(index: number, next: Partial<InformationItem>) {
    onChange(
      items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...next } : item,
      ),
    );
  }
  return (
    <section className="step-editor-section">
      <div className="step-editor-section-heading">
        <h3>Informationen</h3>
        <Button
          variant="secondary"
          className="compact-button"
          onClick={() =>
            onChange([
              ...items,
              {
                id: crypto.randomUUID(),
                name: "",
                source: null,
                type: "unknown",
              },
            ])
          }
        >
          <Plus /> Information hinzufügen
        </Button>
      </div>
      {items.length ? (
        <div className="nested-editor-list">
          {items.map((item, index) => (
            <fieldset className="information-editor-row" key={item.id}>
              <legend>Information {index + 1}</legend>
              <label>
                Information
                <input
                  name={`${stepId}-information-${item.id}-name`}
                  value={item.name}
                  required
                  onChange={(event) =>
                    update(index, { name: event.target.value })
                  }
                />
              </label>
              <label>
                Quelle
                <input
                  name={`${stepId}-information-${item.id}-source`}
                  value={item.source ?? ""}
                  placeholder="Noch unbekannt"
                  onChange={(event) =>
                    update(index, { source: event.target.value || null })
                  }
                />
              </label>
              <label>
                Art
                <select
                  name={`${stepId}-information-${item.id}-type`}
                  value={item.type}
                  onChange={(event) =>
                    update(index, {
                      type: event.target.value as InformationItem["type"],
                    })
                  }
                >
                  {Object.entries(informationTypeCopy).map(([value, label]) => (
                    <option value={value} key={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <IconButton
                label={`Information ${index + 1} entfernen`}
                tone="danger"
                className="nested-remove-button"
                onClick={() =>
                  onChange(items.filter((_, itemIndex) => itemIndex !== index))
                }
              >
                <Trash2 />
              </IconButton>
            </fieldset>
          ))}
        </div>
      ) : (
        <p className="empty-value">Keine Informationen benannt</p>
      )}
    </section>
  );
}
