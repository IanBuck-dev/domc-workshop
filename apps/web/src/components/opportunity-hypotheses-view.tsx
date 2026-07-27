import type {
  OpportunityHypothesis,
  OpportunityHypothesisResult,
} from "../lib/opportunity-types";
import type { ProcessUnderstanding } from "../lib/process-types";
import { Badge, type BadgeTone } from "./ui/badge";

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
    <div className="hypothesis-groups">
      {result.stepAnalyses.map((analysis) => {
        const step = steps.get(analysis.processStepId);
        return (
          <section className="hypothesis-step" key={analysis.processStepId}>
            <header>
              <span>{step?.order ?? "–"}</span>
              <div>
                <h2>{step?.name ?? analysis.processStepId}</h2>
                <p>{analysis.summary}</p>
              </div>
            </header>
            {analysis.hypotheses.length ? (
              <div className="hypothesis-list">
                {analysis.hypotheses.map((item) => (
                  <HypothesisCard
                    key={item.id}
                    item={item}
                    evidence={evidence}
                  />
                ))}
              </div>
            ) : (
              <p className="notice neutral">{analysis.noPotentialRationale}</p>
            )}
          </section>
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
    <article className="hypothesis-card">
      <div className="hypothesis-card-head">
        <div>
          <small>{item.id}</small>
          <h3>{item.title}</h3>
        </div>
        <div className="hypothesis-levels">
          <Badge tone={levelTone[item.potentialLevel]}>
            Potenzial: {level[item.potentialLevel]}
          </Badge>
          <Badge tone={levelTone[item.confidenceLevel]}>
            Konfidenz: {level[item.confidenceLevel]}
          </Badge>
        </div>
      </div>
      <p>{item.aiContribution}</p>
      <div className="capability-list" aria-label="KI-Fähigkeiten">
        {item.aiCapabilities.map((item) => (
          <Badge key={item} tone="accent">
            {capability[item]}
          </Badge>
        ))}
      </div>
      <dl className="hypothesis-rationales">
        <div>
          <dt>Warum dieses Potenzial?</dt>
          <dd>{item.potentialRationale}</dd>
        </div>
        <div>
          <dt>Wie sicher ist die Ableitung?</dt>
          <dd>{item.confidenceRationale}</dd>
        </div>
      </dl>
      {item.confidenceLevel !== "high" && (
        <p className="not-used-note">
          Diese Hypothese wurde wegen ihrer Konfidenz nicht für die Szenarien
          verwendet.
        </p>
      )}
      <details>
        <summary>Grundlage und weitere Details</summary>
        <div className="hypothesis-details">
          <section>
            <h4>Heutige Ausgangslage</h4>
            <p>{item.currentSituation}</p>
            <h4>Erwartete Veränderung</h4>
            <p>{item.expectedChange}</p>
            <h4>Rolle des Menschen</h4>
            <p>{item.expectedHumanRole}</p>
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
    <section>
      <h4>{title}</h4>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
