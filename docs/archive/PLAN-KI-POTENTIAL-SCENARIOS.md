# Implementierungsplan — KI-Potenzialhypothesen und Szenarien

## Status, Ziel und Produktgrenze

Status: implementiert und verifiziert auf Basis von
[`DISCOVERY-KI-POTENTIAL-SCENARIOS.md`](./DISCOVERY-KI-POTENTIAL-SCENARIOS.md).
Er ist die verbindliche Spezifikation des getrennten Opportunity-Discovery-Moduls.

Ziel ist ein neues, getrenntes Opportunity-Discovery-Modul hinter der
bestehenden Prozessaufnahme. Ein KI-Verantwortlicher startet die Analyse für
einen fachlich bestätigten Prozess einmalig aus der Prozessübersicht. Die
Anwendung führt danach genau zwei begrenzte Claude-Aufrufe aus:

1. Potenzialhypothesen für jeden bestätigten Prozessschritt entdecken;
2. aus allen hohen oder ersatzweise zwei bis drei priorisierten mittleren
   Hypothesen ein assistiertes, teilautonomes und agentisches Szenario erstellen.

Das Modul endet mit read-only Hypothesen und Szenarien. Wirtschaftliche Werte,
Machbarkeit, Nutzen, Risiko, Scoring, Priorisierung, Ranking, Szenarioauswahl
und Umsetzung bleiben vollständig außerhalb dieses Schritts.

Die bestehende Prozessaufnahme, ihre fünf Themenblöcke, Arbeitsmerkmale,
Rückfragen, Synthese, Korrektur und Bestätigung bleiben fachlich unverändert.

## Verbindlicher End-to-End-Flow

1. Die Prozessübersicht lädt Prozessaufnahmen und vorhandene
   Potenzialanalyse-Summaries getrennt.
2. Nur ein Prozess im Zustand `confirmed` ohne vorhandene Analyse zeigt die
   Aktion `KI-Potenziale entdecken`.
3. Der Klick erstellt atomar einen Opportunity-Datensatz mit unveränderlichem
   Prozess-, Konfigurations-, Prompt- und Schema-Snapshot und reiht genau einen
   Job in die bestehende globale KI-Warteschlange ein.
4. Phase 1 bewertet jeden der fünf bis acht Prozessschritte und erzeugt null bis
   mehrere Hypothesen pro Schritt. Die vollständig validierte Antwort wird
   atomar gespeichert und sofort in der UI verfügbar.
5. Alle hohen Hypothesen werden als Eingabe für Phase 2 verwendet. Ohne hohe
   Hypothese werden bei mindestens zwei mittleren Hypothesen die besten zwei bis
   drei nach Potenzial und Prozessreihenfolge ausgewählt.
6. Ohne mindestens eine hohe oder zwei mittlere Hypothesen endet die Pipeline
   erfolgreich nach Phase 1. Es werden keine Szenarien erfunden.
7. Mit ausreichender Evidenzbasis beginnt Phase 2 automatisch innerhalb
   desselben Warteschlangenjobs und in einer neuen Claude-Session.
8. Phase 2 erzeugt exakt die drei Levels `assistive`, `delegated` und
   `agentic`. Nach vollständiger Validierung werden alle drei gemeinsam
   atomar gespeichert und angezeigt.
9. Sobald Phase 2 begonnen hat, kann der Benutzer in der Detailseite frei
   zwischen Hypothesen und Szenarien wechseln.
10. Ein abgeschlossenes Ergebnis kann angesehen, aber nicht bearbeitet,
    ergänzt, bestätigt oder neu berechnet werden.

Ein technischer Retry ist ausschließlich nach einer fehlgeschlagenen oder
abgebrochenen Phase zulässig. Er wiederholt bei einem Phase-1-Fehler die
zweiphasige Pipeline und bei einem Phase-2-Fehler nur Phase 2 mit den bereits
persistierten Hypothesen. Ein Retry ist keine fachliche Neuberechnung eines
erfolgreichen Ergebnisses.

## Modul- und Abhängigkeitsgrenze

Das neue Modul folgt den bestehenden Schichten, erhält darin aber eigene
Dateien, Verträge und Tests:

```text
process-understanding (bestätigter Input)
              ↓
opportunity-discovery domain
              ↓
opportunity-discovery storage
              ↓
opportunity Claude adapters
              ↓
opportunities API
              ↓
opportunity discovery UI
```

Die Opportunity-Domain darf weder React noch den Claude-Adapter importieren.
Storage und Claude-Adapter validieren ihre Inputs unabhängig. Die bestehende
`ProcessCaptureState` wird nicht erweitert; der bestätigte Prozess bleibt
`confirmed`.

Der Opportunity-Datensatz wird als abhängiges, aber eigenständiges Untermodul
unterhalb des Prozessverzeichnisses gespeichert. Dadurch werden Prozess und
Opportunity-Daten beim bestehenden permanenten Löschen und beim Workspace-Reset
gemeinsam bewegt beziehungsweise entfernt, ohne eine verteilte Löschoperation
über zwei Wurzeln einzuführen.

## Defaults und Konfigurationsvertrag

`defaults/opportunity-discovery-config.json` wird mit folgendem festen Profil
eingeführt:

```ts
interface OpportunityDiscoveryConfig {
  schemaVersion: 1;
  profile: { id: "opportunity-discovery-v1"; version: 1 };
  instructions: {
    hypotheses: string;
    scenarios: string;
  };
  ai: {
    model: "claude-opus-4-8";
    reasoningEffort: "high";
    timeoutMs: number;
    maxOutputTokens: number;
    maxInputCharacters: number;
    maxBudgetUsd: number;
  };
}
```

Die Grenzwerte entsprechen zunächst dem aktiven Prozessprofil:

- `timeoutMs`: `180000` je Phase;
- `maxOutputTokens`: `12000` je Phase;
- `maxInputCharacters`: `200000`;
- `maxBudgetUsd`: `1` je Phase.

Die beiden `instructions` sind kurze modulspezifische Ergänzungen. Globale
Rolle, fachliche Regeln und Ausgabegrenzen liegen weiterhin in versionierten
Promptdateien. Für diesen Ausbau gibt es keine localStorage-Overrides, keinen
Editor und keine Promptvorschau in der normalen UI.

Beim manuellen Start werden Konfiguration, alle drei Prompts und beide
JSON-Schemas unverändert in den Opportunity-Ordner kopiert und gehasht. Beide
Phasen verwenden ausschließlich diesen Snapshot; ein Deployment zwischen den
Phasen darf den laufenden Vertrag nicht verändern.

## Unveränderlicher Prozess-Input

`createOpportunityProcessSnapshot(record)` akzeptiert ausschließlich einen
`ProcessCaptureRecord` mit `state: confirmed`, nicht-leerem
`confirmedAt` und gültigem `understanding`.

Der Snapshot enthält:

- `schemaVersion: 1`;
- Prozess-ID, Prozessname und Fachbereich;
- Bestätigungszeitpunkt;
- die vier Arbeitsmerkmale mit Frage, gewählten IDs und sichtbaren Labels;
- das vollständige bestätigte `ProcessUnderstanding` einschließlich Evidenz,
  Wissenslücken und Konflikten.

Name und E-Mail-Adresse der einreichenden Person, ursprüngliche Freitextantworten,
Follow-up-Antworten, Uploadpfade und nicht ausgewählte Dateien werden nicht in
den Opportunity-Snapshot und nicht an Claude übergeben. Dateiinhalte werden
nicht erneut geöffnet; bereits bestätigte Evidenzausschnitte im Prozessbild
reichen als Input.

Der Storage-Layer berechnet einen kanonischen SHA-256-Hash über den Snapshot.
Dieser `sourceProcessHash` ist die unveränderliche Referenz für beide Phasen.

## Domainvertrag

`packages/domain/src/opportunity-discovery.ts` besitzt alle neuen Zod-Schemas,
Typen, Sortierregeln, Zustandsübergänge und referenziellen Prüfungen.

### Zustände

```ts
type OpportunityDiscoveryState =
  | "hypotheses_queued"
  | "hypotheses_running"
  | "hypotheses_failed"
  | "no_supported_hypotheses"
  | "scenarios_running"
  | "scenarios_failed"
  | "completed";
```

Erlaubte Übergänge:

```text
hypotheses_queued → hypotheses_running
hypotheses_running → no_supported_hypotheses
hypotheses_running → scenarios_running
hypotheses_running → hypotheses_failed
hypotheses_failed → hypotheses_queued
scenarios_running → completed
scenarios_running → scenarios_failed
scenarios_failed → scenarios_running
```

Andere Übergänge werden im Domain-Layer abgelehnt. Abbruch und beim Serverstart
erkannte unterbrochene Zustände werden als Fehler der jeweils aktiven Phase mit
einem öffentlichen Fehlergrund gespeichert. `stale` ist kein persistierter
Zustand, sondern wird beim Lesen aus Prozessstatus und Snapshot-Hash berechnet.

### Potenzialhypothesen

```ts
type PotentialLevel = "high" | "medium" | "low";
type ConfidenceLevel = "high" | "medium" | "low";
type AiCapability =
  | "interpretation"
  | "generation"
  | "recognition"
  | "prediction"
  | "recommendation"
  | "planning";

interface OpportunityAssumption {
  text: string;
  material: boolean;
}

interface OpportunityHypothesis {
  id: `HYP-${string}`;
  provenance: "ai_inferred";
  processStepId: string;
  title: string;
  currentSituation: string;
  aiContribution: string;
  aiCapabilities: AiCapability[];
  expectedChange: string;
  supportingDeterministicAutomation: string[];
  requiredInformationAndSystemAccess: string[];
  expectedHumanRole: string;
  potentialLevel: PotentialLevel;
  potentialRationale: string;
  confidenceLevel: ConfidenceLevel;
  confidenceRationale: string;
  evidenceIds: string[];
  assumptions: OpportunityAssumption[];
  openQuestions: string[];
}

interface StepOpportunityAnalysis {
  processStepId: string;
  summary: string;
  noPotentialRationale: string | null;
  hypotheses: OpportunityHypothesis[];
}
```

Der AI-Output enthält noch keine IDs. Nach erfolgreicher Antwortvalidierung
normalisiert die Domain alle Schrittanalysen und vergibt IDs `HYP-001`,
`HYP-002` fortlaufend in kanonischer Sortierung.

Verbindliche Hypothesenregeln:

- jeder Snapshot-Prozessschritt kommt exakt einmal in `stepAnalyses` vor;
- unbekannte, doppelte oder fehlende Prozessschritt-IDs werden abgelehnt;
- ein Schritt mit null Hypothesen benötigt `noPotentialRationale`;
- ein Schritt mit Hypothesen verwendet `noPotentialRationale: null`;
- jede Hypothese besitzt mindestens eine `aiCapability`; rein deterministische
  Ideen ohne KI-spezifischen Beitrag sind dadurch unzulässig;
- unterstützende deterministische Automation, Orchestrierung und Integration
  sind zulässige Bestandteile und reduzieren Potenzial oder Konfidenz nicht;
- jede Evidenz-ID muss im Prozesssnapshot existieren;
- `confidenceLevel: high` benötigt mindestens eine Evidenz-ID und darf keine
  Annahme mit `material: true` enthalten;
- eine direkt belegte feste Regel darf nicht als Beleg für einen davon
  getrennten, unbestätigten kontextabhängigen KI-Beitrag verwendet werden;
- Potenzial und Konfidenz bleiben qualitative, voneinander unabhängige Werte;
- es gibt keine numerische Bewertung.

Kanonische Sortierung:

1. Prozessschrittreihenfolge aufsteigend;
2. Potenzial `high`, `medium`, `low`;
3. Konfidenz `high`, `medium`, `low`;
4. normalisierter Titel;
5. anschließend serverseitig vergebene Hypothesen-ID.

### Szenarien

```ts
type ScenarioLevel = "assistive" | "delegated" | "agentic";
type ExecutionMode = "autonomous" | "approval_required" | "human_only";
type SystemAccessMode = "read" | "write" | "observe" | "act";
type AccessTiming = "manual" | "on_demand" | "event_driven";
type AccessMechanism =
  | "manual"
  | "file_exchange"
  | "api"
  | "connector"
  | "mcp"
  | "ui_automation"
  | "unknown";

interface ScenarioAction {
  name: string;
  description: string;
  processStepIds: string[];
  executionMode: ExecutionMode;
  controls: string[];
  escalationTriggers: string[];
}

interface ScenarioSystemAccess {
  target: string;
  accessModes: SystemAccessMode[];
  timing: AccessTiming;
  possibleMechanisms: AccessMechanism[];
  assumptions: string[];
}

interface OpportunityScenario {
  id: `SCN-${ScenarioLevel}`;
  provenance: "ai_inferred";
  level: ScenarioLevel;
  title: string;
  summary: string;
  targetState: string;
  includedHypothesisIds: string[];
  excludedHypotheses: Array<{ hypothesisId: string; rationale: string }>;
  affectedProcessStepIds: string[];
  changesFromToday: string[];
  aiResponsibilities: string[];
  aiCapabilities: AiCapability[];
  deterministicAutomation: string[];
  orchestration: string[];
  humanResponsibilities: string[];
  actions: ScenarioAction[];
  humanOversight: string[];
  informationAndDocuments: string[];
  systemAccess: ScenarioSystemAccess[];
  prerequisites: string[];
  risksAndFailureModes: string[];
  assumptions: string[];
  openQuestions: string[];
  evidenceIds: string[];
  confidenceLevel: ConfidenceLevel;
  confidenceRationale: string;
}
```

Verbindliche Szenarioregeln:

- die Antwort enthält exakt ein Szenario je Level in der Reihenfolge
  `assistive`, `delegated`, `agentic`;
- IDs werden serverseitig aus dem Level vergeben;
- jedes Szenario enthält mindestens eine ausgewählte Hypothese;
- nur deterministisch ausgewählte Hypothesen derselben Analyse dürfen referenziert werden;
- je Szenario bilden `includedHypothesisIds` und `excludedHypotheses` eine
  disjunkte, vollständige Partition aller ausgewählten Hypothesen;
- alle Prozessschritt- und Evidenzreferenzen müssen im Snapshot existieren;
- `assistive` enthält keine Aktion mit `executionMode: autonomous`;
- `delegated` enthält mindestens eine autonome Routineaktion und mindestens
  eine Aktion mit menschlicher Freigabe oder ausschließlicher menschlicher
  Verantwortung;
- `agentic` enthält mindestens eine autonome Aktion sowie mindestens eine
  kritische `approval_required`- oder `human_only`-Aktion und sichtbare
  menschliche Überwachung;
- `mcp` ist nur ein möglicher Zugriffsmechanismus und keine Aussage über einen
  vorhandenen Connector oder bestätigte Machbarkeit;
- das agentische Szenario darf zukünftige Voraussetzungen annehmen, muss sie
  aber sichtbar unter `assumptions` oder `prerequisites` führen;
- Geldbeträge, ROI, Einsparungen, Implementierungsdauer, Scores und
  Machbarkeitszusagen sind nicht Teil des Schemas.

### Record und API-View

Der persistierte Record enthält:

- `schemaVersion: 1`;
- abgeleitete ID `OPP-${processId}` und `processId`;
- Zustand;
- `sourceProcessHash` und `configHash`;
- Konfigurations- und AI-Contract-Manifest;
- `hypotheses: OpportunityHypothesisResult | null`;
- `scenarios: OpportunityScenarioResult | null`;
- letzter öffentlicher Phasenfehler oder `null`;
- `createdAt` und `updatedAt`.

Die API ergänzt berechnet `isStale`. Sie gibt keine Prompttexte,
JSON-Schemas, Dateipfade, Terminaldetails, Stacktraces oder internen
Claude-Fehlermeldungen an den Browser aus.

## Speicherung und Audit

`OpportunityDiscoveryRepository` verwendet pro Prozess:

```text
workspace/process-captures/PROC-0001/opportunity-discovery/
├── metadata.yaml
├── source-process.json
├── config-snapshot.json
├── contract-manifest.json
├── contracts/
│   ├── opportunity-base.md
│   ├── opportunity-hypotheses.md
│   ├── opportunity-scenarios.md
│   ├── opportunity-hypotheses.schema.json
│   └── opportunity-scenarios.schema.json
├── hypotheses.json
├── scenarios.json
├── operations.jsonl
└── history.jsonl
```

`hypotheses.json` und `scenarios.json` werden bei Erstellung mit `null`
initialisiert. Jede Datei wird bei jedem Lesen gegen ihr Laufzeitschema geprüft.
Contract-Dateien werden zusätzlich gegen das Manifest gehasht, bevor sie an den
Adapter gelangen.

Öffentliche Repository-Operationen:

- `create(process, config, contracts)`;
- `get(processId, currentProcess)` und `required(...)`;
- `listSummaries(processes)`;
- `markHypothesesRunning(processId)`;
- `saveHypotheses(processId, result, trace)`;
- `markScenariosRunning(processId)`;
- `saveScenarios(processId, result, trace)`;
- `markPhaseFailed(processId, phase, reason, cancelled)`;
- `prepareTechnicalRetry(processId)`;
- `recoverInterrupted()`;
- `history(processId)`.

Jede Zustandsänderung aktualisiert zuerst die jeweilige kanonische JSON-Datei,
dann Metadaten und anschließend den append-only Auditverlauf. Ein ungültiger
Output verändert weder vorherige kanonische Ergebnisse noch den Zustand.
Erfolgreiche AI-Traces werden zusätzlich in `operations.jsonl` gespeichert.

Audit-Events:

- `opportunity-discovery-created`;
- `hypotheses-started`;
- `hypotheses-completed`;
- `hypotheses-failed`;
- `scenarios-started`;
- `scenarios-completed`;
- `scenarios-failed`;
- `technical-retry-started`.

`recoverInterrupted()` läuft vor dem Mounten der API. Persistierte
`hypotheses_queued`, `hypotheses_running` und `scenarios_running` werden nach
einem Serverabbruch in den passenden Fehlerzustand überführt. Es wird keine
Claude-Session fortgesetzt und kein Job automatisch neu gestartet.

Wird der Quellprozess nach der Analyse korrigiert oder ist er nicht mehr
`confirmed`, liefert die API `isStale: true`. Das Ergebnis bleibt als Snapshot
lesbar; es gibt in diesem Ausbau keinen Recalc-Button.

Das bestehende `DELETE /api/processes/:id` entfernt durch das verschachtelte
Verzeichnis automatisch auch den vollständigen Opportunity-Datensatz. Während
des zweiphasigen Jobs verhindert der bestehende processweite Operation-Lock die
Löschung.

## Claude-Vertrag

Es werden eigene versionierte Dateien eingeführt:

- `defaults/prompts/opportunity-base.md`;
- `defaults/prompts/opportunity-hypotheses.md`;
- `defaults/prompts/opportunity-scenarios.md`;
- `defaults/ai-schemas/opportunity-hypotheses.json`;
- `defaults/ai-schemas/opportunity-scenarios.json`.

Der globale Prompt definiert Rolle, deutsche kompakte Sprache, Evidenztreue,
Advisory-Status und die Grenze zur späteren Bewertung.

Der Hypothesenprompt erzwingt:

- genau eine Analyse pro Prozessschritt, aber keine erfundene Mindestanzahl von
  Hypothesen;
- getrennte Begründung von Potenzial und Konfidenz;
- hohe Konfidenz nur mit direkter Evidenz und ohne materielle Annahme;
- einen materiellen KI-Beitrag statt einer rein deterministischen Idee;
- getrennte Ausweisung unterstützender Automation, Orchestrierung,
  Systemzugriffe und menschlicher Rolle;
- keine Architektur- oder Machbarkeitsentscheidung.

Der Szenarioprompt erzwingt:

- ausschließliche Verwendung der übergebenen ausgewählten Hypothesen;
- Assistiert, Teilautonom und Agentisch als drei Human-Oversight-Level;
- explizite Aktionsmodi, Eskalationen und menschliche Kontrollen;
- Trennung von Integrationsbedarf und Zugriffsmechanismus;
- MCP, API, Connector und UI-Automation nur als mögliche Mechanismen;
- Agentisch als strategische, kontrollierte Vision statt als kurzfristige
  Machbarkeitszusage;
- keine Geld-, Score-, Zeit- oder Bewertungswerte.

`ClaudeOpportunityAiAdapter` besitzt exakt zwei Methoden:

```ts
discoverHypotheses(request): Promise<AiResult<HypothesisAiOutput>>;
createScenarios(request): Promise<AiResult<ScenarioAiOutput>>;
```

Beide verwenden `SandboxRunner.runStructured`, Claude Opus 4.8,
Reasoning-Aufwand `high`, eine neue logische Session und `tools: none`. Es werden keine Uploads
gestaged, keine Workspace-Tools freigegeben, kein Webzugriff erlaubt und keine
Session fortgesetzt. MCP erscheint ausschließlich im beschriebenen
Zukunftsszenario und wird dem ausführenden Claude-Prozess nicht als Tool
bereitgestellt.

Phase 2 erhält den gleichen unveränderten Prozesssnapshot und ausschließlich
die deterministisch ausgewählten hohen oder mittleren Hypothesen. Nicht
ausgewählte Hypothesen, fremde Prozesse und Repository-Dateien werden nicht gesendet.

## API und Operationsmanager

Neue authentifizierte Routen unter `/api/opportunities`:

### `GET /api/opportunities`

Liefert eine kompakte Summary je vorhandener Analyse:

```ts
interface OpportunityDiscoverySummary {
  processId: string;
  state: OpportunityDiscoveryState;
  isStale: boolean;
  hypothesisCount: number;
  highConfidenceHypothesisCount: number;
  scenarioCount: 0 | 3;
  updatedAt: string;
}
```

### `GET /api/opportunities/:processId`

Liefert den bereinigten Opportunity-Record sowie `isStale`. Vor dem manuellen
Start lautet die Antwort `404`.

### `POST /api/opportunities/:processId`

Erfordert einen bestätigten Prozess, einen noch nicht vorhandenen
Opportunity-Datensatz und keinen aktiven Job für dieselbe Prozess-ID. Die Route
erstellt Snapshots und Record, reiht `opportunity-discovery` ein und antwortet
mit `202`, `operationId` und dem initialen Record. Ein wiederholter fachlicher
Start liefert `409`.

Der Job führt Phase 1 und bei vorhandener hoher Konfidenz deterministisch Phase
2 aus. Es gibt keine modellgesteuerte Schleife und keine dritte Operation.

### `POST /api/opportunities/:processId/retry`

Ist ausschließlich in `hypotheses_failed` oder `scenarios_failed` zulässig und
antwortet mit `202`. Abgeschlossene, veraltete oder fachlich ergebnislose
Analysen liefern `409`.

### `GET /api/opportunities/:processId/history`

Liefert den authentifizierten Auditverlauf für technische Nachvollziehbarkeit.
Die normale UI zeigt ihn in diesem Ausbau nicht an.

Der bestehende `ProcessOperationName` erhält `opportunity-discovery`. Die
globale Parallelität bleibt eins und der processweite Lock verhindert
gleichzeitige Capture- und Opportunity-Aktionen. Der Queue-Hinweis verwendet
die deutsche Bezeichnung `KI-Potenziale entdecken`.

## Frontend-Verhalten

### Prozessübersicht

`ProcessListPage` lädt Prozesse und Opportunity-Summaries mit einem gemeinsamen
`Promise.all` und führt beide Ergebnisse clientseitig über `processId`
zusammen. Es gibt keinen N+1-Request pro Prozesszeile.

Eine bestätigte Prozesszeile zeigt abhängig von der Summary:

- ohne Analyse: Button `KI-Potenziale entdecken`;
- laufend: Status `Potenziale werden untersucht` und Link zur Detailseite;
- ohne ausreichende hohe oder gebündelte mittlere Evidenzbasis: Status `Analyse abgeschlossen`;
- abgeschlossen: Status `3 Szenarien verfügbar`;
- technisch fehlgeschlagen: Status `Analyse prüfen`;
- veraltet: sichtbare Kennzeichnung `Prozess später geändert`.

Der Einstieg aus der Prozessdetailseite öffnet bei mindestens einem bereits
gespeicherten Szenario direkt den Schritt `KI-Szenarien`. Solange noch kein
Szenario verfügbar ist, öffnet er `Potenzialhypothesen`. Beide Schritte bleiben
anschließend über den Stepper erreichbar.

Nicht bestätigte Prozesse zeigen keine Startaktion. Der bestehende Link zum
Prozessbild und die permanente Löschfunktion bleiben zugänglich. Der Startbutton
ist eine eigene Schaltfläche und wird nicht in einen anderen Link verschachtelt.

Nach erfolgreichem `POST` navigiert die UI zu
`/processes/:id/opportunities`.

### Opportunity-Detailseite

Die Route `/processes/:id/opportunities` lädt Prozess und Opportunity-Record.
Ein an der Anwendungssitzung authentifizierter EventSource auf `/api/events`
liefert beim Verbinden den aktuellen Stand der Warteschlange und meldet danach
`operations`- sowie `process-changed`-Ereignisse. Bei einer Meldung für den
geöffneten Prozess lädt die Seite den kanonischen Detaildatensatz neu. Der
Browser stellt unterbrochene Verbindungen automatisch wieder her; es gibt kein
periodisches Polling und ein Ereignis startet keine neue KI-Aktion.

Server und Browser verwenden denselben strikt validierten Ereignisvertrag.
Unbekannte Ereignistypen, zusätzliche Felder, ungültige IDs und unvollständige
Operationsdaten werden verworfen. Ein Heartbeat hält ruhige Verbindungen offen,
enthält aber keine Fachdaten.

Die Seite zeigt permanent:

- Prozessname und Fachbereich;
- aktuellen Phasenstatus und nächste erwartete Aktion;
- Zwei-Schritt-Stepper `Potenzialhypothesen` und `KI-Szenarien`;
- einen Stale-Hinweis, wenn das Prozessbild nach dem Start geändert wurde;
- kompakte Fehleranzeige und `Erneut versuchen` nur nach technischem Fehler.

Vor Abschluss von Phase 1 ist nur der Hypothesenschritt aktivierbar. Sobald
Hypothesen persistiert sind, bleibt Schritt 1 auswählbar. Mit Beginn von Phase 2
ist auch Schritt 2 auswählbar und zeigt seinen Laufstatus. Ein Browser-Refresh
stellt denselben Zustand aus den Dateien wieder her.

### Hypothesenansicht

- Gruppen folgen der Prozessschrittreihenfolge;
- jede Gruppe zeigt Prozessschrittnummer, Namen und kurze Einordnung;
- innerhalb der Gruppe gelten die Domain-Sortierregeln;
- Karten zeigen Titel, KI-Beitrag, erwartete Veränderung, Potenzial,
  Konfidenz und beide Begründungen;
- unterstützende Automation, benötigter Systemzugriff, menschliche Rolle,
  Evidenz, Annahmen und offene Punkte sind kompakt aufklappbar;
- mittlere und niedrige Konfidenz bleiben sichtbar und erhalten den Hinweis,
  dass sie nicht für Szenarien verwendet wurden;
- Schritte ohne Hypothese zeigen die fachliche Begründung statt einer leeren
  Kartenfläche.

Bei `no_supported_hypotheses` erklärt eine neutrale Abschlussmeldung, dass auf
Basis der aktuellen Beschreibung keine ausreichend belegten Szenarien erzeugt
wurden. Sie behauptet nicht, der Prozess habe grundsätzlich kein KI-Potenzial.

### Szenarioansicht

Die drei Szenarien erscheinen in der festen Reihenfolge:

1. `Assistiert — Mensch führt aus`;
2. `Teilautonom — Mensch bestätigt wichtige Schritte`;
3. `Agentisch — Mensch überwacht und übernimmt kritische Fälle`.

Jedes Szenario zeigt:

- Titel, Zusammenfassung und Zielbild;
- enthaltene und ausgeschlossene Hypothesen;
- Änderungen gegenüber heute;
- KI- und Menschenverantwortung;
- deterministische Automation und Orchestrierung;
- Aktionsmodi, Freigaben, Kontrollen und Eskalationen;
- benötigte Systemzugriffe sowie verständlich bezeichnete mögliche
  Zugriffswege;
- Voraussetzungen, Risiken, Annahmen und offene Punkte;
- Konfidenz mit Begründung.

`MCP` wird in der fachlichen Oberfläche nur als erläuterter
`freigegebener Werkzeugzugriff (MCP)` angezeigt. Rohes JSON, Prompts,
Modellantworten, CLI-Begriffe und Stacktraces bleiben verborgen.

Bei mehr als `860px` verfügbarem Raum zeigt die Übersicht die drei Szenarien als
ausgerichtete Vergleichsspalten. Jede Spalte enthält Titel, kompakten Pitch und
dieselben Kennzahlenzeilen für Konfidenz, betroffene Prozessschritte,
enthaltene Potenziale, Rolle des Menschen und KI-Fähigkeiten. Genau ein
Szenario kann ausgewählt sein; seine vollständigen Inhalte erscheinen in einer
gemeinsamen, über alle drei Spalten reichenden Detailfläche unter dem
Vergleich. Bis einschließlich `860px` werden die Szenarien untereinander
angeordnet. Alle Stepper, Detailaktionen und Retry-Aktionen sind per Tastatur
bedienbar und besitzen sichtbare Fokuszustände. Die frühere Darstellung als
drei eigenständige horizontale Detailzeilen wird nicht fortgeführt.

Es gibt keine Edit-, Add-, Delete-, Confirm-, Select- oder Recalculate-Aktion
für Hypothesen oder Szenarien.

## Fehler-, Stale- und Löschverhalten

- Ungültige AI-Antwort: aktive Phase wird technisch fehlgeschlagen; kein
  Teiloutput wird gespeichert.
- Timeout oder Sandboxfehler: gleicher phasenspezifischer Fehlerzustand mit
  neutraler deutscher Meldung.
- Benutzerabbruch: aktiver Claude-Prozess wird beendet, der Record wird als
  abgebrochene technische Phase retry-fähig gespeichert.
- Fehler in Phase 2: Hypothesen bleiben vollständig lesbar; `scenarios.json`
  bleibt `null`.
- Serverneustart: unterbrochene Zustände werden beim Start fehlgeschlagen
  markiert; kein automatisches Resume.
- Prozesskorrektur: bestehendes Ergebnis wird read-only als veraltet markiert;
  kein Recalc.
- Prozesslöschung: der vollständige Prozessordner einschließlich Opportunity-
  und Auditdaten wird dauerhaft entfernt.
- Start mit unbestätigtem, fehlendem oder bereits analysiertem Prozess: `409`
  beziehungsweise `404`, ohne Dateien anzulegen.

## Dokumentations- und Boundary-Update

Vor dem ersten Code-Gate werden die Repository-Grenzen an die explizite
Produktentscheidung angepasst:

- `AGENTS.md` erlaubt das getrennte Opportunity-Modul, verbietet aber weiterhin
  Bewertung, Scoring, Priorisierung und allgemeines Projektmanagement;
- die Regel „eine Benutzeraktion, eine KI-Operation“ erhält genau eine eng
  definierte Ausnahme für diese zweiphasige Pipeline;
- `docs/PRODUCT-FLOW-KI-POTENTIAL.md` beschreibt Prozessaufnahme plus
  nachgelagerte Opportunity-Discovery als zwei getrennte Module;
- `docs/PLAN.md` verweist auf diesen Plan als nächsten aktiven Ausbau;
- `README.md` und `docs/OPERATOR_GUIDE.de.md` dokumentieren Start,
  Laufzeitverhalten, read-only Ergebnisse, Retries und Ausschlüsse;
- das Discovery-Dokument bleibt als Entscheidungsherkunft erhalten.

## Cleanup-Entscheidung

Es existiert im aktuellen Commit kein halbfertiges Hypothesen- oder
Szenariomodul, das vor der Implementierung entfernt werden muss. Der alte
Gateway-, Kriterien-, Scoring- und Ranking-Code bleibt aus dem aktiven Branch
entfernt und wird nicht wieder eingeführt.

Cleanup in diesem Schritt beschränkt sich auf:

- keine duplizierten allgemeinen Claude-Runtime-Typen;
- keine Opportunity-Logik in React oder im Process-Capture-Repository;
- keine veralteten Dokumentaussagen, die KI-Use-Case-Erzeugung generell als
  außerhalb des nun erweiterten Produkts beschreiben;
- keine ungenutzten Styles, Imports oder Testfixtures nach Abschluss.

Bestehende Workspace-Prozessdaten werden nicht migriert oder neu geschrieben.
Opportunity-Unterordner entstehen ausschließlich nach einem manuellen Start.

## Files To Change

### Neue Domain-, Storage- und AI-Dateien

- `packages/domain/src/opportunity-discovery.ts`
- `packages/storage/src/opportunity-discovery-repository.ts`
- `packages/claude/src/ai-runtime-contracts.ts`
- `packages/claude/src/opportunity-ai-contracts.ts`
- `packages/claude/src/opportunity-response-schemas.ts`
- `packages/claude/src/opportunity-ai-utils.ts`
- `packages/claude/src/opportunity-hypothesis-adapter.ts`
- `packages/claude/src/opportunity-scenario-adapter.ts`
- `packages/claude/src/opportunity-ai-adapter.ts`

### Neue Defaults

- `defaults/opportunity-discovery-config.json`
- `defaults/prompts/opportunity-base.md`
- `defaults/prompts/opportunity-hypotheses.md`
- `defaults/prompts/opportunity-scenarios.md`
- `defaults/ai-schemas/opportunity-hypotheses.json`
- `defaults/ai-schemas/opportunity-scenarios.json`

### Neue Server- und Webdateien

- `apps/server/src/opportunity-defaults.ts`
- `apps/server/src/routes/opportunities.ts`
- `apps/web/src/lib/opportunity-types.ts`
- `apps/web/src/pages/opportunity-discovery-page.tsx`
- `apps/web/src/components/opportunity-progress.tsx`
- `apps/web/src/components/opportunity-hypotheses-view.tsx`
- `apps/web/src/components/opportunity-scenarios-view.tsx`

### Zu ändernde Laufzeit- und Webdateien

- `packages/claude/src/process-ai-contracts.ts`
- `packages/claude/src/sandbox-runner.ts`
- `packages/storage/src/workspace-repository.ts`
- `apps/server/src/process-operation-manager.ts`
- `apps/server/src/index.ts`
- `apps/web/src/app.tsx`
- `apps/web/src/pages/process-list-page.tsx`
- `apps/web/src/components/ai-operation-queue.tsx`
- `apps/web/src/lib/api-client.ts`
- `apps/web/src/styles.css`

### Neue und zu ändernde Tests

- `tests/opportunity-fixtures.ts`
- `tests/opportunity-domain.test.ts`
- `tests/opportunity-storage.test.ts`
- `tests/opportunity-ai-contract.test.ts`
- `tests/opportunity-api.test.ts`
- `tests/process-operation-manager.test.ts`

### Dokumentation

- `AGENTS.md`
- `README.md`
- `docs/PLAN.md`
- `docs/PRODUCT-FLOW-KI-POTENTIAL.md`
- `docs/OPERATOR_GUIDE.de.md`

## Implementierungsreihenfolge und harte Gates

### 1. Produktgrenze und Domainvertrag

Aktualisiere die aktiven Produktgrenzen, implementiere Konfiguration,
Prozesssnapshot, Hypothesen- und Szenarioschemas, Normalisierung,
Referenzprüfung und Zustandsübergänge.

Erwartete Outputs:

- bestätigte Prozessrecords erzeugen einen Snapshot ohne Name und E-Mail;
- unbestätigte und unvollständige Prozesse werden abgelehnt;
- jeder Prozessschritt wird exakt einmal analysiert;
- Hypothesen-IDs und Sortierung sind deterministisch;
- hohe Konfidenz ohne Evidenz oder mit materieller Annahme wird abgelehnt;
- Scenario-Levels, Hypothesenpartition und Ausführungsmodi sind vollständig
  validiert;
- Assistiert enthält keine autonome Aktion;
- Teilautonom und Agentisch enthalten autonome sowie menschlich kontrollierte
  Aktionen;
- numerische Bewertungsfelder existieren nicht.

Hard Gate:

```zsh
./scripts/qa test tests/opportunity-domain.test.ts
./scripts/qa changed
```

### 2. Atomare Speicherung und Recovery

Implementiere den verschachtelten Opportunity-Ordner, Snapshot- und
Contract-Hashprüfung, phasenspezifische Writes, Audit, Stale-Berechnung,
technischen Retry und Startup-Recovery.

Erwartete Outputs:

- Create/read/restart liefert denselben validierten Record;
- ungültige oder manipulierte Dateien werden abgelehnt und nicht repariert;
- Phase-1-Output wird vor Beginn von Phase 2 dauerhaft sichtbar;
- Phase-2-Fehler verändert Hypothesen nicht;
- ein Serverneustart setzt laufende Zustände auf retry-fähig fehlgeschlagen;
- Prozesskorrektur ergibt `isStale: true` ohne Ergebnisänderung;
- Prozesslöschung und Workspace-Reset erfassen den Opportunity-Unterordner;
- bestehende Prozessordner ohne Opportunity-Daten bleiben bytegleich.

Hard Gate:

```zsh
./scripts/qa test tests/opportunity-storage.test.ts tests/process-storage.test.ts
```

### 3. Zwei getrennte Claude-Verträge

Implementiere Prompt-/Schema-Snapshots, beide Adapter und die Normalisierung
zwischen AI-Output und kanonischer Domain.

Erwartete Outputs:

- beide Calls verwenden Claude Opus 4.8, `high`, neue Sessions und `tools: none`;
- Phase 1 erhält nur den minimierten bestätigten Prozesssnapshot;
- Phase 2 erhält denselben Snapshot und ausschließlich deterministisch
  ausgewählte normalisierte Hypothesen;
- Uploadpfade, Personendaten, ursprüngliche Antworten und fremde Prozesse
  erscheinen in keinem Request;
- rein deterministische Ideen werden nicht als Hypothese akzeptiert;
- Automation, Integration und MCP werden dennoch korrekt als
  Szenariobestandteile beschrieben;
- malformed, oversized, timed-out und cancelled Responses verändern keinen
  kanonischen Output;
- Prompt- oder Schema-Manipulation nach dem Start wird durch den Hash erkannt.

Hard Gate:

```zsh
./scripts/qa test tests/opportunity-ai-contract.test.ts tests/process-ai-contract.test.ts
```

### 4. API, Warteschlange und zweiphasige Pipeline

Implementiere Routen, Summary-Readmodell, Operation-Namen, Start, automatische
zweite Phase, Abbruch und technischen Retry.

Erwartete Outputs:

- ein manueller Start erzeugt genau einen Queue-Job und höchstens zwei
  Claude-Aufrufe;
- ohne eine hohe und ohne mindestens zwei mittlere Hypothesen erfolgt exakt ein
  Claude-Aufruf und der terminale Zustand `no_supported_hypotheses`;
- mit mindestens einer hohen oder mindestens zwei mittleren Hypothesen erfolgen
  exakt zwei frische Calls und der Zustand `completed` mit drei Szenarien;
- ein zweiter Start, ein Start für einen Draft und ein Recalc nach Abschluss
  liefern `409`;
- Phase-2-Retry ruft Phase 1 nicht erneut auf;
- ein paralleler Capture- oder Opportunity-Job derselben Prozess-ID wird
  blockiert;
- globale Queue-Parallelität bleibt eins;
- Abbruch, Fehler und Löschung hinterlassen keinen aktiven Zombie-Job.

Hard Gate:

```zsh
./scripts/qa test tests/opportunity-api.test.ts tests/process-operation-manager.test.ts tests/process-api.test.ts
```

### 5. Prozessübersicht und Live-Detailseite

Implementiere Summary-Zusammenführung, Startaktion, Route, authentifizierten
SSE-Ereignisstrom, Stepper, Hypothesengruppen, Szenariovergleich, Stale- und
Fehlerzustände.

Erwartete Outputs:

- Startaktion erscheint nur für bestätigte Prozesse ohne Analyse;
- Prozesslink, Opportunity-Aktion und Papierkorb bleiben getrennt und per
  Tastatur erreichbar;
- laufende Statusänderungen erscheinen ohne Seitenreload;
- nach Phase 1 kann der Benutzer Hypothesen lesen, während Phase 2 läuft;
- der Stepper erlaubt nur verfügbare Schritte und behält die Auswahl;
- Hypothesen sind nach Prozessschritt, Potenzial und Konfidenz sortiert;
- alle drei Human-Oversight-Level erscheinen mit verständlicher deutscher Copy;
- mittlere und niedrige Hypothesen sind sichtbar, aber als nicht verwendet
  gekennzeichnet;
- kein Edit-, Add-, Confirm-, Select- oder Recalc-Control ist vorhanden;
- Refresh und Navigation starten keine KI-Operation.

Hard Gate:

```zsh
./scripts/qa changed
bun run build
```

Chrome-DevTools-Verifikation auf `1440x900` und `768x1024`:

1. bestätigten fiktiven Prozess einmalig starten;
2. Phase-1-Status und anschließende Hypothesengruppen beobachten;
3. während Phase 2 zwischen beiden verfügbaren Schritten wechseln;
4. Assistiert, Teilautonom und Agentisch vollständig lesen;
5. Seite während eines laufenden Zustands neu laden;
6. Stale-Hinweis mit einer lokalen Testfixture prüfen;
7. Fokusreihenfolge, Stepper, aufklappbare Details und Retry prüfen;
8. gefilterte Console auf Errors und Warnings prüfen;
9. Network auf unerwartete `4xx/5xx`, doppelte Starts, genau eine
   `/api/events`-Verbindung und ausbleibende periodische Detailabfragen prüfen.

### 6. Vollständige Regression, Release und Live-Abnahme

Aktualisiere README, Operator Guide und aktive Produktspezifikation. Führe
anschließend vollständige Regression und Release-Build aus.

Hard Gate:

```zsh
./scripts/qa all
./scripts/qa release
git diff --check
```

Erwartete Release-Artefakte:

- `dist/Zukunftswerkstatt-linux-arm64`;
- `dist/Zukunftswerkstatt-macos-arm64`;
- `dist/Zukunftswerkstatt-windows-x64.exe`;
- drei Plattform-ZIPs mit den neuen Defaults, Prompts und Schemas.

Vor dem Pi-Deploy werden Dateianzahl und Checksummen des vorhandenen
`/var/lib/claims-ai/workspace` festgehalten. Der Release wird ohne Workspace-
Daten ausgerollt, der Dienst neu gestartet und anschließend geprüft:

- `claims-ai-portfolio` ist aktiv und bindet nur an `127.0.0.1:3210`;
- `https://claims-ai.ian-buck.dev/api/health` liefert `200`;
- anonyme private API-Aufrufe liefern `401`;
- bestehende bestätigte Prozessaufnahmen bleiben unverändert lesbar;
- ein fiktiver Prozess durchläuft Hypothesen und drei Szenarien;
- Claude-Trace zeigt genau zwei frische Sessions, `high` und keinen
  Workspace-/Web-/MCP-Toolzugriff;
- Browser-Refresh erzeugt keinen zusätzlichen Call;
- Prozesslöschung entfernt auch das Opportunity-Unterverzeichnis;
- Desktop- und Tablet-Console sowie Network bleiben sauber;
- vorbestehende Workspace-Dateien außerhalb des neuen Unterordners behalten
  ihre Checksummen.

## Verbindliche Testszenarien

### Domain

- fünf und acht Prozessschritte erfolgreich;
- fehlender, doppelter und fremder Schritt abgelehnt;
- null, eine und mehrere Hypothesen pro Schritt;
- Schritt ohne Hypothese benötigt Begründung;
- hohe Konfidenz ohne Evidenz abgelehnt;
- hohe Konfidenz mit materieller Annahme abgelehnt;
- reine Deterministik ohne `aiCapabilities` abgelehnt;
- kanonische Sortierung und stabile IDs;
- exakt drei Scenario-Levels;
- unvollständige oder doppelte Hypothesenpartition abgelehnt;
- fremde Hypothesen-, Schritt- und Evidenzreferenzen abgelehnt;
- ungültige Ausführungsmodi je Level abgelehnt;
- gültiger MCP-Zugriffsmechanismus ohne Machbarkeitsbehauptung speicherbar;
- alle unerlaubten Zustandsübergänge abgelehnt.

### Storage

- vollständiger Create/read/restart-Roundtrip;
- atomare Writes für Hypothesen, Szenarien und Metadaten;
- append-only History und Operations;
- ungültiges YAML/JSON sowie manipulierter Contract-Hash abgelehnt;
- Phase-1- und Phase-2-Fehler verändern letzte gültige Dateien nicht;
- technischer Retry nur aus Fehlerzuständen;
- Recovery von queued/running nach Neustart;
- Stale bei Korrektur, Entbestätigung und Hashänderung;
- kaskadierende permanente Prozesslöschung;
- Reset verschiebt den vollständigen abhängigen Ordner;
- existierende Prozesse ohne Opportunity-Ordner bleiben unverändert.

### Claude-Vertrag

- getrennte Base-, Hypothesen- und Szenarioprompts;
- Runtime-Schema entspricht der Zod-Domain;
- Claude Opus 4.8, `high`, keine Session-Persistenz und neue Session je Phase;
- keine Tools, Uploads oder Webfunktionen;
- minimierter Phase-1-Input ohne Personendaten;
- Phase-2-Input enthält ausschließlich ausgewählte hohe oder mittlere Hypothesen;
- Potenzial und Konfidenz werden getrennt begründet;
- deterministische Unterstützung und Integration werden nicht als Ausschluss
  behandelt;
- Assistiert, Teilautonom und Agentisch entsprechen der Human-Oversight-Policy;
- Agentisch wird als Vision mit Voraussetzungen formuliert;
- Timeout, Cancel, ungültiges JSON, falsche Referenzen und Outputlimit führen zu
  phasenspezifischem Fehler ohne Teilpersistenz.

### API und Queue

- `404` vor Start und bei unbekanntem Prozess;
- `409` bei unbestätigtem Prozess, doppeltem Start und abgeschlossenem Recalc;
- ein Call bei keiner hohen Hypothese;
- zwei Calls im Happy Path;
- Phase-1-Fehler und kompletter Retry;
- Phase-2-Fehler und isolierter Phase-2-Retry;
- Abbruch in beiden Phasen;
- Summary-Zählwerte und `isStale` korrekt;
- globale Queue-Reihenfolge über Capture und Opportunity;
- Löschen während aktivem Job gesperrt, danach kaskadierend erfolgreich;
- Prompt- und Schema-Inhalte nicht in API-Responses enthalten.

### UI

- Startaktion und Status je Prozesszustand;
- Navigation direkt nach Start;
- Phase-Status ohne manuellen Reload;
- verfügbare Stepper-Navigation während Phase 2;
- chronologische Schrittgruppen und Sortierung innerhalb eines Schritts;
- sichtbare Potenzial-/Konfidenzbegründung;
- neutrale No-Supported-Hypotheses-Meldung;
- alle drei Szenarien und alle Kontrollmodi verständlich dargestellt;
- technischer Retry, Stale-Warnung und Refresh-Sicherheit;
- keine Bearbeitungs-, Auswahl- oder Neuberechnungsaktion;
- Desktop- und Tablet-Layout, Tastaturbedienung, Fokus, Console und Network.
