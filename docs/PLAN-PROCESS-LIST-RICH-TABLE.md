# Implementierungsplan: Prozessübersicht als filterbare Tabelle

## Ziel

Die Route `/` zeigt Prozessaufnahmen als kompakte, clientseitig filter- und
sortierbare Tabelle. Sie ersetzt die Kartenliste vollständig. Die Tabelle
zeigt nur Prozess, Fachbereich und einen abgeleiteten Gesamtstatus. Dieser
Status beschreibt den vollständigen Arbeitsstand aus Prozessaufnahme und
Potenzialanalyse.

## Feste Entscheidungen

- Die sichtbaren Spalten sind exakt `Prozess`, `Fachbereich` und `Status`.
  `Prozess-ID`, Zeitpunkt der letzten Änderung und ein abgeleiteter nächster
  Schritt werden nicht angezeigt.
- Jede Spalte ist sortierbar. Der erste Klick sortiert absteigend, der zweite
  aufsteigend, der dritte hebt die explizite Sortierung auf. Shift-Klick ergänzt
  eine weitere Sortierspalte.
- Initial ist keine Sortierung aktiv. Jede Spalte durchläuft bei wiederholtem
  Klick exakt `keine Sortierung` → `absteigend` → `aufsteigend` → `keine
Sortierung`. Shift-Klick ergänzt oder ändert eine weitere Sortierspalte.
- Die ganze Tabellenzeile öffnet `/processes/:id`; ein rechter Chevron ist nur
  ein visuelles Navigationssignal und kein separater Klickbereich.
- Suche und Filter laufen ausschließlich auf den bereits geladenen
  Prozess- und Potenzialübersichten. Es gibt keine neue Serverroute,
  Paginierung oder persistierte Benutzerpräferenz.
- Die Filterleiste enthält Freitextsuche, Mehrfachfilter für Fachbereich und
  Gesamtstatus sowie `Filter zurücksetzen`. Sie zeigt die Anzahl der gefilterten
  Ergebnisse.
- Die Tabelle bleibt auf 768 px nutzbar: Sie erhält einen horizontalen
  Scroll-Container, behält aber alle drei Spalten und ihre Kopfzeilen bei.

## Gesamtstatus

`apps/web/src/lib/process-list-model.ts` leitet einen `ProcessListStatus` aus
`ProcessCaptureRecord` und der optionalen `OpportunityDiscoverySummary` ab.
Der Status enthält `id`, deutsches `label`, `priority` und `tone` für das Badge.
Die Priorität ist zugleich die Standardsortierung.

| Priorität | ID                        | Label                       | Bedingung                                                                                                        |
| --------: | ------------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------- |
|        10 | `needs_review`            | Prüfung erforderlich        | Prozesszustand `review_required`                                                                                 |
|        20 | `needs_input`             | Angaben ergänzen            | Prozesszustand `follow_up_required`                                                                              |
|        30 | `analysis_needs_review`   | Potenzialanalyse prüfen     | Analyse ist fehlgeschlagen oder `isStale`                                                                        |
|        40 | `draft`                   | Entwurf                     | `capture_in_progress` und noch keine beantwortete Themenfrage, Arbeitsmerkmal-Auswahl oder ausgewählte Unterlage |
|        50 | `capturing`               | In Erfassung                | `capture_in_progress` mit begonnenen Erfassungsdaten                                                             |
|        60 | `ready_for_process_image` | Prozessbild erstellen       | Prozesszustand `synthesis_ready`                                                                                 |
|        70 | `ready_for_analysis`      | Bereit für Potenzialanalyse | Prozess bestätigt, Profilversion 2 und noch keine Analyse                                                        |
|        80 | `analysis_running`        | Potenzialanalyse läuft      | Analysezustand `hypotheses_queued`, `hypotheses_running` oder `scenarios_running`                                |
|        90 | `completed`               | Abgeschlossen               | bestätigter Prozess mit beendeter Analyse (`completed` oder `no_supported_hypotheses`)                           |
|       100 | `process_confirmed`       | Prozess abgeschlossen       | bestätigter Prozess ohne verfügbare Potenzialanalyse (Profilversion 1)                                           |

Ein nicht bestätigter Prozess gewinnt immer gegenüber einer eventuell
vorhandenen, technisch inkonsistenten Analyseübersicht. Bei bestätigten
Prozessen haben veraltete oder fehlgeschlagene Analysen Vorrang vor allen
anderen Analysezuständen.

## Umsetzung

### 1. Tabellen- und Filterabhängigkeiten ergänzen

**Zu ändern**

- `package.json`
- `bun.lock`

**Neu zu erzeugen über shadcn**

- `apps/web/src/components/ui/table.tsx`
- `apps/web/src/components/ui/popover.tsx`
- `apps/web/src/components/ui/command.tsx`

`@tanstack/react-table` wird als Laufzeitabhängigkeit ergänzt. Die shadcn
Primitives werden ohne eigene Designschicht übernommen und verwenden die
vorhandenen Tailwind-Farbtokens. `Input`, `Button`, `Badge` und
`DropdownMenu` existieren bereits und werden weiterverwendet.

### 2. Testbares Listenmodell einführen

**Neue Datei**

- `apps/web/src/lib/process-list-model.ts`

**Zu ändern**

- `apps/web/src/lib/process-navigation-model.ts`
- `tests/process-navigation-model.test.ts`
- `tests/process-list-model.test.ts`

`process-list-model.ts` exportiert:

```ts
export type ProcessListStatusId = /* die zehn IDs aus der Tabelle */;
export interface ProcessListStatus {
  id: ProcessListStatusId;
  label: string;
  priority: number;
  tone: "neutral" | "info" | "success" | "warning" | "danger";
}
export function processListStatus(
  process: ProcessCaptureRecord,
  opportunity?: OpportunityDiscoverySummary,
): ProcessListStatus;
export function processListSearchText(process: ProcessCaptureRecord): string;
```

`processNavigationModel` behält nur die Detailseiten-Zustände `capture` und
`opportunity`. Die bisherigen Felder `listStatus` und `listTone` werden
entfernt, damit es keine zweite, abweichende Listenstatuslogik gibt.

Die Tests decken jede Prozess- und Analysezustandskombination, die Entwurf-
Abgrenzung, die Vorrangregeln sowie deutsche Suche über Prozessname,
Fachbereich und ID ab.

### 3. Rich-Table-Komponente bauen

**Neue Datei**

- `apps/web/src/components/process-list-table.tsx`

**Zu ändern**

- `apps/web/src/pages/process-list-page.tsx`

`ProcessListPage` behält Laden, Fehlermeldung, Leerzustand und den CTA
`Prozess erfassen`. Sie übergibt Datensätze und Potenzialübersichten an
`ProcessListTable` und enthält keinen Karten- oder Navigation-Code mehr.

`ProcessListTable` erstellt pro Prozess eine Tabellenzeile mit:

- `processName`: sichtbarer Name; Prozess-ID ausschließlich im Suchwert;
- `department`: sichtbarer Fachbereich;
- `status`: das Ergebnis von `processListStatus` als zugängliches Badge.

TanStack Table erhält diese Regeln:

- `getCoreRowModel`, `getFilteredRowModel` und `getSortedRowModel`;
- globale Suche über den normalisierten Suchtext;
- facettierte Mehrfachfilter `department` und `status`;
- `status`-Sortierung per numerischer `priority`, bei Gleichstand
  Prozessname; alle anderen Spalten sortieren nach deutschem Textvergleich;
- initialer Zustand `sorting: []`; ein expliziter Klick startet mit
  absteigender Sortierung und durchläuft den festgelegten Dreizustandszyklus;
- eine `aria-sort`-konforme Kopfzeile mit Button, Richtungssymbol und
  sprechendem `aria-label` für jede Spalte.

Die Tabelle liegt in einem `overflow-x-auto`-Container und hat eine feste
Mindestbreite. Zeilen erhalten `tabIndex={0}`, Enter/Leertaste-Navigation,
sichtbaren Fokus und die gleiche Navigation wie ein Mausklick. Ein Link wird
innerhalb der ersten Zelle gerendert, damit die Navigation semantisch und ohne
JavaScript erreichbar bleibt; keine verschachtelten interaktiven Elemente.

### 4. Filterleiste und Zustände gestalten

**Zu ändern**

- `apps/web/src/components/process-list-table.tsx`
- `apps/web/src/pages/process-list-page.tsx`

Oberhalb der Tabelle erscheinen in einer Zeile, auf schmaleren Breiten
umbruchfähig:

1. Suchfeld `Prozesse durchsuchen` mit Such-Icon;
2. Popover `Fachbereich` mit `Command`-Suche, Checkboxen, Auswahlzähler und
   `Alle Fachbereiche` zum Leeren;
3. Popover `Status` mit Checkboxen, Auswahlzähler und `Alle Status` zum
   Leeren;
4. Button `Filter zurücksetzen`, nur aktiv, wenn Suche oder Filter gesetzt
   sind;
5. Text `x von y Prozessen`.

Ein leeres Gesamtergebnis bleibt der bestehende Erfassungs-CTA. Ein leeres
Filterergebnis zeigt keinen Card-Container, sondern eine kompakte Tabellen-
Leerzeile mit `Keine Prozesse gefunden` und `Filter zurücksetzen`.

## Akzeptanzkriterien

1. Die Startseite zeigt bei vorhandenen Daten keine Prozesskarten, keine
   Aktualisierungszeit und keinen Text `Nächster Schritt`.
2. Jede sichtbare Zeile enthält genau Prozessname, Fachbereich,
   Gesamtstatus und Chevron; die gesamte Zeile führt zur Detailseite.
3. Alle zehn Gesamtstatus sind durch Unit-Tests abgedeckt und besitzen einen
   eindeutigen deutschen Namen, eine Priorität und eine Badge-Darstellung.
4. Ohne manuelle Sortierung ist keine Spalte aktiv sortiert. Beim expliziten
   Statussortieren wird die fachliche Priorität verwendet, bei Gleichstand
   Prozessname.
5. Jeder Spaltenkopf durchläuft `keine Sortierung` → `absteigend` →
   `aufsteigend` → `keine Sortierung`; Shift-Klick erzeugt eine
   Mehrspaltensortierung.
6. Suche findet Prozessname, Fachbereich und unsichtbare Prozess-ID;
   Fachbereich- und Statusfilter lassen Mehrfachauswahlen zu und wirken
   zusammen mit der Suche.
7. `Filter zurücksetzen` stellt Suche, Filter und den unsortierten
   Ausgangszustand wieder her.
8. Bei 1440 px und 768 px gibt es keine überlappenden Bedienelemente,
   Console-Fehler oder fehlgeschlagenen Requests; alle Filter, Sortierungen
   und Zeilen sind per Tastatur bedienbar.

## Verifikation

**Neue oder angepasste Tests**

- `tests/process-list-model.test.ts`
- `tests/process-navigation-model.test.ts`
- `tests/process-list-ui.test.ts`

**Testfälle**

1. Statusableitung und Priorität für jede Zeile der Statustabelle;
2. unsortierter Ausgangszustand, Dreizustandszyklus je Spalte und
   Mehrspaltensortierung;
3. Suche über Name, Fachbereich und ID;
4. kombinierte Mehrfachfilter und Reset;
5. Tabelle, Filterbeschriftungen, Status-Badges und Detail-Links im
   serverseitigen UI-Test.

**Abschlussbefehle**

```zsh
./scripts/qa test tests/process-list-model.test.ts
./scripts/qa test tests/process-list-ui.test.ts
./scripts/qa all
bun run build
```

Vor dem Handoff wird die Startseite außerdem in Chrome DevTools bei 1440 px
und 768 px geprüft: Such- und Filterkombination, jede Sortierrichtung,
Tastaturfokus, Detailnavigation sowie gefilterter Leerzustand.
