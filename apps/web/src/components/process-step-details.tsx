import type { ProcessUnderstanding } from "../lib/process-types";
import {
  ProcessStepDecisions,
  decisionModeCopy,
} from "./process-step-decisions";
import {
  ProcessStepInformation,
  informationTypeCopy,
} from "./process-step-information";
import { Badge } from "./ui/badge";

type Step = ProcessUnderstanding["steps"][number];

/**
 * Schreibgeschützte Schrittdetails in derselben Reihenfolge und Sprache wie die
 * Schrittkarten der Formularerfassung.
 *
 * `wide` nutzt die vorhandenen Lesetabellen. `compact` ist für die schmale
 * Prozessbild-Spalte gedacht: dieselben Abschnitte, aber ohne Tabellen, die dort
 * ihre Mindestbreite nicht bekommen.
 *
 * Im kompakten Zweig läuft alles auf `text-caption` — derselben Größe wie die
 * Aktivitätszeile im Kartenkopf, damit auf- und zugeklappt gleich wirken.
 * Abgesetzt sind nur die Abschnittsüberschriften über `text-overline`
 * (gleiche Größe, aber fett, versal und gesperrt). Rangfolge entsteht sonst
 * über Schriftschnitt und Farbe, nicht über weitere Stufen — sonst zerfällt die
 * schmale Spalte optisch in mehrere Blöcke.
 */
export function ProcessStepDetails({
  step,
  steps,
  layout = "wide",
}: {
  step: Step;
  steps: ProcessUnderstanding["steps"];
  layout?: "wide" | "compact";
}) {
  const compact = layout === "compact";
  return (
    <div className={compact ? "grid gap-5" : "grid gap-6"}>
      <StepValues title="Input" values={step.inputs ?? []} compact={compact} />
      <StepValues
        title="Output"
        values={step.outputs ?? []}
        compact={compact}
      />
      {compact ? (
        <CompactInformation items={step.informationItems ?? []} />
      ) : (
        <ProcessStepInformation
          stepId={step.id}
          items={step.informationItems ?? []}
        />
      )}
      {compact ? (
        <CompactDecisions decisions={step.decisions ?? []} steps={steps} />
      ) : (
        <ProcessStepDecisions
          stepId={step.id}
          decisions={step.decisions ?? []}
          steps={steps}
        />
      )}
      <section className="grid gap-2">
        <SectionHeading compact={compact}>Sonstiges</SectionHeading>
        <p
          className={
            compact
              ? step.miscellaneous
                ? "text-caption"
                : "text-caption text-muted-foreground"
              : "text-muted-foreground"
          }
        >
          {step.miscellaneous ?? "Keine weiteren Angaben"}
        </p>
      </section>
    </div>
  );
}

function SectionHeading({
  compact,
  children,
}: {
  compact: boolean;
  children: string;
}) {
  if (compact)
    return (
      <h3 className="text-overline uppercase text-muted-foreground">
        {children}
      </h3>
    );
  return <h3 className="text-subheading">{children}</h3>;
}

function StepValues({
  title,
  values,
  compact,
}: {
  title: "Input" | "Output";
  values: string[];
  compact: boolean;
}) {
  return (
    <section className="grid gap-2">
      <SectionHeading compact={compact}>{title}</SectionHeading>
      {values.length ? (
        // Kompakt: Inhalte in Textfarbe, nur die Aufzählungspunkte gedämpft —
        // in der schmalen Spalte ist durchgehend graue Schrift schwer zu lesen.
        <ul
          className={
            compact
              ? "grid list-disc gap-1 pl-4 text-caption marker:text-muted-foreground"
              : "list-disc space-y-1 pl-5 text-muted-foreground"
          }
        >
          {values.map((value) => (
            <li key={value}>{value}</li>
          ))}
        </ul>
      ) : (
        <p
          className={
            compact
              ? "text-caption text-muted-foreground"
              : "text-ui text-muted-foreground"
          }
        >
          Noch nicht bekannt
        </p>
      )}
    </section>
  );
}

function CompactInformation({ items }: { items: Step["informationItems"] }) {
  return (
    <section className="grid gap-2">
      <SectionHeading compact>Informationen</SectionHeading>
      {items.length ? (
        // Kein Kasten im Kasten: Eine Linie links reicht, um die Einträge
        // gegeneinander abzusetzen, und spart Breite in der schmalen Spalte.
        <ul className="grid gap-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="border-l-2 border-border pl-3 text-caption"
            >
              <p className="font-medium">{item.name}</p>
              <p className="text-muted-foreground">
                {item.source ?? "Quelle noch unbekannt"} ·{" "}
                {item.type === "other"
                  ? (item.typeDetail ?? "Andere Art")
                  : informationTypeCopy[item.type]}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-caption text-muted-foreground">
          Keine Informationen benannt
        </p>
      )}
    </section>
  );
}

function CompactDecisions({
  decisions,
  steps,
}: {
  decisions: Step["decisions"];
  steps: ProcessUnderstanding["steps"];
}) {
  const stepById = new Map(steps.map((item) => [item.id, item]));
  return (
    <section className="grid gap-2">
      <SectionHeading compact>Varianten und Entscheidungen</SectionHeading>
      {decisions.length ? (
        <ul className="grid gap-4">
          {decisions.map((decision) => (
            <li
              key={decision.id}
              className="grid gap-2 border-l-2 border-border pl-3 text-caption"
            >
              {/* Halbfett gegen die Optionen darunter, die nur `font-medium`
                  tragen — sonst liest sich der Block als eine Ebene. */}
              <p className="font-semibold">{decision.question}</p>
              <Badge variant="outline" className="justify-self-start">
                {decisionModeCopy[decision.mode]}
              </Badge>
              {decision.options.length ? (
                <ul className="grid gap-2">
                  {decision.options.map((option) => {
                    const next = option.nextStepId
                      ? stepById.get(option.nextStepId)
                      : undefined;
                    return (
                      <li key={option.id}>
                        <span className="font-medium">{option.label}</span>
                        <span className="block text-muted-foreground">
                          {option.determination ??
                            "Feststellung noch unbekannt"}{" "}
                          → {option.consequence ?? "Folge noch unbekannt"}
                        </span>
                        {next && (
                          // Nur die Nummer: Der volle Schrittname stünde hier
                          // ein zweites Mal und nähme zwei weitere Zeilen.
                          <span
                            className="block text-muted-foreground"
                            title={next.name}
                          >
                            Weiter mit Schritt {next.order}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-caption text-muted-foreground">
                  Entscheidungsoptionen noch unbekannt
                </p>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-caption text-muted-foreground">
          Keine Entscheidung erforderlich oder benannt
        </p>
      )}
    </section>
  );
}
