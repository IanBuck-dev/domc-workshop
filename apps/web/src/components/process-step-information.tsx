import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { ProcessUnderstanding } from "../lib/process-types";
import { Button, IconButton } from "./ui/button";
import { cn } from "../lib/utils";

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
  other: "Andere Art eingeben …",
  unknown: "Art noch unbekannt",
};

const unknownSource = "__unknown_source__";
const customSource = "__custom_source__";

export function ProcessStepInformation({
  stepId,
  items,
  sourceOptions = [],
  isEditMode = false,
  onChange = () => undefined,
}: {
  stepId?: string;
  items: InformationItem[];
  sourceOptions?: string[];
  isEditMode?: boolean;
  onChange?: (items: InformationItem[]) => void;
}) {
  const [customSourceIds, setCustomSourceIds] = useState<Set<string>>(
    new Set(),
  );

  useEffect(() => {
    if (!isEditMode) setCustomSourceIds(new Set());
  }, [isEditMode]);

  function update(index: number, next: Partial<InformationItem>) {
    onChange(
      items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...next } : item,
      ),
    );
  }

  if (!isEditMode)
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
                    <td data-label="Art">
                      {item.type === "other" && item.typeDetail
                        ? item.typeDetail
                        : informationTypeCopy[item.type]}
                    </td>
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

  const idPrefix = stepId ?? "step";
  return (
    <section
      className={cn(
        "step-editor-section",
        items.length === 0 && "missing-field",
      )}
    >
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
                typeDetail: null,
              },
            ])
          }
        >
          <Plus /> Information hinzufügen
        </Button>
      </div>
      {items.length === 0 && (
        <span className="missing-field-label">Angabe fehlt</span>
      )}
      {items.length ? (
        <div className="nested-editor-list">
          {items.map((item, index) => {
            const sourceIsCustom =
              customSourceIds.has(item.id) ||
              (item.source !== null &&
                item.source !== "" &&
                !sourceOptions.includes(item.source));
            const sourceValue = sourceIsCustom
              ? customSource
              : (item.source ?? unknownSource);
            return (
              <div className="information-editor-card" key={item.id}>
                <fieldset className="information-editor-row">
                  <legend>Information {index + 1}</legend>
                  <label className={!item.name.trim() ? "missing-field" : ""}>
                    Information
                    <input
                      name={`${idPrefix}-information-${item.id}-name`}
                      value={item.name}
                      required
                      aria-invalid={!item.name.trim()}
                      onChange={(event) =>
                        update(index, { name: event.target.value })
                      }
                    />
                    {!item.name.trim() && (
                      <span className="missing-field-label">Angabe fehlt</span>
                    )}
                  </label>
                  <label
                    className={item.source === null ? "missing-field" : ""}
                  >
                    Quelle
                    <select
                      name={`${idPrefix}-information-${item.id}-source-select`}
                      value={sourceValue}
                      aria-describedby={
                        item.source === null
                          ? `${idPrefix}-${item.id}-source-missing`
                          : undefined
                      }
                      onChange={(event) => {
                        const value = event.target.value;
                        if (value === customSource) {
                          setCustomSourceIds((current) =>
                            new Set(current).add(item.id),
                          );
                          update(index, { source: "" });
                          return;
                        }
                        setCustomSourceIds((current) => {
                          const next = new Set(current);
                          next.delete(item.id);
                          return next;
                        });
                        update(index, {
                          source: value === unknownSource ? null : value,
                        });
                      }}
                    >
                      <option value={unknownSource}>
                        Quelle noch unbekannt
                      </option>
                      {sourceOptions.map((source) => (
                        <option value={source} key={source}>
                          {source}
                        </option>
                      ))}
                      <option value={customSource}>
                        Andere Quelle eingeben …
                      </option>
                    </select>
                    {item.source === null && (
                      <span
                        className="missing-field-label"
                        id={`${idPrefix}-${item.id}-source-missing`}
                      >
                        Angabe fehlt
                      </span>
                    )}
                  </label>
                  {sourceIsCustom && (
                    <label
                      className={!item.source?.trim() ? "missing-field" : ""}
                    >
                      Andere Quelle
                      <input
                        name={`${idPrefix}-information-${item.id}-source`}
                        value={item.source ?? ""}
                        required
                        aria-invalid={!item.source?.trim()}
                        placeholder="Quelle benennen"
                        onChange={(event) =>
                          update(index, { source: event.target.value })
                        }
                      />
                      {!item.source?.trim() && (
                        <span className="missing-field-label">
                          Angabe fehlt
                        </span>
                      )}
                    </label>
                  )}
                  <label
                    className={item.type === "unknown" ? "missing-field" : ""}
                  >
                    Art
                    <select
                      name={`${idPrefix}-information-${item.id}-type`}
                      value={item.type}
                      aria-describedby={
                        item.type === "unknown"
                          ? `${idPrefix}-${item.id}-type-missing`
                          : undefined
                      }
                      onChange={(event) => {
                        const type = event.target
                          .value as InformationItem["type"];
                        update(index, {
                          type,
                          typeDetail: type === "other" ? "" : null,
                        });
                      }}
                    >
                      {Object.entries(informationTypeCopy).map(
                        ([value, label]) => (
                          <option value={value} key={value}>
                            {label}
                          </option>
                        ),
                      )}
                    </select>
                    {item.type === "unknown" && (
                      <span
                        className="missing-field-label"
                        id={`${idPrefix}-${item.id}-type-missing`}
                      >
                        Angabe fehlt
                      </span>
                    )}
                  </label>
                  {item.type === "other" && (
                    <label
                      className={
                        !item.typeDetail?.trim() ? "missing-field" : ""
                      }
                    >
                      Andere Art
                      <input
                        name={`${idPrefix}-information-${item.id}-type-detail`}
                        value={item.typeDetail ?? ""}
                        required
                        maxLength={200}
                        aria-invalid={!item.typeDetail?.trim()}
                        placeholder="Informationsart benennen"
                        onChange={(event) =>
                          update(index, { typeDetail: event.target.value })
                        }
                      />
                      {!item.typeDetail?.trim() && (
                        <span className="missing-field-label">
                          Angabe fehlt
                        </span>
                      )}
                    </label>
                  )}
                </fieldset>
                <IconButton
                  label={`Information ${index + 1} entfernen`}
                  tone="danger"
                  className="nested-remove-button"
                  onClick={() =>
                    onChange(
                      items.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                >
                  <Trash2 />
                </IconButton>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
