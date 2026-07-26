import type {
  OpportunityHypothesis,
  OpportunityScenario,
} from "../lib/opportunity-types";

const copy = {
  assistive: {
    title: "Assistiert",
    subtitle: "Mensch führt aus",
  },
  delegated: {
    title: "Teilautonom",
    subtitle: "Mensch bestätigt wichtige Schritte",
  },
  agentic: {
    title: "Agentisch",
    subtitle: "Mensch überwacht und übernimmt kritische Fälle",
  },
} as const;
const execution = {
  autonomous: "Innerhalb der Leitplanken autonom",
  approval_required: "Menschliche Freigabe erforderlich",
  human_only: "Bleibt vollständig beim Menschen",
} as const;
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
}: {
  scenarios: OpportunityScenario[];
  hypotheses: OpportunityHypothesis[];
}) {
  const hypothesis = new Map(hypotheses.map((item) => [item.id, item]));
  return (
    <div className="scenario-grid">
      {scenarios.map((scenario) => (
        <ScenarioCard
          key={scenario.id}
          scenario={scenario}
          hypothesis={hypothesis}
        />
      ))}
    </div>
  );
}

function ScenarioCard({
  scenario,
  hypothesis,
}: {
  scenario: OpportunityScenario;
  hypothesis: Map<string, OpportunityHypothesis>;
}) {
  const label = copy[scenario.level];
  return (
    <article className={`panel scenario-card scenario-${scenario.level}`}>
      <header>
        <span className="scenario-level">{label.title}</span>
        <small>{label.subtitle}</small>
        <h2>{scenario.title}</h2>
        <p>{scenario.summary}</p>
      </header>
      <section>
        <h3>Zielbild</h3>
        <p>{scenario.targetState}</p>
      </section>
      <ScenarioList
        title="Enthaltene Potenziale"
        items={scenario.includedHypothesisIds.map(
          (id) => hypothesis.get(id)?.title ?? id,
        )}
      />
      {!!scenario.excludedHypotheses.length && (
        <section>
          <h3>Nicht enthaltene Potenziale</h3>
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
      <section>
        <h3>Aktionen und Kontrolle</h3>
        <div className="scenario-actions">
          {scenario.actions.map((action, index) => (
            <article key={`${index}-${action.name}-${action.executionMode}`}>
              <b>{action.name}</b>
              <span className={`execution execution-${action.executionMode}`}>
                {execution[action.executionMode]}
              </span>
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
      <details>
        <summary>Voraussetzungen und technische Zugriffe</summary>
        <div className="scenario-details">
          <ScenarioList
            title="Feste Automation"
            items={scenario.deterministicAutomation}
          />
          <ScenarioList title="Orchestrierung" items={scenario.orchestration} />
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
              <h3>{access.target}</h3>
              <p>
                Zugriff:{" "}
                {access.accessModes.map((item) => accessModes[item]).join(", ")}{" "}
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
          <ScenarioList title="Offene Fragen" items={scenario.openQuestions} />
        </div>
      </details>
      <footer>
        <b>
          Konfidenz:{" "}
          {scenario.confidenceLevel === "high"
            ? "Hoch"
            : scenario.confidenceLevel === "medium"
              ? "Mittel"
              : "Niedrig"}
        </b>
        <p>{scenario.confidenceRationale}</p>
      </footer>
    </article>
  );
}

function ScenarioList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <section>
      <h3>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
