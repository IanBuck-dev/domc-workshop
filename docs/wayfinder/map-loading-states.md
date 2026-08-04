# Map: Ladezustände und Navigationsgefühl

`wayfinder:map` — Tickets liegen als Kindtickets in `docs/wayfinder/tickets/`.

Dieser Tracker ist lokales Markdown (kein Tracker konfiguriert, also der Standard).
Blockierung gibt es hier nicht nativ, deshalb die Konvention `Blockiert von:` im
Ticketkopf. Die Frontier — das, was jetzt genommen werden kann — sind alle offenen,
unblockierten, nicht beanspruchten Tickets. `Bearbeiter:` im Ticketkopf ist der Anspruch:
ein offenes Ticket ohne Bearbeiter ist frei.

**Status: am Ziel.** Alle sechs Tickets sind geschlossen, die Frontier ist leer, der Nebel
gelichtet. `./scripts/qa all` grün, im Browser bei künstlich verzögerten Antworten (9 s je
`/api/`-Anfrage) gegengeprüft: Prozessdetail, Chat und Einstellungen zeichnen ihre Hülle
sofort und legen das Skelett lagerichtig unter den späteren Inhalt — kein Layoutsprung beim
Umschalten. `app-loading` und rohes `LoaderCircle` kommen im Code nicht mehr vor.

## Destination

Jeder Ladezustand der Web-Oberfläche nutzt einen richtigen shadcn-Loader, und jeder Klick
erzeugt sofort eine sichtbare Reaktion — keine Route blockiert mehr auf Daten, bevor sie
irgendetwas zeichnet. Die Anwendung wird dabei tatsächlich geändert, nicht nur spezifiziert.

## Notes

- **Diese Karte führt Ausführung mit.** Wayfinder plant sonst nur; hier ist das Ziel der
  geänderte Zustand der Anwendung, also liefern Tickets Code, nicht nur Entscheidungen.
- Domäne: deutschsprachige Oberfläche eines Prototyps zur Prozessaufnahme. Alle
  Nutzertexte auf Deutsch. Vite + React + react-router-dom 7 (deklarativ, **kein**
  Data-Router — es gibt keine `loader()`/`defer`/`Await`), Tailwind v4, shadcn/ui New York.
- **`components/ui/` ist für shadcn-Primitive reserviert** und bleibt auf Stock-Tailwind,
  damit `shadcn add` ein sauberes Upgrade bleibt. Eigene Bausteine gehören daneben, nicht
  hinein. Ebenso gilt die semantische Typo-Skala aus `styles.css` (`text-ui`, `text-label`,
  …) — keine rohen `text-sm`/`font-*`-Kombinationen in neuen Komponenten.
- Kein Dark Mode. Elevation über Rahmen, nicht Schatten.
- Vor jedem Abschluss `./scripts/qa all` (Format, Lint, Typecheck, Test, Build).
- Visuell im Browser bei echter Größe prüfen, bevor eine Ladezustandsänderung als richtig
  gilt — Ladezustände sind genau die Zustände, die man im Code nicht sieht. Ladezeiten im
  Netzwerk-Throttling nachstellen, sonst blitzen sie nur.

### Ausgangsbefund

Vollständige Bestandsaufnahme vom 3. Aug 2026, Grundlage aller Tickets:

- Drei Routen brechen früh ab mit `<main className="app-loading">…</main>` —
  `app.tsx:44`, `process-detail-page.tsx:65`, `process-chat-page.tsx:401`. **Die Klasse
  `app-loading` ist nirgends definiert**, weder in `styles.css` noch sonst wo. Das ist der
  ungestylte Text oben links, der den Anstoß gab.
- Drei parallele Konventionen nebeneinander: `<Spinner>` (1 Aufruf), rohes `LoaderCircle`
  aus lucide (7 Aufrufe), und blanker Text (viele).
- `ProcessListTableSkeleton` in `process-list-table.tsx:169` ist die **einzige** Route mit
  einem echten Skeleton — und das Vorbild für den Rest.
- `ui/spinner.tsx:11` trägt `aria-label="Loading"`, die einzige englische Zeichenkette der
  Oberfläche.
- Kein Caching, kein Dedupe: jede Seite hält eigenes `useState` + `useEffect`.
  `api.process(id)` wird von drei Seiten unabhängig geholt.

## Decisions so far

<!-- Index: eine Zeile je geschlossenem Ticket, Detail liegt im Ticket selbst -->

- [Ladevokabular](tickets/001-ladevokabular.md) — drei Stufen: Skelett für alles mit
  bekanntem Layout (Routen bekommen **nie** einen Spinner), `<Spinner>` für formlose
  Wartezustände in einer stehenden Fläche, gar nichts für Hintergrundnachläufe. Skelette
  wohnen als `<Name>Skeleton` neben ihrer Komponente. Das Skelett der Zielseite ist die
  Antwort auf den Klick — keine Pending-Zustände auf Links.
- [Chat-Nachladeschleife](tickets/006-chat-nachladeschleife.md) — nicht die Anzahl der
  Auslöser ist das Problem, sondern ihre Überlappung. `reloadView` bekommt eine Schleuse
  (ein Lauf gleichzeitig, ein Nachlauf danach). `api.chat(id)` bleibt ungeteilt.
- [Skelette für Prozessdetail und Chat](tickets/002-skelette-detail-und-chat.md) — beide
  Routen zeichnen sofort. Das `Promise.all` der Detailseite ist in zwei unabhängige Läufe
  getrennt; die Chatseite baut ihre Hülle synchron auf, weil `useDesktop()` die Breite vor
  den Daten kennt.
- [Skelette für die übrigen Routen und Dialoge](tickets/003-skelette-restliche-routen.md) —
  Lade- und Fehlerzustand sind überall getrennt, wo sie sich einen Zweig teilten. In der
  Potenzialanalyse blieb ein Spinner stehen (die Zahl der Schrittanalysen steht vorher nicht
  fest), die drei Szenarien bekamen ein Skelett (ihre Form steht fest).
- [Wartezustände auf Schaltflächen](tickets/004-schaltflaechen.md) — `<Spinner>` an der
  Stelle des Ruhe-Icons, `disabled` plus `aria-busy`, keine fixierte Breite. Rohes
  `LoaderCircle` ist aus der App verschwunden.
- [Erster Bildaufbau](tickets/005-erster-bildaufbau.md) — kein Markup in `index.html`, nur
  die Hintergrundfarbe. Die Anmeldeprüfung bleibt blockierend, bekommt aber eine ruhige
  Markenfläche (`app-boot-screen.tsx`) statt ungestyltem Text — ohne Spinner, mit einer
  verzögerten Einblendung, damit der Normalfall unsichtbar bleibt.

## Not yet specified

_Leer — der Nebel ist gelichtet, alle Fragen liegen als Ticket vor._

Die drei zuvor hier verzeichneten Punkte sind beantwortet: die **regionalen Ladezustände im
Chat-Arbeitsbereich** fallen unter dieselbe Vokabularregel wie alles andere und sind in
[Skelette übrige Routen](tickets/003-skelette-restliche-routen.md) aufgenommen; der
**SSE-Kanal** bekommt bewusst keine Ladeanzeige (Stufe 3); **„sofort"** wird im Browser mit
Netzwerk-Throttling per Auge geprüft, nicht gemessen — nach den Skeletten wartet keine Route
mehr auf Daten, bevor sie zeichnet, damit ist nichts mehr da, was eine Messung klären würde.

## Out of scope

- **Jede Form von Caching, Dedupe oder Prefetching** — react-query, SWR oder eine
  handgebaute Cache-Schicht in `api-client.ts`. Bewusst ausgeschlossen: die API ist
  minimal und schnell, das hier ist ein Prototyp. „Sofort" wird über sofortiges Zeichnen
  erreicht, nicht über vorgehaltene Daten. Kehrt nur zurück, wenn sich das Ziel ändert.
- **Route-Level Code-Splitting**, `React.lazy`, `<Suspense>`. Alle 11 Seiten werden
  statisch importiert. Splitting würde neue Ladezustände erzeugen und das Problem eher
  vergrößern als verkleinern.
