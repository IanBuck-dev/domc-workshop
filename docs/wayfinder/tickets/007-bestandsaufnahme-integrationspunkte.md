# Bestandsaufnahme der Integrationspunkte im Code

Karte: [Dateibasiertes Agenten-Gedächtnis](../map-agent-memory.md)
Typ: `wayfinder:research` (AFK)
Blockiert von: —
Bearbeiter: Claude (Research-Subagent)
Status: geschlossen

## Question

Wo dockt ein Gedächtnis heute im Code an? Vollständige Bestandsaufnahme als Faktengrundlage
für die Entwurfs-Tickets — keine Entwürfe, nur Befunde mit `datei:zeile`.

Zu erheben:

1. **Chat-Capture-Lebenszyklus.** Wo beginnt und endet ein Chat-Gespräch technisch? Gibt es
   ein explizites „Gespräch abgeschlossen"-Ereignis oder eine Nutzeraktion (Bestätigung des
   Prozessverständnisses?), an das ein Destillationslauf hängen könnte — oder endet ein
   Gespräch nur implizit? Wie werden Turns persistiert (Transkript-Ablage, Session-ID)?
2. **Systemprompt-Aufbau des Capture-Agenten.** Wo wird der Prompt zusammengesetzt, wie
   werden versionierte Prompts/Schemas eingebunden (`freezeContracts()`-Mechanik), welcher
   Kontext fließt heute schon ein?
3. **Claude-Adapter für begrenzte Einzeloperationen.** Wie werden heute bounded Operations
   (Synthese, Hypothesen) ausgelöst — Muster, dem ein Destillations- und ein
   Konsolidierungslauf folgen würde? Wie wird AI-Output laufzeitvalidiert?
4. **Speicherschicht.** Repository-Muster, atomare Writes, append-only Audit: wo liegt der
   Workspace auf der Platte, wie sähe ein `memory/`-Ablageort aus, der die Audit-Regel aus
   `AGENTS.md` erfüllt? Gibt es bereits Git-Versionierung des Workspace?
5. **Provenienzmodell.** Wie sind `user_stated` … `unknown` implementiert — wiederverwendbar
   für Gedächtniseinträge?
6. **Einstellungsseite.** Wo liegt sie, welche Muster für manuell gestartete Jobs mit
   Fortschritt/Ergebnisanzeige existieren schon (z. B. Discovery-Job)?
7. **Überschneidung mit `demo-data/UNTERNEHMEN.md`** und bestehenden Prozessfakten: welches
   Firmenwissen existiert schon strukturiert, damit das Brain es nicht dupliziert?

## Resolution

Befunde (Stand 2026-08-10, Branch `feature/dateibasiertes-agenten-gedaechtnis`). Alle
Pfade relativ zur Repo-Wurzel.

### 1. Chat-Capture-Lebenszyklus

- **Beginn:** `ChatCaptureRepository.initialize` legt beim Anlegen eines Chat-Prozesses
  `chat/` mit `state.json`, `session.json`, leerem `transcript.jsonl`, eingefrorenen
  Contracts und der festen Begrüßung an — `packages/storage/src/chat-capture-repository.ts:37-117`.
- **Turns:** `POST /api/processes/:id/chat` startet einen Zug
  (`apps/server/src/routes/chat-captures.ts:66`); der Zug läuft im `ChatTurnRunner` und
  überlebt den Verbindungsabbruch — der HTTP-Stream ist nur Zuhörer
  (`apps/server/src/routes/chat-captures.ts:110-113`, `apps/server/src/chat-turn-runner.ts:65-137`).
- **Turn-Persistenz:** Transkript ist ein append-only JSONL mit Dedupe über die
  User-Event-ID (`packages/storage/src/chat-capture-repository.ts:136-147`). Die
  Nutzernachricht wird **vor** dem Claude-Aufruf angehängt
  (`apps/server/src/chat-capture-service.ts:141-152`), die Assistenzantwort nach
  verifiziertem Abschluss (`apps/server/src/chat-capture-service.ts:263-277`); Fehl-
  und Abbruchzüge schreiben ein `status: "aborted"`-Event
  (`apps/server/src/chat-capture-service.ts:287-308`).
- **Explizites Gesprächsende: existiert.** `POST /:id/chat/confirm` ist eine
  Nutzeraktion (Button in
  `apps/web/src/components/process-confirmation-actions.tsx:19`), die das
  Prozessverständnis bestätigt: `finalize`
  (`packages/storage/src/chat-capture-repository.ts:264-285`, mit Override-Schleuse bei
  offenen Punkten) → `finalizeChatCapture` setzt `state: "confirmed"` und auditiert
  `chat-understanding-confirmed`
  (`packages/storage/src/process-capture-repository.ts:760-786`), danach
  Bestätigungs-Event im Transkript (`apps/server/src/routes/chat-captures.ts:195-205`).
  **Präzedenzfall für einen Anschlusslauf:** direkt nach der Bestätigung wird
  automatisch `opportunities.start(record.id)` gestartet, Fehlschlag wird nur
  auditiert und blockiert die Bestätigung nicht
  (`apps/server/src/routes/chat-captures.ts:206-219`). Nach `confirmed` sind weitere
  Chat-Züge gesperrt (`apps/server/src/chat-capture-service.ts:119-120`); ohne
  Bestätigung endet ein Gespräch nur implizit (Nutzer hört auf zu schreiben).
- **Session-ID-Handling:** `session.json`
  (`chatSessionRecordSchema`) hält `activeSessionId` (app-seitig erzeugte UUID vor dem
  ersten Zug), `activeSessionStarted`, `replacementCandidateId` (Ersatz-Session nach
  Fehlzug) und `replacedSessionIds`
  (`packages/storage/src/chat-capture-repository.ts:69-76`). Resume-Entscheidung je Zug
  in `apps/server/src/chat-capture-service.ts:193-201`; die tatsächliche Session-ID
  kommt nach dem Zug aus `providerMetadata["claude-code"].sessionId` zurück
  (`apps/server/src/chat-capture-service.ts:243-262`). Provider läuft mit
  `persistSession: true` und `resume`/`sessionId`-Option
  (`packages/claude/src/chat-capture-adapter.ts:41,59-63`). Sessions werden erst bei
  Prozesslöschung entfernt (`apps/server/src/index.ts:97-101`,
  `apps/server/src/chat-capture-service.ts:310-320`). Regelrahmen: Chat Capture ist
  die einzige Resume-Ausnahme, nur durch Nutzerzug (`AGENTS.md:31-32`).

### 2. Systemprompt-Aufbau des Capture-Agenten

- **`freezeContracts()`:** `apps/server/src/chat-capture-service.ts:322-373` — kopiert
  beim ersten Zug `defaults/prompts/process-chat.md` und
  `defaults/ai-schemas/process-understanding.json` nach
  `<prozess>/chat/contracts/` und schreibt SHA-256-Hashes in
  `chat/contract-manifest.json`; identische Einfrierung bereits bei `initialize`
  (`packages/storage/src/chat-capture-repository.ts:39-105`). Konsequenz laut
  `AGENTS.md:41-44`: Promptänderungen wirken nur auf neue Prozesse.
- **Zusammensetzung je Zug:** eingefrorener Prompt als `systemPrompt`
  (`apps/server/src/chat-capture-service.ts:203`); der User-Prompt wird aus
  Recovery-Kontext (Transkript + letzter gültiger Stand,
  `apps/server/src/chat-capture-service.ts:375-383`), Aktionsanweisung,
  Unterlagenliste (relative Pfade + Evidenz-IDs), Prozessbild-Mentions und der
  Nutzernachricht mit `sourceId` komponiert
  (`apps/server/src/chat-capture-service.ts:169-204`).
- **Adapterkonfiguration:** Claude-Code-Provider, Modell `claude-opus-4-8`, Effort
  medium, `maxTurns: 12`, Tools `Read/Glob/Bash/Write` + MCP-Tool
  `verify_process_flow`, `cwd` = Prozessverzeichnis
  (`packages/claude/src/chat-capture-adapter.ts:22-63`).
- **Heute einfließender Kontext:** ausschließlich prozesslokal (Schema, ausgewählte
  Unterlagen, Transkript/Recovery, Mentions). Kein firmenweites Wissen:
  `defaults/prompts/process-chat.md` enthält keinen Unternehmenskontext, und
  `demo-data/UNTERNEHMEN.md` wird von keinem Code referenziert (Grep über
  `apps/`, `packages/`, `defaults/` ohne Treffer).

### 3. Begrenzte Einzeloperationen (bounded Operations) und Laufzeitvalidierung

- **Muster:** schmale Adapterklassen über `SandboxRunner.runStructured` mit
  Zod-`responseSchema` + eingefrorenem `responseJsonSchema`, `tools: "none"` —
  Hypothesen: `packages/claude/src/opportunity-hypothesis-adapter.ts:12-28`,
  Szenarien: `packages/claude/src/opportunity-scenario-adapter.ts`, Formularfluss:
  `packages/claude/src/process-synthesis-adapter.ts` /
  `process-follow-up-adapter.ts`. Ergebnis-Typ `AiStructuredResult<T>` mit `trace`
  (`packages/claude/src/ai-runtime-contracts.ts:3-15`).
- **Laufzeitvalidierung des AI-Outputs:** JSON-Envelope-Parsing plus
  `operation.responseSchema.parse(raw)` in
  `packages/claude/src/sandbox-runner.ts:409-415` (Fence-tolerantes
  `parsePromptedJson` ab `:203`).
- **Auslösung:** `enqueueProcessOperation`
  (`apps/server/src/process-operation-manager.ts:81-135`) — global serielle Queue
  (`queueTail`), höchstens eine aktive Operation je Prozess (`:44-49,87-88`),
  `AbortController`, Zustände `queued/running/failed`, jede Änderung wird per SSE
  publiziert (`:37-42`). Der Discovery-Job kettet deterministisch Hypothesen- und
  Szenarienphase in **einer** Operation
  (`apps/server/src/opportunity-discovery-service.ts:29-121`); `start` verlangt
  `state === "confirmed"` (`:123-131`), `retry` mit Stale-Prüfung (`:160-172`).
  Die Zwei-Aufruf-Kette ist laut `AGENTS.md:30` die einzige erlaubte Ausnahme vom
  Ein-Operation-Prinzip.

### 4. Speicherschicht

- **Workspace-Wurzel:** `WORKSPACE_PATH` oder `<appBase>/workspace`
  (`apps/server/src/launcher.ts:24-26`); im Dev-Betrieb `<repo>/workspace`, per
  `.gitignore` (Eintrag `workspace/`) vom Repo ausgeschlossen.
- **Layout:** `workspace/process-captures/PROC-XXXX/`
  (`packages/storage/src/process-capture-repository.ts:256-262`) mit
  `process-understanding.json`, `history.jsonl` (Audit), `operations.jsonl`
  (AI-Traces, `:916`), `uploads/`, `chat/` (`state.json`, `session.json`,
  `transcript.jsonl`, `contracts/`, `tmp/`,
  `last-valid-process-understanding.json`); daneben `workspace/trash/`
  (`packages/storage/src/workspace-repository.ts:22-27`); Reset verschiebt nach
  `trash/` statt zu löschen (`packages/storage/src/workspace-repository.ts:35-52`).
- **Atomare Writes:** Temp-Datei + `rename`
  (`packages/storage/src/atomic-write.ts:3-12`). **Append-only Audit:** JSONL-Append
  (`packages/storage/src/audit-log.ts:3-10`), genutzt u. a. für
  `chat-understanding-published` (`packages/storage/src/chat-capture-repository.ts:239-260`).
- **Git-Versionierung des Workspace: existiert nicht.** Kein Code initialisiert oder
  committet ein Git-Repo im Workspace; der Workspace liegt im Gitignore.
- **Plausibler `memory/`-Ort:** als Geschwisterverzeichnis von `process-captures/`
  unter der Workspace-Wurzel, angelegt analog in `WorkspaceRepository.ensure`
  (`packages/storage/src/workspace-repository.ts:22-27`); Audit-Regel wäre mit dem
  bestehenden `audit()`-Helper (eigenes `history.jsonl`) und `atomicWrite` erfüllbar.

### 5. Provenienzmodell

- Enum `provenanceSchema` mit exakt den sechs Werten `user_stated`, `file_evidence`,
  `ai_structured`, `ai_inferred`, `user_confirmed`, `unknown` —
  `packages/domain/src/process-understanding.ts:111-118`.
- Jeder Fakt trägt `factBase`: `provenance`, `evidenceIds`, `confidence`,
  `assumptions`, `confirmed` (`packages/domain/src/process-understanding.ts:355-361`);
  Evidenzarten inkl. `chat_message` in `evidenceReferenceSchema` (`:340-353`).
- UI-Abbildung: deutsche Labels und Badge-Töne in
  `apps/web/src/lib/process-provenance.ts:6-26`. Discovery-Ergebnisse sind fest
  `ai_inferred` (`packages/domain/src/opportunity-discovery.ts:243,495`); manuelle
  Korrekturen setzen `user_confirmed`
  (`packages/domain/src/process-understanding-editing.ts:41`).
- Wiederverwendbar: reines Zod-Enum im React-/Claude-unabhängigen Domain-Paket.

### 6. Einstellungsseite und Job-Muster

- Seite: `apps/web/src/pages/settings-page.tsx`, Route `/settings`
  (`apps/web/src/app.tsx:75`). Sie ist heute **rein browserlokal**: Konfiguration wird
  per `localStorage` gespeichert/exportiert (`apps/web/src/lib/local-config.ts`,
  `settings-page.tsx:71-84,130-170`); einziger Server-Aufruf ist die
  Anweisungs-Vorschau (`apps/server/src/routes/config.ts:29`). **Kein** manuell
  startbarer Server-Job wird bisher aus den Einstellungen gestartet.
- Vorhandenes Muster für manuell gestartete Jobs mit Fortschritt/Ergebnis: der
  Discovery-Job — Start automatisch nach Bestätigung
  (`apps/server/src/routes/chat-captures.ts:206-219`) bzw. manuell per
  Retry-Button (`apps/web/src/pages/opportunity-discovery-page.tsx:155-165`);
  Fortschrittsanzeige `OpportunityProgress`
  (`apps/web/src/pages/opportunity-discovery-page.tsx:105`) und globale
  Warteschlangenanzeige `AiOperationQueue`
  (`apps/web/src/components/ai-operation-queue.tsx:8-16`), gespeist per SSE
  (`apps/web/src/lib/process-events.tsx:47`, `apps/server/src/routes/events.ts:15`,
  Publikation in `apps/server/src/process-operation-manager.ts:37-42`).

### 7. Bestehendes strukturiertes Firmenwissen (Nicht-Duplizieren)

- `demo-data/UNTERNEHMEN.md`: Kurzporträt der fiktiven LifeCorp (`:9-19`), sechs
  Fachbereiche deckungsgleich mit den Abteilungen in
  `defaults/process-capture-config.json` (`:21-31`), acht feste Systemnamen
  VERA/KOMPASS/PARTO/AKTE/PROVISO/SAP FI/Outlook/LEBUS (`:33-48`), zwei Personas
  (`:50-69`). Die Datei ist reine Demo-Dokumentation und wird von keinem Code
  gelesen.
- Prozessfakten liegen bereits strukturiert je Prozess in
  `process-understanding.json`: u. a. `purpose` … `systems` als Fakten mit
  Provenienz (`packages/domain/src/process-understanding.ts:542-548`), Schritte mit
  `informationItems` (`:504`) und Flow-Graph. Ein firmenweites Gedächtnis dürfte
  weder diese prozesslokalen Fakten noch die statischen LifeCorp-Stammdaten
  (Systeme, Fachbereiche, Personas) redundant führen.
