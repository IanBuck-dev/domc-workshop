# Recherche: Layout-Engine für verzweigte Flussdiagramme in React Flow

Stand: 2026-08-07 · Ticket #4 · Bezugspunkt im Code:
`apps/web/src/components/process-flow-diagram.tsx` (read-only React Flow, feste Positionen
`{x: 80, y: index * 240}`, Karten `w-80` = 320 px breit mit variabler Höhe).

## Fragestellung

Sobald das Prozessbild Verzweigungen und Rücksprünge (Schleifen) enthält, trägt die heutige
Handpositionierung („eine Spalte, 240 px Raster") nicht mehr. Welche Engine berechnet dann die
Knotenpositionen — dagre, elkjs, d3-dag oder weiterhin Handarbeit?

## Kandidaten im Vergleich

| Kriterium | @dagrejs/dagre | elkjs | d3-dag | Handarbeit (heute) |
|---|---|---|---|---|
| Vertikaler Fluss | Ja, `rankdir: 'TB'` | Ja, `elk.direction: DOWN` | Ja (Sugiyama, top-down) | Ja (trivial) |
| Verzweigungen | Ja (Layered/Sugiyama) | Ja | Ja | Nein — genau die Lücke |
| Zyklen / Rücksprung-Kanten | Ja: interne Zyklenauflösung (`lib/acyclic.ts`, `lib/greedy-fas.ts` im Repo) | Ja (Layered-Algorithmus mit Cycle Breaking) | **Nein** — laut Doku ausdrücklich nur „directed **acyclic** graphs" | Nur manuell |
| Kantenführung (Routing) | Nein — liefert nur Stützpunkte; React-Flow-Doku: „No edge routing" | Ja, u. a. orthogonales Routing | Nein (Punkte, kein Routing um Knoten) | Manuell |
| Stabilität bei Revisions-Updates | Deterministisch bei gleicher Eingabe; kein inkrementeller Modus | Deterministisch; zusätzlich `elk.layered.considerModelOrder` („Preserves the order of nodes and edges in the model file …") | Deterministisch; kein inkrementeller Modus | Perfekt stabil |
| Variable Knotenhöhen | Ja, aber Maße müssen **vorab** übergeben werden (Zwei-Pass nötig) | Ja, gleiches Zwei-Pass-Muster | Ja („Every node needs a positive width and height") | Implizit gelöst (240-px-Raster) |
| Bundle (min / gzip, bundlephobia) | **46,3 kB / 15,6 kB** (v3.1.0) | **1 451 kB / 433 kB** (v0.12.0) | 135,8 kB / 41,9 kB (v1.2.2) | 0 |
| Wartung (npm-Registry, Aug 2026) | Aktiv: v3.1.0 vom 2026-08-02; TypeScript-Rewrite (Quellcode ist `.ts`); ~170 offene Issues | Aktiv: v0.12.0 vom 2026-07-17; ~90 offene Issues; GWT-Transpilat des Java-Projekts Eclipse ELK | Aktiv, kleine Basis: v1.2.2 vom 2026-07-05; 3 offene Issues; Ein-Personen-Projekt | — |
| TypeScript | Nativ (Quellcode TS seit v2/v3) | Separate Typings im Paket | „TypeScript-first", generische Operatoren | — |
| Einschätzung der React-Flow-Doku | „If you need to organize your flows into a tree, we highly recommend dagre." | „we don't often recommend elkjs because it's complexity makes it difficult for us to support folks" | Nicht als Hauptempfehlung geführt | Als „static layouting" beschrieben, das bei Strukturänderungen nicht mitwächst |

Quellen: [React-Flow-Layouting-Guide](https://reactflow.dev/learn/layouting/layouting) ·
[dagrejs/dagre](https://github.com/dagrejs/dagre) (Quellbaum `lib/acyclic.ts`, `lib/greedy-fas.ts`) ·
[kieler/elkjs](https://github.com/kieler/elkjs) ·
[erikbrinkman/d3-dag](https://github.com/erikbrinkman/d3-dag) ·
[ELK-Option `considerModelOrder`](https://eclipse.dev/elk/reference/options/org-eclipse-elk-layered-considerModelOrder-strategy.html) ·
[React-Flow-Dagre-Beispiel](https://reactflow.dev/examples/layout/dagre) ·
Bundle-Zahlen: bundlephobia.com API · Release-Daten: `npm view <paket> time`.

## Empfehlung: @dagrejs/dagre für die Knotenpositionen, Rückkanten von Hand routen

**dagre** ist die richtige Engine für dieses Diagramm:

1. **Passgenauigkeit.** Das Prozessbild ist eine überwiegend lineare, vertikale Kette mit
   wenigen Verzweigungen — exakt der Fall, für den die React-Flow-Doku dagre „highly
   recommend[s]". Die volle Konfigurierbarkeit von ELK (Ports, Subflows, orthogonales
   Routing) wird hier nicht gebraucht.
2. **Bundle-Gewicht.** 15,6 kB gzip gegenüber 433 kB gzip für elkjs — elkjs wäre allein
   schwerer als der Rest der Diagramm-Seite und verlangt für flüssige Interaktion einen
   Web Worker (im elkjs-README als eigener Betriebsmodus dokumentiert).
3. **Wartung & TypeScript.** Die `@dagrejs`-Organisation pflegt das Paket aktiv (v3.1.0
   vom 2026-08-02), der Quellcode ist inzwischen selbst TypeScript. Der alte Ruf
   „dagre ist verwaist" bezieht sich auf das eingestellte Original-npm-Paket `dagre`;
   installiert wird `@dagrejs/dagre`.
4. **Stabilität.** dagre ist deterministisch: gleiche Knoten/Kanten in gleicher Reihenfolge
   ⇒ identische Positionen. Da die Revision pro Chat-Runde meist nur Texte ändert oder
   Schritte anhängt, bleiben bestehende Positionen praktisch stehen, solange wir Knoten
   und Kanten **stabil sortiert** (nach `step.order`) an dagre übergeben. Einen echten
   inkrementellen Modus hat keine der Bibliotheken; ELKs `considerModelOrder` ist das
   nächstliegende Äquivalent, rechtfertigt aber die 433 kB nicht.

**d3-dag scheidet aus:** Es ist laut eigener Doku ausschließlich für **azyklische** Graphen
gebaut — genau die Rücksprung-Kanten, die das Ticket fordert, müsste man vor dem Layout
selbst herausschneiden und hätte damit den schwierigen Teil wieder in Handarbeit, ohne die
Reife von dagre. Zudem Ein-Personen-Projekt mit größerem Bundle als dagre.

**Reine Handarbeit scheidet aus,** sobald zwei Zweige parallel liegen: Spaltenzuteilung,
Kollisionsvermeidung und Wiedervereinigung der Zweige sind exakt das Sugiyama-Problem, das
dagre löst. Handarbeit bleibt aber Teil der Lösung — für das Kantenrouting (unten).

## Umsetzungsskizze

### Zwei-Pass-Layout wegen variabler Kartenhöhen

dagre braucht Breite/Höhe **vor** dem Layout. Das offizielle React-Flow-Beispiel umgeht das
mit Konstanten (`nodeWidth = 172; nodeHeight = 36`) — für unsere Karten mit `min-h-28` und
wachsendem Inhalt wäre das falsch (Überlappungen bei langen Aktivitätstexten). Richtig ist
das Zwei-Pass-Muster von React Flow v12:

1. Knoten mit grober Schätzhöhe rendern (Breite ist fix: 320 px durch `w-80`).
2. Nach dem Messen liefert React Flow `node.measured.width/height`; damit
   `dagreGraph.setNode(id, { width: 320, height: measured.height })` und Layout (neu) rechnen.
3. `ranksep` ersetzt das heutige 240-px-Raster, `nodesep` trennt parallele Zweige.

### Rückkanten: nicht in den dagre-Graphen, sondern seitlich vorbeirouten

dagre würde eine Rückkante intern umdrehen (Greedy-FAS-Zyklenauflösung) und sie wie eine
normale Kante zwischen den Rängen verlegen — mitten durch die Kartenspalte. Besser:

1. **Rückkanten vor dem dagre-Aufruf herausfiltern.** Nur Vorwärtskanten bestimmen die
   Ränge; die Schrittfolge bleibt die vertraute Top-down-Kette und die Ranghöhen bleiben
   über Revisionen stabil (eine Rückkante kann die Rangzuweisung sonst umwerfen).
2. **Rückkante als eigene React-Flow-Edge-Komponente** (analog zur bestehenden
   `MentionEdge`) mit handgebautem Pfad statt `getBezierPath`:
   - Start am Bottom-Handle des Quellknotens, kurzer vertikaler Stich nach unten,
   - orthogonal nach **links** in eine Gutter-Spalte bei `x = minX - gutter`
     (z. B. 48 px links der Karten; bei mehreren Schleifen pro zusätzlicher Rückkante
     eine weitere Spur weiter links, damit sich Schleifen nicht überlagern),
   - vertikal **nach oben** an allen Karten vorbei,
   - orthogonal nach rechts zurück und mit Pfeilspitze in den Top-Handle des Zielknotens
     (alternativ ein linksseitiger Target-Handle, dann entfällt der letzte Knick).
   - Abgerundete Ecken über Quadratic-Bezier-Ecken oder React Flows `getSmoothStepPath`
     mit selbst gesetzten Stützpunkten.
3. Beschriftung/Interaktion (Mention-Knopf) wie heute über `EdgeLabelRenderer` am
   vertikalen Segment der Schleife.

Damit übernimmt dagre genau das, was es gut kann (Ränge, Spalten, Verzweigungen), und das
einzige, was es nicht kann (Kantenrouting), bleibt eine kleine, kontrollierte Eigenbau-Edge.

## Bekannte Fallstricke

- **dagre + variable Knotenhöhen:** Ohne echte Maße rechnet dagre mit falschen Höhen —
  Überlappungen oder riesige Lücken. Immer `node.measured.*` einspeisen (Zwei-Pass, s. o.);
  das offizielle Beispiel mit festen Konstanten nicht 1:1 übernehmen.
- **dagre kennt kein Edge-Routing:** Die React-Flow-Doku führt „No edge routing" als
  dagre-Schwäche. Für Vorwärtskanten reicht Bezier/SmoothStep von React Flow; Rückkanten
  brauchen die Gutter-Edge oben.
- **Layout-Sprünge zwischen Revisionen:** dagre garantiert Determinismus, aber keine
  Ähnlichkeit zwischen zwei *verschiedenen* Eingaben. Ein neuer Schritt mitten im Prozess
  verschiebt alles darunter (erwünscht), kann aber auch die Links/Rechts-Zuordnung von
  Zweigen kippen. Gegenmittel: Knoten und Kanten stets in stabiler `order`-Reihenfolge
  übergeben und Positionsänderungen animieren (z. B. Übergangs-Transition auf den Knoten),
  statt hart zu springen.
- **elkjs-Bundle und Worker:** 1,45 MB minifiziert / 433 kB gzip; das README beschreibt den
  Web-Worker-Betrieb, weil das GWT-Transpilat den Main-Thread blockiert. Nur relevant,
  falls die Anforderungen später auf orthogonales Routing, Ports oder Subflows wachsen —
  dann ist elkjs der dokumentierte Aufstiegspfad.
- **d3-dag und Zyklen:** wirft bzw. ist undefiniert bei zyklischen Eingaben; die eigene
  Doku beschreibt ausschließlich DAGs. Für Prozesse mit Rücksprüngen ungeeignet.
- **Altpaket-Falle:** `dagre` (ohne Scope) auf npm ist das eingestellte Original.
  Installiert werden muss `@dagrejs/dagre`.

## Entscheidung in einem Satz

`@dagrejs/dagre` (TB-Layout, gemessene Kartenhöhen, Kanten stabil sortiert) für die
Positionen; Rücksprung-Kanten werden vor dem Layout entfernt und als eigene orthogonale
Gutter-Edge links an den Karten vorbeigeführt; elkjs bleibt der dokumentierte Plan B für
komplexeres Routing, d3-dag und reine Handarbeit scheiden aus.
