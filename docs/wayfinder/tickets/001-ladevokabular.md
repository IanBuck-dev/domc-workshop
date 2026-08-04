# Ladevokabular und gemeinsame Bausteine

Karte: [Ladezustände und Navigationsgefühl](../map-loading-states.md)
Typ: `wayfinder:grilling` (HITL)
Blockiert von: —
Bearbeiter: Claude
Status: geschlossen

## Question

Welche Regel entscheidet, welcher Loader wo erscheint — und welche gemeinsamen Bausteine
benutzen die Seiten-Skelette, damit nicht elf Stück unabhängig voneinander entstehen?

Zu klären:

1. **Skeleton, Spinner oder gar nichts.** Es ist entschieden, dass Routen Seiten-Skelette
   bekommen. Offen bleibt die Grenze: ab welcher erwarteten Dauer lohnt ein sichtbarer
   Zustand überhaupt, was bekommt ein Skeleton, was einen Spinner, und wo ist der beste
   Ladezustand gar keiner (weil ein Blitzen schlimmer ist als eine kurze Stille).
2. **Die drei konkurrierenden Konventionen zusammenführen.** Heute existieren
   nebeneinander: `<Spinner>` aus `ui/spinner.tsx` (genau ein Aufruf,
   `process-chat-transcript.tsx:207`), rohes `LoaderCircle` aus lucide an sieben Stellen
   (`document-attachment-list.tsx:157`, `process-delete-dialog.tsx:69`,
   `ai-operation-queue.tsx:23`, `process-detail-page.tsx:196`,
   `opportunity-discovery-page.tsx:184` und `:235`, `process-capture-page.tsx:488`) und
   blanker Text an vielen. Welche gewinnt, und wird die Regel erzwingbar gemacht?
3. **Wo die Skelett-Bausteine wohnen.** `components/ui/` ist für shadcn-Primitive
   reserviert, ein eigener `PageSkeleton` gehört also nicht hinein.
   `ProcessListTableSkeleton` (`process-list-table.tsx:169`) ist der einzige bestehende
   Präzedenzfall und liegt neben seiner Komponente — gilt das als Muster (Skelett neben
   der Komponente, die es nachbildet) oder braucht es einen gemeinsamen Ort?
4. **Wie eine laufende Navigation aussieht.** Ohne Cache — bewusst, siehe Out of scope der
   Karte — hat jede Navigation eine echte Wartezeit. Reicht das Skelett der Zielseite als
   Antwort auf den Klick, oder braucht der Klick zusätzlich eine sofortige Rückmeldung am
   Auslöser?
5. **Ein Detail nebenbei:** `ui/spinner.tsx:11` trägt `aria-label="Loading"` — die einzige
   englische Zeichenkette der Oberfläche. Sie gehört übersetzt, aber `components/ui/` soll
   gegenüber `shadcn add` sauber bleiben. Wie löst man das, ohne die Grenze aufzuweichen?

Das Ergebnis ist eine niedergeschriebene Konvention plus die gemeinsamen Bausteine im
Code. Jedes andere Ticket dieser Karte hängt daran.

## Resolution

Drei Stufen, mehr nicht. Die Wahl richtet sich danach, ob die Form des Ergebnisses schon
feststeht — nicht nach der erwarteten Dauer.

**Stufe 1 — Skelett (`<Skeleton>` aus `ui/skeleton.tsx`).** Für jede Fläche, deren Layout
schon bekannt ist, bevor die Daten da sind: ganze Routen, Karten, Tabellen, Listen. Eine
Route bekommt **nie** einen Spinner in der Mitte. Das Skelett bildet das echte Layout nach,
nicht ein generisches Rechteck.

**Stufe 2 — Spinner (`<Spinner>` aus `ui/spinner.tsx`).** Für Wartezustände _innerhalb_
einer bereits gezeichneten Fläche, deren Ergebnis keine Form hat: Schaltflächen, Anhänge in
Arbeit, laufende Operationen. Rohes `LoaderCircle` aus lucide verschwindet an allen sieben
Stellen; `<Spinner>` gewinnt.

**Stufe 3 — gar nichts.** Für Nachladevorgänge im Hintergrund auf einer stehenden Seite
(SSE-getriebene Aktualisierungen). Ein Zustand, der bei jedem Stream-Ereignis aufblitzt, ist
schlechter als keiner. Siehe [Chat-Nachladeschleife](006-chat-nachladeschleife.md).

**Bausteine wohnen neben ihrer Komponente.** `ProcessListTableSkeleton` ist das Muster: das
Skelett wird aus derselben Datei exportiert wie das Original, benannt `<Name>Skeleton`. Kein
zentraler `skeletons/`-Ordner — er würde garantiert vom Original abdriften. `components/ui/`
bleibt unberührt.

**Hülle jedes Skeletts**, ebenfalls von `ProcessListTableSkeleton` übernommen:

```tsx
<div role="status" aria-busy="true" aria-label="… wird geladen">
  <span className="sr-only">… wird geladen</span>…
</div>
```

**Navigation.** Das Skelett der Zielseite ist die Antwort auf den Klick — es genügt, weil es
sofort erscheint. Keine zusätzliche Rückmeldung am Auslöser, keine Pending-Zustände auf
Links. Bedingung: die Route darf nicht mehr auf Daten warten, bevor sie irgendetwas
zeichnet. Was ohne Daten schon feststeht — Kopfbereich, Zurück-Link, Spaltenraster —
zeichnet sich sofort; nur die datenabhängigen Flächen sind Skelett.

**Wartende Schaltfläche**, einheitlich: `<Spinner />` an der Stelle des Ruhe-Icons, deutscher
Wartetext, `disabled`, `aria-busy="true"`. Die Breite wird **nicht** künstlich fixiert — der
längere deutsche Wartetext darf die Schaltfläche wachsen lassen, das ist ehrlicher als eine
Mindestbreite, die im Ruhezustand Luft lässt. Das Icon darf nur nicht ersatzlos verschwinden.

**Zum `aria-label="Loading"`:** Der Vorgabewert in `ui/spinner.tsx` wird auf
`"Wird geladen"` geändert — eine Zeile, mit Kommentar als bewusste, einzige Abweichung vom
shadcn-Stand markiert. Die Alternative (an jedem Aufrufer ein `aria-label` mitgeben) verteilt
dieselbe Zeichenkette über ein Dutzend Dateien und wird beim nächsten Aufrufer vergessen. Die
Grenze zu `components/ui/` gilt der **Gestaltung** — Stock-Tailwind, kein Typo-Scale, keine
eigenen Varianten —, nicht der Sprache einer Vorgabe.
