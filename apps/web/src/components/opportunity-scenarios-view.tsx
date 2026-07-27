import { ChevronDown, X } from "lucide-react";
import { useId, useState } from "react";
import type {
  OpportunityHypothesis,
  OpportunityScenario,
} from "../lib/opportunity-types";
import type { ProcessUnderstanding } from "../lib/process-types";
import { Badge, type BadgeTone } from "./ui/badge";
import { IconButton } from "./ui/button";
import { Card } from "./ui/card";
import { Meter } from "./ui/meter";

type ProcessStep = ProcessUnderstanding["steps"][number];

const copy = {
  assistive: {
    rank: 1,
    title: "Assistiert",
    humanRole: "Mensch führt aus",
  },
  delegated: {
    rank: 2,
    title: "Teilautonom",
    humanRole: "Mensch bestätigt wichtige Schritte",
  },
  agentic: {
    rank: 3,
    title: "Agentisch",
    humanRole: "Mensch überwacht und übernimmt kritische Fälle",
  },
} as const;
const confidence = {
  high: { label: "Hoch", filled: 3 },
  medium: { label: "Mittel", filled: 2 },
  low: { label: "Niedrig", filled: 1 },
} as const;
const capabilities = {
  interpretation: "Interpretation",
  generation: "Generierung",
  recognition: "Erkennung",
  prediction: "Vorhersage",
  recommendation: "Empfehlung",
  planning: "Planung",
} as const;
const execution = {
  autonomous: "Innerhalb der Leitplanken autonom",
  approval_required: "Menschliche Freigabe erforderlich",
  human_only: "Bleibt vollständig beim Menschen",
} as const;
/* Je weniger die KI allein entscheidet, desto zurückhaltender das Etikett. */
const executionTone: Record<keyof typeof execution, BadgeTone> = {
  autonomous: "success",
  approval_required: "warning",
  human_only: "neutral",
};
const mechanisms = {
  manual: "Manuelle Übergabe",
  file_exchange: "Dateiaustausch",
  api: "Programmierschnittstelle (API)",
  connector: "Freigegebener Connector",
  mcp: "Freigegebener Werkzeugzugriff (MCP)",
  ui_automation: "Bedienung der Benutzeroberfläche",
  unknown: "Zugriffsweg noch ungeklärt",
} as const;
const accessModes = {
  read: "lesen",
  write: "schreiben",
  observe: "beobachten",
  act: "Aktionen ausführen",
} as const;
const accessTimings = {
  manual: "manuell",
  on_demand: "bei Bedarf",
  event_driven: "ereignisgesteuert",
} as const;

export function OpportunityScenariosView({
  scenarios,
  hypotheses,
  steps,
}: {
  scenarios: OpportunityScenario[];
  hypotheses: OpportunityHypothesis[];
  steps: ProcessStep[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const headingId = useId();
  const panelId = useId();
  const hypothesis = new Map(hypotheses.map((item) => [item.id, item]));
  const stepById = new Map(steps.map((step) => [step.id, step]));
  const openScenario =
    scenarios.find((scenario) => scenario.id === openId) ?? null;

  return (
    <section className="scenario-compare" aria-labelledby={headingId}>
      <header className="scenario-compare-head">
        <h2 id={headingId}>Drei Szenarien im Vergleich</h2>
        <p>
          Die Szenarien schließen einander aus. Sie unterscheiden sich darin,
          wie viel die KI eigenständig übernimmt und an welcher Stelle der
          Mensch entscheidet.
        </p>
      </header>
      <ol className="scenario-compare-grid">
        {scenarios.map((scenario) => (
          <ScenarioColumn
            key={scenario.id}
            scenario={scenario}
            totalProcessSteps={steps.length}
            open={openId === scenario.id}
            panelId={panelId}
            onToggle={() =>
              setOpenId((current) =>
                current === scenario.id ? null : scenario.id,
              )
            }
          />
        ))}
      </ol>
      {openScenario && (
        <ScenarioDetail
          id={panelId}
          scenario={openScenario}
          hypothesis={hypothesis}
          stepById={stepById}
          onClose={() => setOpenId(null)}
        />
      )}
    </section>
  );
}

function ScenarioColumn({
  scenario,
  totalProcessSteps,
  open,
  panelId,
  onToggle,
}: {
  scenario: OpportunityScenario;
  totalProcessSteps: number;
  open: boolean;
  panelId: string;
  onToggle: () => void;
}) {
  const label = copy[scenario.level];
  const score = confidence[scenario.confidenceLevel];
  const affected = scenario.affectedProcessStepIds.length;
  const included = scenario.includedHypothesisIds.length;

  return (
    <Card
      as="li"
      className={`scenario-column scenario-${scenario.level}${
        open ? " is-open" : ""
      }`}
    >
      <header className="scenario-column-head">
        <span className="scenario-rank" aria-hidden>
          {label.rank}
        </span>
        <span className="scenario-level">{label.title}</span>
        <Meter
          className="ladder"
          total={3}
          filled={label.rank}
          label={`KI-Autonomie: Stufe ${label.rank} von 3`}
        />
      </header>
      <h3 className="scenario-title">{scenario.title}</h3>
      <p className="scenario-pitch">{scenario.summary}</p>
      <div className="scenario-metric">
        <small>Konfidenz</small>
        <Meter
          className={`dots confidence-${scenario.confidenceLevel}`}
          total={3}
          filled={score.filled}
          label={`Konfidenz: ${score.label}`}
        />
        <strong>{score.label}</strong>
      </div>
      <div className="scenario-metric">
        <small>Betroffene Prozessschritte</small>
        <Meter
          className="steps"
          total={totalProcessSteps}
          filled={affected}
          label={`${affected} von ${totalProcessSteps} Prozessschritten betroffen`}
        />
        <strong>
          {affected} von {totalProcessSteps}
        </strong>
      </div>
      <div className="scenario-metric">
        <small>Enthaltene Potenziale</small>
        <strong>
          {included} {included === 1 ? "Potenzial" : "Potenziale"}
        </strong>
      </div>
      <div className="scenario-metric">
        <small>Rolle des Menschen</small>
        <span className="scenario-human-role">{label.humanRole}</span>
      </div>
      <div className="scenario-metric">
        <small>KI-Fähigkeiten</small>
        <ul className="capability-list">
          {scenario.aiCapabilities.map((item) => (
            <Badge as="li" key={item} tone="accent">
              {capabilities[item]}
            </Badge>
          ))}
        </ul>
      </div>
      <button
        type="button"
        className="scenario-toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
      >
        {open ? "Details schließen" : "Details ansehen"}
        <ChevronDown aria-hidden />
      </button>
    </Card>
  );
}

function ScenarioDetail({
  id,
  scenario,
  hypothesis,
  stepById,
  onClose,
}: {
  id: string;
  scenario: OpportunityScenario;
  hypothesis: Map<string, OpportunityHypothesis>;
  stepById: Map<string, ProcessStep>;
  onClose: () => void;
}) {
  const label = copy[scenario.level];
  const affectedSteps = scenario.affectedProcessStepIds
    .map((stepId) => stepById.get(stepId))
    .filter((step): step is ProcessStep => !!step)
    .sort((a, b) => a.order - b.order);

  return (
    <Card
      as="article"
      id={id}
      className={`scenario-detail scenario-${scenario.level}`}
    >
      <header className="scenario-detail-head">
        <div>
          <span className="scenario-level">{label.title}</span>
          <h3>{scenario.title}</h3>
        </div>
        <IconButton label="Details schließen" onClick={onClose}>
          <X aria-hidden />
        </IconButton>
      </header>
      <div className="scenario-detail-body">
        <section className="scenario-target-state">
          <h4>Zielbild</h4>
          <p>{scenario.targetState}</p>
        </section>
        {!!affectedSteps.length && (
          <section>
            <h4>Betroffene Prozessschritte</h4>
            <ol className="scenario-step-chips">
              {affectedSteps.map((step) => (
                <li key={step.id}>
                  <b>{step.order}</b> {step.name}
                </li>
              ))}
            </ol>
          </section>
        )}
        <div className="scenario-potential-grid">
          <ScenarioList
            title="Enthaltene Potenziale"
            items={scenario.includedHypothesisIds.map(
              (hypothesisId) =>
                hypothesis.get(hypothesisId)?.title ?? hypothesisId,
            )}
          />
          {!!scenario.excludedHypotheses.length && (
            <section>
              <h4>Nicht enthaltene Potenziale</h4>
              <ul>
                {scenario.excludedHypotheses.map((item) => (
                  <li key={item.hypothesisId}>
                    <b>
                      {hypothesis.get(item.hypothesisId)?.title ??
                        item.hypothesisId}
                      :
                    </b>{" "}
                    {item.rationale}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
        <div className="scenario-responsibility-grid">
          <ScenarioList
            title="Was ändert sich?"
            items={scenario.changesFromToday}
          />
          <ScenarioList
            title="Aufgaben der KI"
            items={scenario.aiResponsibilities}
          />
          <ScenarioList
            title="Aufgaben des Menschen"
            items={scenario.humanResponsibilities}
          />
        </div>
        <section className="scenario-actions-section">
          <h4>Aktionen und Kontrolle</h4>
          <div className="scenario-actions">
            {scenario.actions.map((action, index) => (
              <article key={`${index}-${action.name}-${action.executionMode}`}>
                <b>{action.name}</b>
                <Badge tone={executionTone[action.executionMode]}>
                  {execution[action.executionMode]}
                </Badge>
                <p>{action.description}</p>
                {!!action.controls.length && (
                  <small>Kontrollen: {action.controls.join(" · ")}</small>
                )}
                {!!action.escalationTriggers.length && (
                  <small>
                    Eskalation: {action.escalationTriggers.join(" · ")}
                  </small>
                )}
              </article>
            ))}
          </div>
        </section>
        <details className="scenario-technical-details">
          <summary>Voraussetzungen und technische Zugriffe</summary>
          <div className="scenario-details">
            <ScenarioList
              title="Feste Automation"
              items={scenario.deterministicAutomation}
            />
            <ScenarioList
              title="Orchestrierung"
              items={scenario.orchestration}
            />
            <ScenarioList
              title="Menschliche Überwachung"
              items={scenario.humanOversight}
            />
            <ScenarioList
              title="Benötigte Informationen und Unterlagen"
              items={scenario.informationAndDocuments}
            />
            {scenario.systemAccess.map((access, index) => (
              <section key={`${index}-${access.target}`}>
                <h4>{access.target}</h4>
                <p>
                  Zugriff:{" "}
                  {access.accessModes
                    .map((item) => accessModes[item])
                    .join(", ")}{" "}
                  · {accessTimings[access.timing]} ·{" "}
                  {access.possibleMechanisms
                    .map((item) => mechanisms[item])
                    .join(" oder ")}
                </p>
                {!!access.assumptions.length && (
                  <p>Annahme: {access.assumptions.join(" · ")}</p>
                )}
              </section>
            ))}
            <ScenarioList
              title="Voraussetzungen"
              items={scenario.prerequisites}
            />
            <ScenarioList
              title="Risiken und Fehlerbilder"
              items={scenario.risksAndFailureModes}
            />
            <ScenarioList title="Annahmen" items={scenario.assumptions} />
            <ScenarioList
              title="Offene Fragen"
              items={scenario.openQuestions}
            />
          </div>
        </details>
        <footer>
          <b>Konfidenz: {confidence[scenario.confidenceLevel].label}</b>
          <p>{scenario.confidenceRationale}</p>
        </footer>
      </div>
    </Card>
  );
}

function ScenarioList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <section>
      <h4>{title}</h4>
      <ul>
        {items.map((item, index) => (
          <li key={`${index}-${item}`}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
