import type { CurrentStateDetails } from "../lib/process-types";
import { Card } from "./ui/card";

function displayValue(value: unknown): string {
  if (value === null || value === undefined) return "Nicht bekannt";
  if (typeof value === "string")
    return (
      {
        internal: "Intern",
        confidential: "Vertraulich",
        strictly_confidential: "Streng vertraulich",
      }[value] ?? value
    );
  if (Array.isArray(value))
    return value.length
      ? value
          .map((item) => (typeof item === "string" ? item : displayValue(item)))
          .join(" · ")
      : "Keine Einträge";
  if (typeof value === "object") {
    const item = value as Record<string, unknown>;
    if (typeof item.role === "string" && typeof item.department === "string")
      return `${item.role} — ${item.department}`;
    if (typeof item.description === "string") return item.description;
    if (typeof item.name === "string") return item.name;
  }
  return "Angabe vorhanden";
}

export function ProcessCurrentStateDetails({
  details,
}: {
  details: CurrentStateDetails | null;
}) {
  if (!details) return null;
  const rows = [
    ["Kurzbeschreibung", details.currentStateSummary],
    ["Prozesseigner", details.processOwner],
    ["Vertraulichkeit", details.confidentiality],
    ["Systeme", details.systems],
    ["Pain Points", details.painPoints],
    ["Varianten und Ausnahmen", details.variations],
    ["Betrieb und Support", details.operationalContext.operationAndSupport],
    [
      "Berechtigung und Schutzbedarf",
      details.operationalContext.accessAndProtection,
    ],
    [
      "Monitoring und Nachvollziehbarkeit",
      details.operationalContext.monitoringAndTraceability,
    ],
    [
      "Offene Leitplanken",
      details.operationalContext.constraintsAndOpenQuestions,
    ],
  ];
  return (
    <Card className="p-6">
      <h2 className="text-heading">PDD-Checkliste: Ist-Zustand</h2>
      <p className="mt-2 text-muted-foreground">
        Diese Angaben werden vor der Bestätigung geprüft und in die Arbeitsmappe
        übernommen.
      </p>
      <dl className="mt-5 grid gap-4 md:grid-cols-2">
        {rows.map(([label, fact]) => {
          const qualified = fact as {
            state: string;
            value: unknown;
            reason: string | null;
          };
          return (
            <div key={label as string}>
              <dt className="text-label font-semibold">{label as string}</dt>
              <dd className="mt-1 whitespace-pre-line text-ui">
                {qualified.state === "known"
                  ? displayValue(qualified.value)
                  : `Offen: ${qualified.reason ?? "Nicht bekannt"}`}
              </dd>
            </div>
          );
        })}
      </dl>
    </Card>
  );
}
