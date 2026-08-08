import type { ProcessUnderstanding } from "../lib/process-types";
import {
  ProcessStepDecisions,
  decisionModeCopy,
  gatewayForStep,
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
  flow,
  layout = "wide",
}: {
  step: Step;
  steps: ProcessUnderstanding["steps"];
  flow: ProcessUnderstanding["flow"];
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
        <CompactDecisions stepId={step.id} flow={flow} steps={steps} />
      ) : (
        <ProcessStepDecisions stepId={step.id} flow={flow} steps={steps} />
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
  stepId,
  flow,
  steps,
}: {
  stepId: string;
  flow: ProcessUnderstanding["flow"];
  steps: ProcessUnderstanding["steps"];
}) {
  const { gateway, edges } = gatewayForStep(flow, stepId);
  const targetLabel = (targetId: string) => {
    const target = flow.nodes.find((node) => node.id === targetId);
    if (target?.kind === "step") {
      const step = steps.find((item) => item.id === target.stepId);
      return step ? `Weiter mit Schritt ${step.order}` : "Ziel unbekannt";
    }
    return target?.kind === "endEvent" ? "Prozessende" : "Ziel unbekannt";
  };
  return (
    <section className="grid gap-2">
      <SectionHeading compact>Varianten und Entscheidungen</SectionHeading>
      {gateway ? (
        <div className="grid gap-2 border-l-2 border-border pl-3 text-caption">
          <p className="font-semibold">{gateway.question}</p>
          <Badge variant="outline" className="justify-self-start">
            {decisionModeCopy[gateway.mode]}
          </Badge>
          <ul className="grid gap-2">
            {edges.map((edge) => (
              <li key={edge.id}>
                <span className="font-medium">{edge.label}</span>
                <span className="block text-muted-foreground">
                  {edge.determination ?? "Feststellung noch unbekannt"} →{" "}
                  {edge.consequence ?? "Folge noch unbekannt"}
                </span>
                <span className="block text-muted-foreground">
                  {targetLabel(edge.target)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-caption text-muted-foreground">
          Keine Entscheidung erforderlich oder benannt
        </p>
      )}
    </section>
  );
}
