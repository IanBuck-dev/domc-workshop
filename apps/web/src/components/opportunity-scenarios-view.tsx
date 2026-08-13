import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";
import type {
  OpportunityHypothesis,
  OpportunityScenario,
} from "../lib/opportunity-types";
import type { ProcessUnderstanding } from "../lib/process-types";
import { cn } from "../lib/utils";
import { Badge, type BadgeTone } from "./ui/badge";
import { Card } from "./ui/card";
import { Progress } from "./ui/progress";

type ProcessStep = ProcessUnderstanding["steps"][number];

const copy = {
  assistive: { rank: 1, title: "Assistiert", humanRole: "Mensch führt aus" },
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
  const hypothesis = new Map(hypotheses.map((item) => [item.id, item]));
  const stepById = new Map(steps.map((step) => [step.id, step]));
  const openScenario =
    scenarios.find((scenario) => scenario.id === openId) ?? null;

  return (
    <section aria-labelledby={headingId} className="space-y-4">
      <header className="max-w-3xl">
        <h2 id={headingId} className="text-title">
          Drei Szenarien im Vergleich
        </h2>
        <p className="mt-2 text-muted-foreground">
          Die Szenarien unterscheiden sich darin, wie viel die KI eigenständig
          übernimmt und an welcher Stelle der Mensch entscheidet.
        </p>
      </header>
      <ol className="grid gap-4 lg:grid-cols-3">
        {scenarios.map((scenario) => (
          <ScenarioColumn
            key={scenario.id}
            scenario={scenario}
            totalProcessSteps={steps.length}
            open={openId === scenario.id}
            onToggle={() =>
              setOpenId((current) =>
                current === scenario.id ? null : scenario.id,
              )
            }
          />
        ))}
      </ol>
      {openScenario && (
        <Card
          as="article"
          className={cn(
            "gap-0 overflow-hidden border-t-4 p-0",
            openScenario.level === "assistive" && "border-t-primary",
            openScenario.level === "delegated" && "border-t-sky-800",
            openScenario.level === "agentic" && "border-t-violet-800",
          )}
        >
          <div className="flex items-center justify-between gap-4 border-b bg-muted px-5 py-4 sm:px-6">
            <div>
              <p className="text-eyebrow uppercase text-primary">
                {copy[openScenario.level].title}
              </p>
              <h3 className="mt-1 text-heading">{openScenario.title}</h3>
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-2 text-label text-primary hover:underline"
              onClick={() => setOpenId(null)}
            >
              Details schließen <ChevronDown className="size-4 rotate-180" />
            </button>
          </div>
          <ScenarioDetail
            scenario={openScenario}
            hypothesis={hypothesis}
            stepById={stepById}
          />
        </Card>
      )}
    </section>
  );
}

function ScenarioColumn({
  scenario,
  totalProcessSteps,
  open,
  onToggle,
}: {
  scenario: OpportunityScenario;
  totalProcessSteps: number;
  open: boolean;
  onToggle: () => void;
}) {
  const label = copy[scenario.level];
  const affected = scenario.affectedProcessStepIds.length;
  const included = scenario.includedHypothesisIds.length;

  return (
    <Card
      as="li"
      className={cn(
        "gap-0 overflow-hidden p-0",
        open && "ring-2 ring-primary/25",
      )}
    >
      <header
        className={cn(
          "flex items-center gap-2 border-b px-5 py-4",
          scenario.level === "assistive" && "bg-secondary text-primary",
          scenario.level === "delegated" && "bg-sky-50 text-sky-800",
          scenario.level === "agentic" && "bg-violet-100 text-violet-900",
        )}
      >
        <span
          className={cn(
            "grid size-7 place-items-center rounded-full text-label text-white",
            scenario.level === "assistive" && "bg-primary",
            scenario.level === "delegated" && "bg-sky-800",
            scenario.level === "agentic" && "bg-violet-900",
          )}
        >
          {label.rank}
        </span>
        <span className="text-eyebrow uppercase">{label.title}</span>
        <Progress
          className="ml-auto w-20 [&_[data-slot=progress-indicator]]:bg-current"
          value={(label.rank / 3) * 100}
          aria-label={`KI-Autonomie: Stufe ${label.rank} von 3`}
        />
      </header>
      <div className="flex flex-1 flex-col lg:grid lg:grid-rows-[5.5rem_11rem_auto_auto_auto_auto_1fr_auto]">
        <div className="px-5 pt-5">
          <h3 className="line-clamp-3 text-heading leading-snug">
            {scenario.title}
          </h3>
        </div>
        <div className="px-5 pb-5 pt-4">
          <p className="line-clamp-5 text-ui text-muted-foreground">
            {scenario.summary}
          </p>
        </div>
        <ColumnMetric
          label="Konfidenz"
          value={
            { high: "hoch", medium: "mittel", low: "niedrig" }[
              scenario.confidenceLevel
            ]
          }
        />
        <ColumnMetric
          label="Betroffene Prozessschritte"
          value={`${affected} von ${totalProcessSteps}`}
          progress={
            totalProcessSteps ? (affected / totalProcessSteps) * 100 : 0
          }
          progressClass={
            scenario.level === "assistive"
              ? "bg-primary/20 [&_[data-slot=progress-indicator]]:bg-primary"
              : scenario.level === "delegated"
                ? "bg-sky-800/20 [&_[data-slot=progress-indicator]]:bg-sky-800"
                : "bg-violet-800/20 [&_[data-slot=progress-indicator]]:bg-violet-800"
          }
        />
        <ColumnMetric
          label="Enthaltene Potenziale"
          value={`${included} ${included === 1 ? "Potenzial" : "Potenziale"}`}
        />
        <ColumnMetric label="Rolle des Menschen" value={label.humanRole} />
        <div className="border-t px-5 py-4">
          <small className="text-overline uppercase text-muted-foreground">
            KI-Fähigkeiten
          </small>
          <ul className="mt-2 flex min-h-12 flex-wrap content-start gap-2">
            {scenario.aiCapabilities.map((item) => (
              <Badge as="li" key={item} tone="accent">
                {capabilities[item]}
              </Badge>
            ))}
          </ul>
        </div>
        <button
          type="button"
          className={cn(
            "mt-auto flex items-center justify-between gap-2 border-t px-5 py-4 text-left text-label hover:bg-muted",
            scenario.level === "assistive" && "text-primary",
            scenario.level === "delegated" && "text-sky-800",
            scenario.level === "agentic" && "text-violet-900",
          )}
          aria-expanded={open}
          onClick={onToggle}
        >
          {open ? "Details schließen" : "Details ansehen"}
          <ChevronDown
            className={cn("size-4 transition-transform", open && "rotate-180")}
            aria-hidden="true"
          />
        </button>
      </div>
    </Card>
  );
}

function ColumnMetric({
  label,
  value,
  progress,
  progressClass,
}: {
  label: string;
  value: string;
  progress?: number;
  progressClass?: string;
}) {
  return (
    <div className="grid gap-1 border-t px-5 py-4 text-ui">
      <span className="text-overline uppercase text-muted-foreground">
        {label}
      </span>
      {progress !== undefined && (
        <Progress
          className={progressClass}
          value={progress}
          aria-label={`${label}: ${value}`}
        />
      )}
      <strong>{value}</strong>
    </div>
  );
}

function ScenarioDetail({
  scenario,
  hypothesis,
  stepById,
}: {
  scenario: OpportunityScenario;
  hypothesis: Map<string, OpportunityHypothesis>;
  stepById: Map<string, ProcessStep>;
}) {
  const label = copy[scenario.level];
  const affectedSteps = scenario.affectedProcessStepIds
    .map((stepId) => stepById.get(stepId))
    .filter((step): step is ProcessStep => !!step)
    .sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-6 border-t bg-muted px-5 py-6 sm:px-6">
      <section className="max-w-4xl">
        <h3 className="font-semibold">Zielbild</h3>
        <p className="mt-1 text-muted-foreground">{scenario.targetState}</p>
      </section>
      {!!affectedSteps.length && (
        <section>
          <h3 className="font-semibold">Betroffene Prozessschritte</h3>
          <ol className="mt-3 flex flex-wrap gap-2">
            {affectedSteps.map((step) => (
              <li
                className="rounded-full border bg-card px-3 py-1 text-ui"
                key={step.id}
              >
                <b className="mr-1 text-primary">{step.order}</b> {step.name}
              </li>
            ))}
          </ol>
        </section>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <ScenarioList
          title="Enthaltene Potenziale"
          items={scenario.includedHypothesisIds.map(
            (id) => hypothesis.get(id)?.title ?? id,
          )}
        />
        {!!scenario.excludedHypotheses.length && (
          <section className="rounded-lg border bg-card p-4">
            <h3 className="font-semibold">Nicht enthaltene Potenziale</h3>
            <ul className="mt-2 list-disc space-y-2 pl-5 text-ui text-muted-foreground">
              {scenario.excludedHypotheses.map((item) => (
                <li key={item.hypothesisId}>
                  <b className="text-foreground">
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
      <div className="grid gap-4 lg:grid-cols-3">
        <ScenarioList
          title="Was ändert sich?"
          items={scenario.changesFromToday}
        />
        <ScenarioList
          title="Aufgaben der KI"
          items={scenario.aiResponsibilities}
        />
        <ScenarioList
          title={`Aufgaben des Menschen · ${label.humanRole}`}
          items={scenario.humanResponsibilities}
        />
      </div>
      <section>
        <h3 className="font-semibold">Aktionen und Kontrolle</h3>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          {scenario.actions.map((action, index) => (
            <article
              className="rounded-lg border bg-card p-4"
              key={`${index}-${action.name}-${action.executionMode}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <b>{action.name}</b>
                <Badge tone={executionTone[action.executionMode]}>
                  {execution[action.executionMode]}
                </Badge>
              </div>
              <p className="mt-2 text-ui text-muted-foreground">
                {action.description}
              </p>
              {!!action.controls.length && (
                <small className="mt-3 block text-muted-foreground">
                  Kontrollen: {action.controls.join(" · ")}
                </small>
              )}
              {!!action.escalationTriggers.length && (
                <small className="mt-1 block text-muted-foreground">
                  Eskalation: {action.escalationTriggers.join(" · ")}
                </small>
              )}
            </article>
          ))}
        </div>
      </section>
      <details className="rounded-lg border bg-card p-4">
        <summary className="cursor-pointer font-semibold text-primary">
          Voraussetzungen und technische Zugriffe
        </summary>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
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
            <section
              className="rounded-md bg-muted p-4"
              key={`${index}-${access.target}`}
            >
              <h4 className="font-semibold">{access.target}</h4>
              <p className="mt-1 text-ui text-muted-foreground">
                Zugriff:{" "}
                {access.accessModes.map((item) => accessModes[item]).join(", ")}{" "}
                · {accessTimings[access.timing]} ·{" "}
                {access.possibleMechanisms
                  .map((item) => mechanisms[item])
                  .join(" oder ")}
              </p>
              {!!access.assumptions.length && (
                <p className="mt-2 text-ui text-muted-foreground">
                  Annahme: {access.assumptions.join(" · ")}
                </p>
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
      <footer className="border-t pt-4">
        <b>
          Konfidenz:{" "}
          {
            { high: "hoch", medium: "mittel", low: "niedrig" }[
              scenario.confidenceLevel
            ]
          }
        </b>
        <p className="mt-1 text-ui text-muted-foreground">
          <span className="font-semibold text-foreground">Herleitung: </span>
          {scenario.confidenceRationale}
        </p>
      </footer>
    </div>
  );
}

function ScenarioList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <section className="rounded-lg border bg-card p-4">
      <h3 className="font-semibold">{title}</h3>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-ui text-muted-foreground">
        {items.map((item, index) => (
          <li key={`${index}-${item}`}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
