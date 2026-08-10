# Dateibasiertes agentisches Gedächtnis 2025/2026

> Recherche-Report (Sol Pro, 7. August 2026), unverändert übernommen als Referenz für die
> Wayfinder-Karte [Dateibasiertes Agenten-Gedächtnis](../wayfinder/map-agent-memory.md).
> Achtung: Das hier empfohlene volle Pipeline-Design (Inbox → Consolidator → Statusleiter)
> ist für den Prototyp bewusst **nicht** übernommen — entschieden ist ein leichteres Modell
> (ein Brain, Destillation nach dem Gespräch mit Sofort-Write, manuelle Konsolidierung).

> **Stand: 7. August 2026.** Berücksichtigt wurden primär offizielle Dokumentationen und Repositories. Die zitierten Security-Arbeiten aus Juni/Juli 2026 sind aktuelle Preprints, keine bereits etablierten Standards.

## Executive Summary

Für ein leichtgewichtiges, dateibasiertes Gedächtnis zeichnet sich inzwischen ein relativ konsistentes Muster ab:

1. **Ein kleiner, immer verfügbarer Index**, der beschreibt, welches Wissen wo liegt.
2. **Thematische Markdown-Dateien**, die nur bei Bedarf gelesen werden.
3. **Direkte Memory-Writes nur in einen Kandidatenbereich**, nicht ungeprüft in kanonisches Firmenwissen.
4. **Ein Konsolidierungslauf nach dem Gespräch**, der Kandidaten dedupliziert, Konflikte erkennt und Updates als nachvollziehbaren Diff einspielt.
5. **Strikte Scopes und Schreibrechte**: unternehmensweites Wissen überwiegend read-only, prozessbezogenes Wissen kontrolliert beschreibbar, nutzerbezogenes Wissen isoliert.
6. **Provenienz, Status und Gültigkeit pro Aussage**, damit eine Mitarbeiteräußerung nicht automatisch zur „Firmenwahrheit“ wird.

Dieses Grundmuster findet sich in unterschiedlichen Ausprägungen bei Claude Code, Anthropics Memory Tool, Letta MemFS, LangMem und den neueren Deep-Agents-Patterns. Claude Code verwendet inzwischen ausdrücklich ein kleines `MEMORY.md` als Index und lagert Details in Topic-Dateien aus. Letta lädt nur Dateien unter `system/` dauerhaft und liest den Rest bei Bedarf. Beide Ansätze funktionieren ohne Vektorindex. ([Claude Platform Docs][1])

Für euren Versicherungs-Use-Case sollte der Capture-Agent **nicht selbstständig kanonische Firmen-, Rollen- oder Systemdateien editieren**. Er sollte lediglich evidenzgebundene Kandidaten erzeugen. Ein separater Consolidator entscheidet anschließend zwischen `IGNORE`, `ADD`, `CONFIRM`, `SUPERSEDE` und `CONFLICT`. Das ist etwas restriktiver als Claude Codes Auto-Memory, entspricht aber besser den dokumentierten Enterprise- und Security-Mustern mit read-only Shared Memory, Review, Versionierung und getrennten Konsolidierungsläufen. ([Claude Platform][2])

---

# 1. Welche Ansätze sind tatsächlich dateibasiert?

Es ist sinnvoll, drei unterschiedliche Kategorien auseinanderzuhalten:

### A. Dateien sind der kanonische Speicher

Das trifft auf Claude Codes Auto-Memory, Letta Agent SDK V2/MemFS und auf eine lokal implementierte Variante des Anthropic Memory Tools zu.

### B. Das System bietet eine Datei-API, der Speicher kann aber etwas anderes sein

Anthropics Memory Tool und LangChains Deep Agents arbeiten mit Dateioperationen beziehungsweise Dateipfaden, können diese jedoch auf lokale Dateien, Datenbanken oder andere Backends abbilden.

### C. Der Speicher ist grundsätzlich datenbank- oder vektorbasiert

Mem0, LangMem/LangGraph und das frühere Letta/MemGPT-Modell gehören überwiegend hierher. Von ihnen lassen sich Schreib- und Konsolidierungsrichtlinien übernehmen, nicht aber ohne Weiteres die Infrastruktur.

## Vergleichstabelle

| Ansatz                                     | Tatsächlicher Speicher                                                                                                                                                             | Schreiben und Konsolidierung                                                                                                                                               | Abruf                                                                                                                          | Zusätzliche Infrastruktur                                             | Einordnung für euren Fall                                                                                                                                                             |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Anthropic Memory Tool**                  | Dateioperationen unter `/memories`; das Backend wird vollständig von der Anwendung implementiert. Lokales Dateisystem, DB, Cloud Storage oder verschlüsselte Dateien sind möglich. | Claude ruft `create`, `str_replace`, `insert`, `delete` und `rename` auf. Die API bringt keine fachliche Freigabe-, Dedupe- oder Provenienzschicht mit.                    | Verzeichnis anzeigen, Datei oder Zeilenbereich lesen; Just-in-time statt vollständigem Prompt-Load.                            | Keine, wenn lokales Dateisystem verwendet wird.                       | **Guter Low-Level-Baustein**, aber für Versicherungswissen nur hinter einer engeren Policy-Schicht. ([Claude Platform][3])                                                            |
| **Claude Code `CLAUDE.md`**                | Von Menschen gepflegte Markdown-Dateien auf Dateisystemebene. Scopes für Organisation, Nutzer, Projekt und lokale Einstellungen.                                                   | Primär manuell gepflegte Anweisungen und Konventionen; kein autonomes Lernsystem.                                                                                          | Root- und übergeordnete Dateien beim Start, untergeordnete Dateien bei Zugriff auf den jeweiligen Teilbaum.                    | Keine.                                                                | Für **Memory-Policy und stabile Agentenregeln**, nicht als wachsendes Firmenfakten-Korpus. `CLAUDE.md` ist Kontext, keine technische Enforcement-Schicht. ([Claude Platform Docs][1]) |
| **Claude Code Auto-Memory**                | Pro Repository ein lokales Verzeichnis mit `MEMORY.md` und optionalen thematischen Markdown-Dateien.                                                                               | Claude entscheidet selbst, was dauerhaft nützlich ist, und schreibt mit normalen `Write`-/`Edit`-Tools.                                                                    | `MEMORY.md` ist Index; die ersten 200 Zeilen beziehungsweise 25 KB werden beim Start geladen, Details liegen in Topic-Dateien. | Keine, aber Dateisystempersistenz muss beim Hosting gesichert werden. | **Sehr relevantes Strukturmuster**, aber das Default-Verhalten ist für Multi-User-/Enterprise-Wissen zu wenig gescoped und zu frei beschreibbar. ([Claude Platform Docs][1])          |
| **Anthropic Managed Agents Memory/Dreams** | Gehostete Text- beziehungsweise Markdown-ähnliche Memories in Anthropic Memory Stores.                                                                                             | Agent-Writes, API-basierte Korrekturen, immutable Versionen und separate „Dreams“, die einen neuen konsolidierten Store erzeugen.                                          | Memory Store wird als Ressource an eine Session gehängt; read-only oder read-write.                                            | Anthropic Managed Agents.                                             | **Gute Referenz für Governance**, aber nicht passend zur Vorgabe „kein externer Memory-Dienst“. ([Claude Platform][2])                                                                |
| **Letta Agent SDK V2 / MemFS**             | Git-backed Markdown-Dateisystem mit YAML-Frontmatter.                                                                                                                              | Direkte Agentenupdates, explizites `/remember`, regelmäßiges „Dreaming“ sowie `/doctor` für Dedupe, Platzierung und Tokenverbrauch. Jede Änderung wird versioniert.        | `system/` wird in den Systemprompt geladen; andere Dateien werden nur bei Bedarf gelesen. Kein Vektorindex im Default.         | Letta-Harness und Git; Self-Hosting ist möglich.                      | **Konzeptionell der nächste Vergleichspunkt** zu eurem Ziel. Vollständige Adoption wäre jedoch deutlich schwerer als eine eigene kleine Markdown-Schicht. ([Letta Docs][4])           |
| **Letta V1 / MemGPT**                      | Persistenter Datenbankzustand, Memory Blocks und vektorbasierte Archival Memory.                                                                                                   | Agenten verändern Memory Blocks über Tools; gesamte Agentenhistorie wird in einer DB gehalten.                                                                             | Wichtige Blocks im Kontext, größere Bestände über Files, Archival Memory oder externes RAG.                                    | Letta-Server, Datenbank und teilweise Vektorsuche.                    | **Nicht das aktuelle dateibasierte Letta-Modell.** Für neue Implementierungen empfiehlt Letta inzwischen V2/MemFS. ([Letta Docs][5])                                                  |
| **Mem0**                                   | SQL-Datenbank für Fakten und Metadaten, Vector Store für Embeddings sowie optionaler Entity Store. Der OSS-Default nutzt lokales Qdrant und SQLite History.                        | Nachrichten werden an `add` gesendet, extrahiert, gefiltert und dedupliziert; explizite Update-/Delete-Operationen und Ablaufdaten sind vorgesehen.                        | Vor dem nächsten Modellaufruf über `search`; semantische, Keyword-, Entity- und Metadatenfilter.                               | LLM, Embeddings, Vector Store und SQL beziehungsweise Mem0 Platform.  | **Nicht dateibasiert.** Relevant als Vorlage für Ingestion-Regeln, Confidence, Scoping und Ablaufmechanismen. ([Mem0][6])                                                             |
| **LangMem / LangGraph**                    | Strukturierte JSON-Dokumente in einem LangGraph Store; produktive Beispiele verwenden persistente Stores wie Postgres.                                                             | LLM verarbeitet Gespräche plus bestehenden Memory-Zustand und erzeugt Inserts, Updates oder Konsolidierungen. Hot Path und Background Processing sind explizit vorgesehen. | Namespaces, Filter und optional semantische Suche.                                                                             | LangGraph Store; für Produktion üblicherweise persistente DB.         | **Kein natives Markdown-System**, aber ein gutes Referenzmodell für Profiles, Collections und Background Consolidation. ([Langchain AI][7])                                           |
| **LangChain Deep Agents**                  | Dateiartige API, deren Persistenz vom konfigurierten Backend abhängt. Nicht zwingend physische Dateien.                                                                            | Standardmäßig Hot-Path-Edits, alternativ separater Consolidation Agent oder Cron.                                                                                          | Prompt-Load oder bedarfsgesteuertes Nachladen. Scopes für Nutzer, Agent und Organisation.                                      | LangGraph beziehungsweise gewähltes Backend.                          | Gute Vorlage für **Scopes, read-only Shared Memory und Konsolidierung**, aber nicht zwingend das gewünschte reine Markdown-Dateisystem. ([Docs by LangChain][8])                      |

## Anthropic Memory Tool versus Claude Agent SDK

Das Anthropic Memory Tool ist als clientseitiges Tool der Messages API dokumentiert: Claude fordert Dateioperationen an, eure Anwendung führt sie aus. Der Claude Agent SDK bringt dagegen Claude Codes eigenes Auto-Memory und normale Dateiwerkzeuge mit. Im SDK wird Auto-Memory beim Sessionstart geladen und mit `Write` beziehungsweise `Edit` verändert; es ist kein dediziertes Memory-Tool. ([Claude Platform][3])

Für euren Agent SDK empfiehlt sich daher nicht, das Messages-API-Memory-Tool exakt nachzubauen, sondern seine **enge Dateischnittstelle als Vorbild** zu verwenden:

```text
memory_search
memory_read
memory_propose
```

Ein allgemeines `memory_write` sollte der Capture-Agent nicht erhalten. Das eigentliche `memory_apply` gehört in den Consolidator beziehungsweise in deterministischen Anwendungscode.

## `CLAUDE.md` und `MEMORY.md` erfüllen unterschiedliche Aufgaben

`CLAUDE.md` ist primär ein von Menschen gepflegtes System von Anweisungen und Konventionen. Es kann auf Organisations-, Nutzer-, Projekt- und lokaler Ebene liegen. In Agent-SDK-Anwendungen wird sein Inhalt als Projektkontext in die Conversation injiziert, nicht als eigentlicher Systemprompt. Außerdem sind `CLAUDE.md`-Regeln nicht technisch erzwungen; für echte Einschränkungen verweist Anthropic auf Permissions und Hooks. ([Claude Platform Docs][1])

Auto-Memory ist dagegen von Claude selbst gepflegtes Wissen. Das aktuelle Claude-Code-Muster ist:

```text
memory/
├── MEMORY.md          # kleiner Index
├── debugging.md       # Topic-Datei
├── api-conventions.md
└── ...
```

Die ersten 200 Zeilen oder 25 KB von `MEMORY.md` werden beim Start geladen. Claude soll Details in thematische Dateien verschieben. Das ist der direkteste dokumentierte Präzedenzfall für „Index im Prompt, Details bei Bedarf“. ([Claude Platform Docs][1])

---

# 2. Schreib-Politik

## Drei dokumentierte Schreibmodelle

### 2.1 Hot Path: Der aktive Agent schreibt sofort

Claude Codes Auto-Memory, das Anthropic Memory Tool, Letta `/remember` und Deep Agents erlauben, dass der Hauptagent während des Gesprächs entscheidet, was gespeichert wird. Der Vorteil ist unmittelbare Verfügbarkeit und sichtbares Verhalten. Nachteile sind zusätzliche Latenz, konkurrierende Aufgaben im Agentenprompt und die Gefahr, dass ein einzelner Turn überbewertet wird. LangChain dokumentiert genau diesen Trade-off zwischen sofortiger Verfügbarkeit und zusätzlicher Komplexität beziehungsweise Ablenkung des Hauptagenten. ([Claude Platform Docs][1])

### 2.2 Background Consolidation

Letta Dreaming, Anthropic Dreams, LangMem Reflection und Deep Agents verwenden separate Hintergrundläufe, die vergangene Conversations und bestehende Memories gemeinsam betrachten. Dadurch lassen sich mehrere Aussagen zusammenführen, Duplikate entfernen und Widersprüche erkennen, ohne dass der Capture-Agent gleichzeitig interviewen und Wissenspflege betreiben muss. ([Letta Docs][9])

LangMem empfiehlt für fortlaufende Chats auch ein Debounce-Modell: Ein geplanter Reflexionslauf wird verschoben, wenn weitere Nachrichten eintreffen, damit nicht jeder einzelne Turn isoliert und mehrfach verarbeitet wird. ([Langchain AI][10])

### 2.3 Hybrides Modell

In der aktuellen Praxis ist das robuste Modell eine Kombination:

- Im Hot Path wird ein wichtiger Sachverhalt **als Kandidat mit Quelle** festgehalten.
- Nach Gesprächsende wird der Kandidat konsolidiert.
- Größere Reorganisationen laufen periodisch oder ab einem Größen-/Drift-Trigger.

Letta kombiniert direkte Updates und `/remember` mit Dreaming und `/doctor`. Deep Agents dokumentiert sowohl Hot Path als auch separate Konsolidierungsagenten und Cron. Anthropics Dreams erzeugen bewusst einen neuen Store, sodass der bisherige Zustand nicht ungeprüft überschrieben wird. ([Letta Docs][9])

## Empfehlung für euren Prozess-Capture-Agenten

### Während des Gesprächs

Der Capture-Agent darf nur `memory_propose` aufrufen. Das erzeugt einen append-only Eintrag unter `inbox/<session-id>.md`:

```yaml
candidate_id: C-2026-08-07-001
proposed_scope: process:schadenaufnahme
statement: "Die fachliche Freigabe erfolgt durch die Gruppenleitung."
certainty: explicit_statement
source:
  session_id: ses_123
  turn_id: turn_18
  speaker_id: user_42
  origin: authenticated_employee
```

Die Äußerung wird damit gespeichert, aber noch nicht als bestätigte Firmenwahrheit behandelt.

### Nach dem Gespräch

Ein ereignisgetriebener Consolidator erhält:

- das Gespräch,
- die Kandidaten,
- relevante existierende Topic-Dateien,
- den aktuellen Index,
- bekannte Alias- und Begriffszuordnungen.

Er muss für jeden Kandidaten genau eine strukturierte Aktion liefern:

| Aktion      | Bedeutung                                                         |
| ----------- | ----------------------------------------------------------------- |
| `IGNORE`    | Einmalige, irrelevante, spekulative oder bereits bekannte Aussage |
| `ADD`       | Neuer, klar abgegrenzter Fakt                                     |
| `CONFIRM`   | Bestehender Fakt wird durch eine weitere Quelle bestätigt         |
| `SUPERSEDE` | Eine neuere Aussage ersetzt eine ältere                           |
| `CONFLICT`  | Zwei Aussagen widersprechen sich; keine automatische Auflösung    |
| `PROMOTE`   | Kandidat erreicht einen höheren Vertrauensstatus                  |

Der eigentliche Dateidiff wird anschließend von Anwendungscode validiert und geschrieben. Der LLM-Consolidator sollte keinen uneingeschränkten Shell- oder Edit-Zugriff auf den kanonischen Memory-Bestand erhalten.

### Cron nur als Maintenance-Schicht

Der primäre Konsolidierungslauf sollte **nach jedem abgeschlossenen Gespräch** ausgelöst werden. So steht neues Wissen für das nächste Interview zur Verfügung und es gehen keine Conversations durch unpassende Cron-Lookback-Fenster verloren.

Ein täglicher oder wöchentlicher Cron eignet sich zusätzlich für:

- Zusammenführen kleiner Duplikate,
- Überprüfung abgelaufener `review_by`-Daten,
- Aufteilung zu großer Dateien,
- Regeneration des Index,
- Erkennung verwaister oder widersprüchlicher Einträge.

Deep Agents weist darauf hin, dass Cron-Intervall und Transcript-Lookback genau zusammenpassen müssen; andernfalls werden Conversations doppelt verarbeitet oder ausgelassen. ([Docs by LangChain][8])

## Maßnahmen gegen Zumüllung und falsche Einträge

### Strikte Aufnahmekriterien

Mem0 zeigt explizit das Problem, dass aus „Ich glaube, ich könnte allergisch sein“ ein bestätigter Fakt werden kann. Die dokumentierten Gegenmaßnahmen sind domänenspezifische Speicheranweisungen, Confidence-Schwellen, Ausschluss sensibler Inhalte und klare Update-/Delete-Regeln. ([Mem0][11])

Für euch sollten nur folgende Inhalte dauerhaft gespeichert werden:

- Firmen- und Fachbegriffe,
- stabile Zuständigkeiten,
- Systeme und relevante Systemrollen,
- explizite Prozessvarianten und Ausnahmen,
- wiederholt beobachtete Prozessmuster,
- offene Konflikte und Fragen,
- nutzerbezogene Bedienpräferenzen.

Nicht gespeichert werden sollten:

- Small Talk,
- Vermutungen ohne Kennzeichnung,
- agenteneigene Erklärungen ohne externe Evidenz,
- konkrete Kunden-, Vertrags-, Schaden- oder Gesundheitsdaten,
- temporäre Gesprächsplanung,
- aus Nutzereingaben abgeleitete Agentenanweisungen.

Anthropic empfiehlt ebenfalls, den Speicher thematisch einzuschränken, unnötige Dateien zu vermeiden, überholte Inhalte zu entfernen und Größen- beziehungsweise Ablaufgrenzen durch die Anwendung durchzusetzen. ([Claude Platform][3])

### Update statt Duplikat

Wenn dieselbe Aussage bereits vorhanden ist, sollte der Consolidator:

1. einen vorhandenen Fakt bestätigen,
2. dessen `last_confirmed_at` und Quellenliste ergänzen,
3. oder ihn explizit superseden.

Mem0 empfiehlt Updates, wenn Informationen sich ändern, aber relevant bleiben, und Deletes nur für vollständig falsche, irrelevante oder doppelte Einträge. ([Mem0][11])

### Kein stilles Überschreiben

Widersprüchliche Aussagen dürfen nicht per Last-Writer-Wins aufgelöst werden. Deep Agents dokumentiert Last-Writer-Wins als reales Risiko bei parallelen Dateiupdates und empfiehlt getrennte Topic-Dateien beziehungsweise serialisierte Background Consolidation. Anthropic Managed Agents verwendet für konkurrierende Änderungen einen Hash-basierten Compare-and-Swap-Mechanismus. ([Docs by LangChain][8])

Für ein Git-basiertes System genügt zunächst:

- Konsolidierungsjobs pro Unternehmen serialisieren,
- aktuellen Commit-Hash beim Jobstart speichern,
- nur anwenden, wenn der Head unverändert ist,
- andernfalls neu lesen und erneut konsolidieren.

### Verfall und Review statt automatischer Wahrheit

Ein Fakt sollte nicht nur `updated_at`, sondern auch `review_by`, `valid_from` und optional `valid_until` besitzen. Abgelaufene Einträge werden standardmäßig nicht in den Prompt aufgenommen, bleiben aber im Archiv und Audit erhalten. Das entspricht dem Mem0-Modell, bei dem abgelaufene Memories aus normalen Suchergebnissen entfernt, aber nicht automatisch gelöscht werden. ([Mem0][12])

---

# 3. Struktur und Abruf

## Eine große Datei

Eine einzige große `MEMORY.md` ist anfangs einfach, kippt aber in drei Punkten:

- Jede Änderung erfordert Kontext über einen großen Bestand.
- Konflikte und versehentliche Überschreibungen nehmen zu.
- Der komplette Inhalt verbraucht bei jeder Session Prompt-Tokens.

LangChain beschreibt dasselbe Problem beim „Profile“-Ansatz: Ein einzelnes ständig aktualisiertes Dokument wird mit zunehmender Größe fehleranfällig und sollte dann in mehrere Dokumente geteilt werden. Claude Code begrenzt den beim Start geladenen `MEMORY.md`-Teil deshalb auf 200 Zeilen beziehungsweise 25 KB. ([Docs by LangChain][13])

**Eignung:** nur für Index, Bootstrap-Kontext oder sehr kleine Nutzerprofile.

## Eine Datei pro Fakt

Eine Datei pro Fakt ermöglicht atomare Änderungen und geringe Schreibkonflikte. Sie führt aber zu:

- sehr vielen Dateien,
- aufwendiger Navigation,
- schwieriger Deduplizierung,
- Verlust von thematischem Zusammenhang,
- höherem Tool-Call-Aufwand beim Lesen.

Das entspricht konzeptionell dem Collection-Ansatz von LangMem: kleine Einträge lassen sich leichter hinzufügen, aber die Komplexität verschiebt sich auf Update, Delete, Suche und Zusammenstellung eines umfassenden Kontexts. Modelle tendieren dabei je nach Konfiguration zu Over-Inserting oder Over-Updating. ([Docs by LangChain][13])

**Eignung:** Sonderfälle mit sehr hohen Parallelitätsanforderungen oder stark strukturierten Fakten, nicht als Standard für euren Prototyp.

## Thematische Dateien mit atomaren Faktblöcken

Der sinnvollste Mittelweg ist:

- eine Datei pro stabiler Wissenskategorie,
- darin einzelne Einträge mit stabiler ID,
- zusätzliche Prozessordner,
- ein automatisch erzeugter Index.

Anthropic Managed Agents empfiehlt viele kleine, fokussierte Dateien statt weniger großer Dateien. Letta MemFS verwendet Topic-Dateien und lädt nur einen kleinen `system/`-Bereich immer. Deep Agents empfiehlt Topic-Dateien zusätzlich zur Reduktion konkurrierender Writes. ([Claude Platform][2])

## Index plus bedarfsgesteuertes Nachladen

Das stärkste dokumentierte Muster ist:

```text
kleiner Index / Manifest
        ↓
relevante Pfade und Aliase identifizieren
        ↓
grep / Dateisuche
        ↓
nur relevante Abschnitte lesen
```

Claude Code verwendet `MEMORY.md` als Index. Letta hält den vollständigen Inhalt außerhalb von `system/` aus dem dauerhaften Kontext heraus und nutzt normale Datei- und Suchwerkzeuge; ein Vektorindex ist standardmäßig nicht vorhanden. Anthropics Memory Tool ist explizit auf Just-in-time Retrieval ausgelegt. ([Claude Platform Docs][1])

`INDEX.md` sollte dabei **generiert**, nicht manuell vom Agenten gepflegt werden. Die Anwendung liest Frontmatter und erste Überschriften der Topic-Dateien und baut daraus beispielsweise:

```md
# Memory Index

- `company/glossary.md`
  Begriffe, Abkürzungen und Synonyme.
  Aliases: VN, Versicherungsnehmer, Anspruchsteller

- `company/systems.md`
  Anwendungen, Systemrollen und Schnittstellen.
  Aliases: Claimsuite, Bestandssystem, Partnerportal

- `processes/schadenaufnahme/SUMMARY.md`
  Bestätigter Kurzstand des Prozesses Schadenaufnahme.
```

So kann der Index nicht vom eigentlichen Bestand wegdriften.

## Grep-basierter Abruf

Für euren Korpus ist `ripgrep` beziehungsweise eine äquivalente Volltextsuche zunächst ausreichend, wenn jeder Fakt folgende Felder besitzt:

- kanonischer Begriff,
- Aliase und Abkürzungen,
- Scope,
- Fakt-ID,
- Status,
- verwandte Prozesse und Systeme.

Grep ist schwach, wenn Nutzer verschiedene Synonyme verwenden oder nach abstrakten Bedeutungen fragen. Das sollte zunächst nicht durch Embeddings, sondern durch eine gepflegte Alias-Schicht kompensiert werden:

```yaml
canonical: Versicherungsnehmer
aliases:
  - VN
  - Kunde
  - Antragsteller
  - Vertragspartner
```

Für „wiederkehrende Muster“ sollte der Consolidator zusätzlich normalisierte Pattern-Tags erzeugen, beispielsweise:

```yaml
pattern: manual-copy-between-systems
aliases:
  - manuelle Übertragung
  - Copy-and-Paste
  - Medienbruch
  - Doppelerfassung
```

## Wann kippen die Ansätze?

Es gibt keinen allgemein belegten Grenzwert, ab dem Markdown plus `grep` grundsätzlich nicht mehr funktioniert. Die dokumentierten Grenzen betreffen überwiegend Promptbudget oder produktspezifische Limits:

| Ebene                              | Dokumentierter Anhaltspunkt                                                                                                                                  |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Immer geladener Index              | Claude Code lädt höchstens 200 Zeilen beziehungsweise 25 KB von `MEMORY.md`.                                                                                 |
| Allgemeine `CLAUDE.md`-Anweisungen | Anthropic empfiehlt weniger als ungefähr 200 Zeilen pro Datei; Imports sparen keine Prompt-Tokens.                                                           |
| Gehostete Anthropic Memories       | 100 KB pro Memory und maximal 2.000 Memories; Empfehlung: viele fokussierte Dateien.                                                                         |
| Historisches Letta V1              | Empfehlung von weniger als 100 Dateien mit jeweils bis zu 5 MB; bei größeren Beständen externe Retrieval-Systeme. Dies gilt nicht als aktuelles MemFS-Limit. |

([Claude Platform Docs][1])

Für eure Implementierung sollten nicht Dateianzahl oder Megabytes allein den Wechsel auslösen, sondern messbare Retrieval-Probleme:

- `INDEX.md` überschreitet 25 KB.
- Der Agent benötigt regelmäßig mehr als zwei Such-/Read-Runden.
- Ein Testset aus realen Fragen findet bekannte Fakten nicht zuverlässig.
- Topic-Dateien werden bei fast jedem Update vollständig neu geschrieben.
- Parallele Konsolidierungen kollidieren häufig.
- Alias- und Keyword-Pflege wird zum dominanten Aufwand.

Erst dann ist ein **lokaler, vollständig regenerierbarer SQLite-FTS5-Index über den Markdown-Dateien** sinnvoll. Markdown bleibt dabei Source of Truth; SQLite ist nur ein abgeleiteter Keyword-/BM25-Index, keine externe Memory-Infrastruktur und keine Vektordatenbank.

---

# 4. Scoping und Prompt-Integration

## Empfohlene Scopes

| Scope                | Inhalt                                                                                        | Schreibrecht                                                                        | Prompt-/Retrieval-Verhalten                                                     |
| -------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| **Company**          | Glossar, Systeme, stabile Rollen, Organisationskonventionen, bestätigte wiederkehrende Muster | Capture-Agent read-only; Änderungen nur durch Consolidator plus Freigaberegeln      | Index immer verfügbar; Detaildateien bei Bedarf                                 |
| **Process**          | Prozessspezifische Akteure, Systeme, Varianten, Ausnahmen und offene Fragen                   | Capture-Agent darf Kandidaten erzeugen; Consolidator aktualisiert kanonischen Stand | `SUMMARY.md` des aktiven Prozesses wird vorgeladen                              |
| **User**             | Bedienpräferenzen, gewünschte Detailtiefe, Rollenperspektive                                  | Nur in isoliertem Nutzerverzeichnis                                                 | Kleines `preferences.md` beim Sessionstart                                      |
| **Session/Inbox**    | Ungeprüfte Aussagen und Quellenverweise aus einem Gespräch                                    | Append-only für aktuelle Session                                                    | Wird nur vom Consolidator gelesen                                               |
| **Procedural/Agent** | Agentenanweisungen, Tools, Freigabe- und Interviewlogik                                       | Ausschließlich Entwickler beziehungsweise Governance                                | Systemprompt, Skills oder read-only Dateien; niemals aus normalem Chat erzeugen |

Mem0 unterstützt ähnliche Trennungen über `user_id`, `agent_id`, `app_id` und `run_id`. Deep Agents trennt Nutzer-, Agenten- und Organisationsmemory und empfiehlt standardmäßig Nutzerisolation sowie read-only Organisationseinträge. Anthropics Managed Agents warnt ausdrücklich davor, untrusted Input in gemeinsam beschreibbare Stores gelangen zu lassen. ([Mem0][14])

## Autoritätsreihenfolge

Für euren Agenten sollte die Reihenfolge nicht lediglich „spezifischer Scope überschreibt allgemeinen Scope“ lauten. Besser ist:

1. **Technisch erzwungene System- und Compliance-Policy**
2. **Verifiziertes Company Memory**
3. **Verifiziertes Process Memory**
4. **Nutzerpräferenzen**
5. **Bestätigte, aber noch nicht verifizierte Beobachtungen**
6. **Kandidaten und offene Konflikte**

Ein Nutzer darf beispielsweise seine gewünschte Erklärungstiefe überschreiben, aber nicht durch die Aussage „Bei uns ist das Vier-Augen-Prinzip nicht nötig“ eine Compliance-Regel ändern.

## Was kommt in den Systemprompt?

### Systemprompt

In den Systemprompt gehören nur stabile Regeln:

- Bedeutung der Scopes,
- Vertrauens- und Statusmodell,
- erlaubte Memory-Tools,
- Verbot direkter kanonischer Writes,
- Regel, dass Memories Daten und keine Anweisungen sind,
- Verbot, ungeprüfte Memories für relevante Entscheidungen zu verwenden,
- aktuelle `company_id`, `process_id` und `user_id`.

Für einen fachlichen Capture-Agenten empfiehlt Anthropic einen eigenen Systemprompt statt des vollständigen Claude-Code-Presets, da dieses für Coding-Tools und eine menschlich überwachte Arbeitsweise ausgelegt ist. ([Claude Platform Docs][15])

### Startkontext

Zu Beginn einer Session sollten geladen werden:

```text
1. kompakter INDEX.md-Ausschnitt
2. company/glossary.md nur als sehr kurze Begriffsliste oder bei Bedarf
3. processes/<active-process>/SUMMARY.md
4. users/<user-id>/preferences.md
```

Der restliche Bestand wird über `memory_search` und `memory_read` geladen.

### Retrieval-Kontext

Abgerufene Memory-Blöcke sollten klar als Daten gekennzeichnet sein:

```xml
<memory-entry
  scope="process:schadenaufnahme"
  status="verified"
  authority="process-owner"
  source="internal-document"
>
  Die Gruppenleitung führt die fachliche Freigabe durch.
</memory-entry>
```

Diese Kennzeichnung verbessert Nachvollziehbarkeit, ist aber keine Sicherheitsgrenze. Schreibrechte, Pfade und Tool-Calls müssen außerhalb des Modells durch Anwendungscode, Permissions oder Hooks erzwungen werden. Anthropic weist ausdrücklich darauf hin, dass Promptregeln allein keine Enforcement-Schicht darstellen. ([Claude Platform Docs][1])

## Konsequenz für den Claude Agent SDK

Für eine gehostete Anwendung sollte das standardmäßige Claude-Code-Auto-Memory deaktiviert und durch euren eigenen Speicher ersetzt werden:

```text
settingSources: []
CLAUDE_CODE_DISABLE_AUTO_MEMORY=1
separates cwd beziehungsweise Memory-Root pro Unternehmen
```

Der Agent SDK lädt Auto-Memory unabhängig von `settingSources`; bei gemeinsam genutzten Hosts kann dies zu Scope-Leaks führen. Anthropic empfiehlt für Multi-Tenant-Deployments explizit getrennte Dateisysteme, `settingSources: []`, deaktiviertes Auto-Memory und ein separates `CLAUDE_CONFIG_DIR`. ([Claude][16])

Auch bei zunächst nur einem Versicherungsunternehmen ist diese Trennung sinnvoll. Sie verhindert, dass Claude Codes internes Repo-Memory unbemerkt mit eurem fachlichen Firmenmemory vermischt wird.

---

# 5. Risiken und dokumentierte Gegenmaßnahmen

## 5.1 Memory Poisoning

Eine einzelne manipulierte Memory-Schreiboperation kann zukünftige Sessions dauerhaft beeinflussen. Eine Security-Studie von Juni 2026 unterscheidet vier Schreibkanäle:

1. explizite Aufforderung zum Speichern,
2. systemprompt-gesteuertes automatisches Speichern,
3. Compaction beziehungsweise Gesprächszusammenfassung,
4. Umwandlung einer Erfahrung in eine wiederverwendbare Prozedur.

Die Studie kommt außerdem zu dem Ergebnis, dass Systeme mit aggressiverem Schreiben und Abrufen stärker angreifbar sind und klassische Prompt-Injection-Filter Memory Poisoning nicht vollständig abdecken. ([arXiv][17])

### Gegenmaßnahmen

- User- und Dokumenteninhalt darf nur Kandidaten erzeugen.
- Shared Company Memory bleibt für den Capture-Agenten read-only.
- Jeder Memory-Eintrag erhält unveränderbare Origin-Metadaten.
- Beim Retrieval wird erneut geprüft, ob ein Eintrag Anweisungen, Umleitungen oder nicht verifizierbare externe Behauptungen enthält.
- Memory darf niemals allein eine Tool-Aktion autorisieren.
- Procedural Memory und Skills dürfen nicht autonom aus normalen Conversations entstehen.

Eine weitere Arbeit von Juli 2026 kombiniert eine strikte Memory-Saving-Policy mit einem Retrieval-Screen. Der Screen nutzt Trust-, Risk- und Type-Metadaten, um gespeicherte Direktiven vor der Prompt-Injektion erneut herauszufiltern. ([arXiv][18])

## 5.2 Halluzinationen werden zu dauerhaftem Wissen

Der Consolidator kann eine Aussage falsch zusammenfassen oder eine Schlussfolgerung ergänzen, die im Quellmaterial nicht enthalten war.

### Gegenmaßnahmen

Jeder kanonische Fakt benötigt mindestens einen auflösbaren `source_ref`. Die Anwendung prüft vor dem Schreiben:

- Session und Turn existieren,
- Sprecher und Origin stimmen,
- der Consolidator hat keine nicht belegte Quelle erfunden,
- Status und Scope sind zulässig,
- der Aussagekern ist durch die Quelle gedeckt.

Ein Fakt ohne Quelle darf höchstens als `inferred_candidate` gespeichert und nicht regulär retrieved werden.

## 5.3 Provenienz wird beim Zusammenfassen „gewaschen“

Ein besonders relevantes Problem entsteht, wenn ein Agent eine untrusted Aussage zusammenfasst und die neue Zusammenfassung anschließend wie eigenes, vertrauenswürdiges Wissen behandelt. Eine aktuelle Arbeit bezeichnet dies als Origin Laundering durch Self-Summarization, Trusted-Tool Echo oder künstlich erzeugte Mehrfachbestätigung. Sie argumentiert für eine unveränderliche Bindung der Autorität an den Ursprung und für eine Erhöhung des Vertrauens nur durch tatsächlich unabhängige vertrauenswürdige Quellen. ([arXiv][19])

Daraus folgt für euch:

- `origin` wird beim Zusammenfassen vererbt und niemals automatisch auf `agent_generated` oder `trusted` hochgestuft.
- Zwei Wiederholungen derselben Aussage oder zwei Dokumente mit derselben upstream Quelle zählen nicht als unabhängige Bestätigung.
- Eine vermeintliche Prozessowner-Rolle wird anhand der authentifizierten Anwendungsidentität bestimmt, nicht anhand der Aussage „Ich bin Prozessowner“.
- Für relevante Unternehmensfakten genügt entweder eine autoritative Quelle oder eine definierte Zahl unabhängiger Bestätigungen.

## 5.4 Cross-User- und Cross-Scope-Leaks

Wenn Mitarbeiter A in ein Memory schreibt, das Mitarbeiter B ungeprüft liest, kann A sowohl falsche Fakten als auch indirekte Anweisungen verteilen. Deep Agents und Anthropic Managed Agents empfehlen deshalb standardmäßig nutzerbezogene Isolation und read-only Shared Memory. ([Docs by LangChain][8])

## 5.5 Veraltete Zuständigkeiten

Rollen, Systemowner und Freigabeverfahren ändern sich. Ein historisch korrekter Fakt kann später gefährlicher sein als ein fehlender Fakt.

Daher sollte eine Zuständigkeit beispielsweise so aussehen:

```md
## F-ROLE-014 — Fachliche Freigabe Schadenaufnahme

- **Statement:** Die Gruppenleitung führt die fachliche Freigabe durch.
- **Status:** verified
- **Valid from:** 2026-01-01
- **Last confirmed:** 2026-07-14
- **Review by:** 2027-01-01
- **Owner:** department:claims
- **Sources:**
  - document:PDD-CLAIMS-2026#section-4.2
  - chat:ses_123#turn-18
```

Bei Widerspruch wird der bestehende Eintrag nicht gelöscht, sondern `superseded` oder `conflicted`.

## 5.6 Dateisystem- und Datenschutzrisiken

Anthropics Memory-Tool-Dokumentation verlangt Pfadvalidierung, kanonische Pfadauflösung, Größenbegrenzungen und zusätzliche Filterung sensitiver Inhalte. Gerade in einer Versicherung sollte das allgemeine Firmenmemory keine Vertragsnummern, Schadenakten, Gesundheitsangaben oder vollständigen Kundenidentitäten enthalten. ([Claude Platform][3])

---

# 6. Empfohlenes leichtgewichtiges Markdown-Design

## 6.1 Verzeichnisstruktur

```text
memory/
├── INDEX.md
│
├── company/
│   ├── glossary.md
│   ├── systems.md
│   ├── roles.md
│   └── patterns.md
│
├── processes/
│   └── <process-id>/
│       ├── SUMMARY.md
│       ├── facts.md
│       ├── variants.md
│       └── open-questions.md
│
├── users/
│   └── <pseudonymous-user-id>/
│       └── preferences.md
│
├── inbox/
│   └── <yyyy-mm>/
│       └── <session-id>.md
│
├── review/
│   ├── queue.md
│   └── conflicts.md
│
└── archive/
```

### `INDEX.md`

- wird aus Frontmatter generiert,
- wird nie direkt vom Agenten editiert,
- enthält nur Pfad, Kurzbeschreibung, Scopes und Aliase,
- bleibt unter 200 Zeilen beziehungsweise 25 KB.

### `company/`

Enthält nur kuratiertes, organisationsweit brauchbares Wissen. Der Capture-Agent hat ausschließlich Leserechte.

### `processes/<process-id>/`

Enthält den konsolidierten Wissensstand zu einem Prozess. `SUMMARY.md` bleibt kompakt und kann bei aktivem Prozess vorgeladen werden. Detailwissen wird aus `facts.md`, `variants.md` und `open-questions.md` nachgeladen.

### `users/`

Enthält nur Bedien- und Kommunikationspräferenzen sowie gegebenenfalls die bekannte organisatorische Perspektive des Nutzers. Fachliche Behauptungen eines Nutzers bleiben im Prozess- oder Inbox-Scope.

### `inbox/`

Append-only Kandidaten aus der jeweiligen Conversation. Dieser Bereich wird nicht als reguläres Memory an den Capture-Agenten zurückgegeben.

## 6.2 Datei-Frontmatter

```yaml
---
schema: memory-topic/v1
scope: process:schadenaufnahme
kind: facts
authority: mixed
owner: department:claims
updated_at: 2026-08-07T16:30:00Z
review_after: 2027-02-01
allowed_writers:
  - memory-consolidator
---
```

## 6.3 Faktformat

```md
## F-PROC-CLAIMS-017 — Fachliche Freigabe

- **Statement:** Die Gruppenleitung führt die fachliche Freigabe durch.
- **Status:** verified
- **Certainty:** explicit
- **Authority:** process-owner
- **Aliases:** Freigabe, Vier-Augen-Prüfung, Gruppenleiterfreigabe
- **Valid from:** 2026-01-01
- **Last confirmed:** 2026-07-14
- **Review by:** 2027-01-01
- **Related systems:** Claimsuite
- **Related roles:** Gruppenleitung
- **Sources:**
  - `document:PDD-CLAIMS-2026#section-4.2`
  - `chat:ses_123#turn-18`
- **Supersedes:** —
```

Erlaubte Statuswerte:

```text
candidate
corroborated
verified
conflicted
superseded
rejected
```

## 6.4 Promotion-Regeln

| Memory-Typ                                                   | Automatische Promotion                                  |
| ------------------------------------------------------------ | ------------------------------------------------------- |
| Explizite, risikoarme Nutzerpräferenz                        | Direkt in isoliertes User Memory                        |
| Einmalige Prozessbeschreibung eines Mitarbeiters             | Nur `candidate`                                         |
| Aussage eines authentifizierten Prozessowners                | `corroborated` oder nach definierter Regel `verified`   |
| Aussage in freigegebener PDD/Fachkonzept/Systemdokumentation | `verified`, sofern Dokumentautorität bestätigt          |
| Unternehmensweite Rolle oder Systemzuständigkeit             | Nur autoritative Quelle oder unabhängige Bestätigung    |
| Wiederkehrendes Prozessmuster                                | Erst nach mehreren unabhängigen Prozess-/Quellenbelegen |
| Agentenanweisung, Skill oder ausführbare Prozedur            | Niemals automatisch                                     |
| Widerspruch zu bestehendem Wissen                            | `conflicted`; keine automatische Überschreibung         |

## 6.5 Tooloberfläche

Der Capture-Agent erhält:

```text
memory_search(query, scopes, statuses, limit)
memory_read(path, fact_ids | line_range)
memory_propose(scope, statement, source_ref, certainty, aliases)
```

Der Consolidator erhält zusätzlich:

```text
memory_diff(session_id)
memory_apply(expected_git_head, validated_actions)
```

`memory_apply` sollte technisch nicht vom Modell selbst implementiert werden. Die Anwendung:

1. validiert Schema und Quellen,
2. prüft Scope und Schreibrechte,
3. prüft PII-Regeln,
4. sperrt beziehungsweise vergleicht den aktuellen Git-Head,
5. schreibt atomar,
6. regeneriert `INDEX.md`,
7. erstellt einen Git-Commit,
8. aktualisiert Review- und Konfliktqueues.

## 6.6 Retrieval-Ablauf des Capture-Agenten

Bei Beginn eines Gesprächs:

```text
1. INDEX.md laden
2. Nutzerpräferenzen laden
3. bei bekanntem Prozess dessen SUMMARY.md laden
```

Bei Nennung eines Begriffs, Systems oder einer Rolle:

```text
1. memory_search über Company + aktiven Process Scope
2. relevante Faktblöcke lesen
3. Status und Quellen berücksichtigen
4. bestätigte Fakten verwenden
5. Konflikte oder Kandidaten als Unsicherheit behandeln
```

Vor einer Rückfrage sollte der Agent prüfen, ob die Antwort bereits im Memory liegt. Gleichzeitig darf er unbekannte Details nicht aus verwandten Prozessen extrapolieren.

## 6.7 Konsolidierungsrhythmus

| Trigger                                         | Lauf                                                               |
| ----------------------------------------------- | ------------------------------------------------------------------ |
| Gespräch erfolgreich abgeschlossen              | Kandidaten extrahieren und gegen kanonischen Bestand konsolidieren |
| Nutzer korrigiert explizit eine frühere Aussage | Sofortiger Kandidat mit hoher Priorität                            |
| 10–50 neue Conversations oder täglicher Lauf    | Duplikate, Review-Daten und Dateigrößen prüfen                     |
| Wöchentlicher Lauf                              | Konfliktqueue, veraltete Zuständigkeiten und Pattern-Promotion     |
| `INDEX.md` nähert sich 25 KB                    | Taxonomie oder Verzeichnisstruktur überarbeiten                    |
| Retrieval-Evaluierung fällt unter Zielwert      | Aliasmodell verbessern; anschließend optional SQLite FTS5 ergänzen |

---

# Schlussfolgerung

Für euren Prototyp ist **kein Mem0-, LangMem- oder Letta-Server erforderlich**. Die leichteste tragfähige Architektur ist:

```text
Markdown als Source of Truth
+ kleiner generierter Index
+ thematische Dateien
+ ripgrep-basierter Abruf
+ append-only Session-Inbox
+ ereignisgetriebener Consolidator
+ Status und Provenienz pro Fakt
+ Git-Versionierung
+ read-only Company Memory
```

Claude Codes `MEMORY.md` liefert das beste Vorbild für **Index plus Topic-Dateien**. Letta MemFS liefert das beste Vorbild für **Git-Versionierung, On-demand Loading, Dreaming und Memory Doctor**. Mem0 und LangMem liefern die nützlichsten Muster für **Confidence, Update statt Duplikat, Ablauf, Scoping und getrennte Background Consolidation**. Anthropics Managed Agents und die neuere Security-Forschung zeigen, warum unternehmensweite Memories standardmäßig read-only sein und ungeprüfte Inhalte niemals unmittelbar autoritativ werden sollten. ([Claude Platform Docs][1])

Der wichtigste Architekturentscheid ist damit nicht „Markdown oder Datenbank“, sondern die Trennung zwischen:

```text
Beobachtung → Kandidat → konsolidierter Fakt → verifiziertes Firmenwissen
```

Ohne diese Stufen wird auch ein kleiner Markdown-Ordner schnell zu einer Mischung aus Gesprächsfragmenten, Halluzinationen und veralteten Zuständigkeiten. Mit ihnen bleibt er für euren Department-/Prototyp-Scope leichtgewichtig, nachvollziehbar und ohne zusätzliche Memory-Infrastruktur betreibbar.

[1]: https://docs.anthropic.com/en/docs/claude-code/memory "https://docs.anthropic.com/en/docs/claude-code/memory"
[2]: https://platform.claude.com/docs/en/managed-agents/memory "https://platform.claude.com/docs/en/managed-agents/memory"
[3]: https://console.anthropic.com/docs/en/agents-and-tools/tool-use/memory-tool "https://console.anthropic.com/docs/en/agents-and-tools/tool-use/memory-tool"
[4]: https://docs.letta.com/concepts/memfs "https://docs.letta.com/concepts/memfs"
[5]: https://docs.letta.com/v1-sdk/ "https://docs.letta.com/v1-sdk/"
[6]: https://docs.mem0.ai/open-source/overview "https://docs.mem0.ai/open-source/overview"
[7]: https://langchain-ai.github.io/langmem/concepts/conceptual_guide/ "https://langchain-ai.github.io/langmem/concepts/conceptual_guide/"
[8]: https://docs.langchain.com/oss/python/deepagents/memory "https://docs.langchain.com/oss/python/deepagents/memory"
[9]: https://docs.letta.com/configuration/memory/ "https://docs.letta.com/configuration/memory/"
[10]: https://langchain-ai.github.io/langmem/guides/delayed_processing/ "https://langchain-ai.github.io/langmem/guides/delayed_processing/"
[11]: https://docs.mem0.ai/cookbooks/essentials/controlling-memory-ingestion "https://docs.mem0.ai/cookbooks/essentials/controlling-memory-ingestion"
[12]: https://docs.mem0.ai/platform/features/memory-expiration "https://docs.mem0.ai/platform/features/memory-expiration"
[13]: https://docs.langchain.com/oss/python/concepts/memory "https://docs.langchain.com/oss/python/concepts/memory"
[14]: https://docs.mem0.ai/platform/features/entity-scoped-memory "https://docs.mem0.ai/platform/features/entity-scoped-memory"
[15]: https://docs.anthropic.com/fr/docs/claude-code/sdk/modifying-system-prompts "https://docs.anthropic.com/fr/docs/claude-code/sdk/modifying-system-prompts"
[16]: https://code.claude.com/docs/en/agent-sdk/claude-code-features "Use Claude Code features in the SDK - Claude Code Docs"
[17]: https://arxiv.org/html/2606.04329v1 "https://arxiv.org/html/2606.04329v1"
[18]: https://arxiv.org/html/2607.06595v1 "When Agents Remember Too Much: Memory Poisoning Attacks on Large Language Model Agents"
[19]: https://arxiv.org/html/2606.24322 "Securing LLM-Agent Long-Term Memory Against Poisoning: Non-Malleable, Origin-Bound Authority with Machine-Checked Guarantees"
