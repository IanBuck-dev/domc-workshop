import type {
  OpportunityHypothesis,
  OpportunityHypothesisResult,
} from "../lib/opportunity-types";
import type { ProcessUnderstanding } from "../lib/process-types";
import { Badge, type BadgeTone } from "./ui/badge";
import { Card } from "./ui/card";

const level = { high: "Hoch", medium: "Mittel", low: "Niedrig" } as const;
/* Hoch, Mittel und Niedrig sind eine Einschätzung, keine Warnung. */
const levelTone: Record<keyof typeof level, BadgeTone> = {
  high: "success",
  medium: "warning",
  low: "neutral",
};
const capability = {
  interpretation: "Interpretation",
  generation: "Generierung",
  recognition: "Erkennung",
  prediction: "Vorhersage",
  recommendation: "Empfehlung",
  planning: "Planung",
} as const;

export function OpportunityHypothesesView({
  result,
  understanding,
}: {
  result: OpportunityHypothesisResult;
  understanding: ProcessUnderstanding;
}) {
  const steps = new Map(understanding.steps.map((step) => [step.id, step]));
  const evidence = new Map(
    understanding.evidence.map((item) => [item.id, item]),
  );
  return (
    <div className="space-y-5">
      {result.stepAnalyses.map((analysis) => {
        const step = steps.get(analysis.processStepId);
        return (
          <Card
            as="section"
            className="gap-5 p-6 sm:p-8"
            key={analysis.processStepId}
          >
            <header className="flex gap-4">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-label text-primary-foreground">
                {step?.order ?? "–"}
              </span>
              <div>
                <h2 className="text-heading">
                  {step?.name ?? analysis.processStepId}
                </h2>
                <p className="mt-1 text-muted-foreground">{analysis.summary}</p>
              </div>
            </header>
            {analysis.hypotheses.length ? (
              <div className="space-y-3">
                {analysis.hypotheses.map((item) => (
                  <HypothesisCard
                    key={item.id}
                    item={item}
                    evidence={evidence}
                  />
                ))}
              </div>
            ) : (
              <p className="rounded-lg border bg-muted px-4 py-3 text-ui text-muted-foreground">
                {analysis.noPotentialRationale}
              </p>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function HypothesisCard({
  item,
  evidence,
}: {
  item: OpportunityHypothesis;
  evidence: Map<string, ProcessUnderstanding["evidence"][number]>;
}) {
  return (
    <article className="space-y-4 rounded-lg border bg-muted p-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row">
        <div>
          <small className="font-semibold text-muted-foreground">
            {item.id}
          </small>
          <h3 className="mt-1 text-heading">{item.title}</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone={levelTone[item.potentialLevel]}>
            Potenzial: {level[item.potentialLevel]}
          </Badge>
          <Badge tone={levelTone[item.confidenceLevel]}>
            Konfidenz: {level[item.confidenceLevel]}
          </Badge>
        </div>
      </div>
      <p className="text-muted-foreground">{item.aiContribution}</p>
      <div className="flex flex-wrap gap-2" aria-label="KI-Fähigkeiten">
        {item.aiCapabilities.map((item) => (
          <Badge key={item} tone="accent">
            {capability[item]}
          </Badge>
        ))}
      </div>
      <dl className="grid gap-3 md:grid-cols-2">
        <div className="rounded-md bg-card p-4">
          <dt className="font-semibold">Warum dieses Potenzial?</dt>
          <dd className="mt-1 text-ui text-muted-foreground">
            {item.potentialRationale}
          </dd>
        </div>
        <div className="rounded-md bg-card p-4">
          <dt className="font-semibold">Wie sicher ist die Ableitung?</dt>
          <dd className="mt-1 text-ui text-muted-foreground">
            {item.confidenceRationale}
          </dd>
        </div>
      </dl>
      {item.confidenceLevel !== "high" && (
        <p className="border-l-4 border-amber-700 pl-3 text-ui text-amber-950">
          Vor einer Umsetzung sind die offenen Fachinformationen mit dem
          Fachbereich zu klären.
        </p>
      )}
      <details className="border-t pt-4">
        <summary className="cursor-pointer font-semibold text-primary">
          Grundlage und weitere Details
        </summary>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <section>
            <h4 className="font-semibold">Heutige Ausgangslage</h4>
            <p className="mt-1 text-ui text-muted-foreground">
              {item.currentSituation}
            </p>
            <h4 className="mt-4 font-semibold">Erwartete Veränderung</h4>
            <p className="mt-1 text-ui text-muted-foreground">
              {item.expectedChange}
            </p>
            <h4 className="mt-4 font-semibold">Rolle des Menschen</h4>
            <p className="mt-1 text-ui text-muted-foreground">
              {item.expectedHumanRole}
            </p>
          </section>
          <List
            title="Unterstützende feste Abläufe"
            items={item.supportingDeterministicAutomation}
          />
          <List
            title="Informationen und Systemzugriffe"
            items={item.requiredInformationAndSystemAccess}
          />
          <List title="Offene Fragen" items={item.openQuestions} />
          <List
            title="Annahmen"
            items={item.assumptions.map(
              (assumption) =>
                `${assumption.text}${assumption.material ? " (wesentlich)" : ""}`,
            )}
          />
          <List
            title="Evidenz"
            items={item.evidenceIds.map(
              (id) => evidence.get(id)?.excerpt ?? id,
            )}
          />
        </div>
      </details>
    </article>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <section className="rounded-md bg-card p-4">
      <h4 className="font-semibold">{title}</h4>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-ui text-muted-foreground">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
