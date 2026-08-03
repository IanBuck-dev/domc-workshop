import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { ProcessUnderstanding } from "../lib/process-types";
import { Button, IconButton } from "./ui/button";
import { Input } from "./ui/input";
import { NativeSelect } from "./ui/native-select";
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
      <section className="grid gap-2">
        <h3 className="text-base font-semibold">Informationen</h3>
        {items.length ? (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[34rem] text-sm">
              <thead>
                <tr className="border-b bg-muted text-left">
                  <th className="px-4 py-3 font-semibold" scope="col">
                    Information
                  </th>
                  <th className="px-4 py-3 font-semibold" scope="col">
                    Quelle
                  </th>
                  <th className="px-4 py-3 font-semibold" scope="col">
                    Art
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr className="border-b last:border-b-0" key={item.id}>
                    <td className="px-4 py-3" data-label="Information">
                      {item.name}
                    </td>
                    <td className="px-4 py-3" data-label="Quelle">
                      {item.source ?? "Quelle noch unbekannt"}
                    </td>
                    <td className="px-4 py-3" data-label="Art">
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
          <p className="text-sm text-muted-foreground">
            Keine Informationen benannt
          </p>
        )}
      </section>
    );

  const idPrefix = stepId ?? "step";
  return (
    <section
      className={cn(
        "grid gap-3 rounded-lg border bg-muted p-4",
        items.length === 0 && "border-destructive bg-destructive/5",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-semibold">Informationen</h3>
        <Button
          variant="secondary"
          className="h-8 px-3 text-xs"
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
        <span className="text-xs font-semibold text-destructive">
          Angabe fehlt
        </span>
      )}
      {items.length ? (
        <div className="grid gap-3">
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
              <div
                className="relative rounded-lg border bg-card p-4"
                key={item.id}
              >
                <fieldset className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <legend>Information {index + 1}</legend>
                  <label
                    className={cn(
                      "grid gap-2 text-sm font-semibold",
                      !item.name.trim() && "rounded-md bg-destructive/10 p-2",
                    )}
                  >
                    <span>Information</span>
                    <Input
                      name={`${idPrefix}-information-${item.id}-name`}
                      value={item.name}
                      required
                      aria-invalid={!item.name.trim()}
                      onChange={(event) =>
                        update(index, { name: event.target.value })
                      }
                    />
                    {!item.name.trim() && (
                      <span className="text-xs text-destructive">
                        Angabe fehlt
                      </span>
                    )}
                  </label>
                  <label
                    className={cn(
                      "grid gap-2 text-sm font-semibold",
                      item.source === null &&
                        "rounded-md bg-destructive/10 p-2",
                    )}
                  >
                    <span>Quelle</span>
                    <NativeSelect
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
                    </NativeSelect>
                    {item.source === null && (
                      <span
                        className="text-xs text-destructive"
                        id={`${idPrefix}-${item.id}-source-missing`}
                      >
                        Angabe fehlt
                      </span>
                    )}
                  </label>
                  {sourceIsCustom && (
                    <label
                      className={cn(
                        "grid gap-2 text-sm font-semibold",
                        !item.source?.trim() &&
                          "rounded-md bg-destructive/10 p-2",
                      )}
                    >
                      Andere Quelle
                      <Input
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
                        <span className="text-xs text-destructive">
                          Angabe fehlt
                        </span>
                      )}
                    </label>
                  )}
                  <label
                    className={cn(
                      "grid gap-2 text-sm font-semibold",
                      item.type === "unknown" &&
                        "rounded-md bg-destructive/10 p-2",
                    )}
                  >
                    <span>Art</span>
                    <NativeSelect
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
                    </NativeSelect>
                    {item.type === "unknown" && (
                      <span
                        className="text-xs text-destructive"
                        id={`${idPrefix}-${item.id}-type-missing`}
                      >
                        Angabe fehlt
                      </span>
                    )}
                  </label>
                  {item.type === "other" && (
                    <label
                      className={cn(
                        "grid gap-2 text-sm font-semibold",
                        !item.typeDetail?.trim() &&
                          "rounded-md bg-destructive/10 p-2",
                      )}
                    >
                      <span>Andere Art</span>
                      <Input
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
                        <span className="text-xs text-destructive">
                          Angabe fehlt
                        </span>
                      )}
                    </label>
                  )}
                </fieldset>
                <IconButton
                  label={`Information ${index + 1} entfernen`}
                  tone="danger"
                  className="absolute right-3 top-3"
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
