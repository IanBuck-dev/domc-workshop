# Leichtgewichtige BPMN-Ikonografie für das Prozessbild

Recherche zu Wayfinder-Ticket #5. Frage: Wie sieht eine leichtgewichtige, BPMN-nahe
Ikonografie für Start, Ende, XOR-Gateway und Rücksprung/Schleife aus, die zu unserem
Kartenstil passt (weiße Karten auf gepunktetem Grund, Geist-Schrift, gedeckte
Grün-Palette, deutsche Beschriftung, Fachanwender ohne BPMN-Vorwissen)? Und: Wie
vereinfachen leichte Werkzeuge den Standard, was davon lohnt sich für uns?

Stand: 2026-08-07. Primärquelle für die Notation ist die OMG-Spezifikation
[BPMN 2.0.2](https://www.omg.org/spec/BPMN/2.0.2/PDF); Seitenangaben beziehen sich
auf die gedruckte Paginierung des PDFs.

---

## 1. Die kanonischen BPMN-Symbole für unsere vier Elemente

### Start-Ereignis: Kreis, dünne Linie

BPMN 2.0.2, Abschnitt 10.5.2 (S. 237 f.):

> "A Start Event is a circle that MUST be drawn with a single thin line (see Figure 10.70)."
>
> "The thickness of the line MUST remain thin so that the Start Event can be
> distinguished from the Intermediate and End Events."

Der Kreis hat bewusst eine offene Mitte („a circle with an open center so that markers
can be placed within the circle"), damit Trigger-Marker (Brief, Uhr, …) hineinpassen.
Ein Start-Ereignis hat nie eingehende Sequenzflüsse.

### End-Ereignis: Kreis, dicke Linie

BPMN 2.0.2, Abschnitt 10.5.3 (S. 246):

> "An End Event is a circle that MUST be drawn with a single thick line (see Figure 10.71)."
>
> "The thickness of the line MUST remain thick so that the End Event can be
> distinguished from the Intermediate and Start Events."

Die **Strichstärke ist das einzige Unterscheidungsmerkmal** zwischen Start-, Zwischen-
und End-Ereignis (Zwischenereignis: Doppellinie — brauchen wir nicht). Genau deshalb
ist der Kontrast dünn/dick nicht verhandelbar, wenn wir BPMN-nah bleiben wollen: eine
mittlere Strichstärke für beide würde die Unterscheidung zerstören.

### XOR-Gateway: Raute, ×-Marker optional — aber konsistent

Die Grundform aller Gateways, Abschnitt 10.6.1 (S. 287):

> "A Gateway is a diamond that MUST be drawn with a single thin line (see Figure 10.102)."
>
> "A Gateway is a diamond, which has been used in many flow chart notations for
> exclusive branching and is familiar to most modelers."

Zum ×-Marker, Abschnitt 10.6.2 (S. 289 f.):

> "The Exclusive Gateway MAY use a marker that is shaped like an 'X' and is placed
> within the Gateway diamond (see Figure 10.106) to distinguish it from other
> Gateways. This marker is NOT REQUIRED (see Figure 10.105)."
>
> "A diagram SHOULD be consistent in the use of the 'X' internal indicator. That is,
> a diagram SHOULD NOT have some Gateways with an indicator and other Gateways
> without an indicator."

Der Standard erlaubt also beide Varianten; verlangt wird nur Konsistenz.
[Camundas BPMN-Referenz](https://camunda.com/bpmn/reference/) empfiehlt den Marker:

> "BPMN uses two symbols for XOR gateways. They are identical in meaning. […] We
> always use the version with the X because it seems less ambiguous."

Semantik, die für Beschriftung relevant ist (10.6.2): Die Entscheidung ist „a question
that is asked at a particular point in the Process", die Antworten hängen als
Bedingungen an den **ausgehenden Sequenzflüssen** — d. h. die Frage steht am Gateway,
die Antworten stehen an den Pfeilen.

### Rücksprung/Schleife: zwei kanonische Formen

1. **Expliziter Rücksprung:** ein gewöhnlicher Sequenzfluss, der zu einem früheren
   Element zurückführt (meist über ein XOR-Gateway „Prüfung bestanden? nein → zurück").
   Dafür gibt es kein eigenes Symbol — die Schleife ist die Kante selbst.
2. **Loop-Marker an einer Aktivität**, Abschnitt 10.3 (S. 189, Figuren 10.46/10.47):

   > "The marker for a Task that is a standard loop MUST be a small line with an
   > arrowhead that curls back upon itself."

   Ein kleiner, sich einrollender Pfeil am unteren Kartenrand; die
   Wiederholungsbedingung steckt dann unsichtbar im Modell (bei Camunda als
   Annotation an der Aufgabe, vgl. deren Referenz: „A loop task repeats until a
   defined condition either applies or ceases to apply.").

---

## 2. Wie die leichten Werkzeuge den Standard abwandeln

### Camunda / bpmn.io — Standard voll, Nutzung reduziert

Camunda (und die zugrunde liegende Bibliothek bpmn.io) rendert die Notation
spezifikationstreu; die Vereinfachung geschieht über **Nutzungsregeln**, nicht über
andere Formen. Die Best-Practice-Seite
[„Creating readable process models"](https://docs.camunda.io/docs/components/best-practices/modeling/creating-readable-process-models/)
empfiehlt u. a.:

- Implizite Konstrukte meiden, Verzweigungen immer mit Gateway-Symbol zeigen statt
  mit bedingten Flüssen.
- „Model the XOR gateway by explicitly showing the X symbol, even if some tools
  allow to draw a blank gateway."
- Start- und Endereignisse immer explizit zeigen und fachlich benennen: „Be specific
  about the state you reached with your event from a business perspective"
  (Beispiel „Invoice paid").
- Von links nach rechts modellieren, den Happy Path auf einer geraden Linie halten.
- Lanes und Symbolgrößen-Spielereien vermeiden.

Das ist die wichtigste Lehre: Selbst das Werkzeug mit vollem BPMN-Umfang rät
faktisch zu einer **kleinen Teilmenge** — Aufgaben, Start/Ende, XOR, Sequenzfluss —
plus disziplinierte Beschriftung.

### Miro — BPMN-Formen als Vorlage, Erklärung auf Anfängerniveau

[Miros BPMN-Seite](https://miro.com/diagramming/what-is-bpmn/) erklärt die Notation
grob vereinfacht („In the diagram, events are circles. There are sometimes icons
within the circle […]", „Activities appear in a BPMN diagram as a rounded
rectangle") und setzt auf ausfüllbare Templates statt auf Normtreue. Strichstärken
oder Gateway-Marker werden gar nicht thematisiert — die Differenzierung dünn/dick
wird dem Nutzer nicht erklärt, sondern steckt nur in den vorgezeichneten Shapes.

### FigJam — kein BPMN, generische Flowchart-Formen

FigJam bietet laut [Figma-Hilfe](https://help.figma.com/hc/en-us/articles/1500004414382-Visualize-information-using-shapes-with-text)
Kategorien „Basic, Flowchart, and Misc shapes" — also die klassischen
Flowchart-Formen (Terminator, Rechteck, Raute), keine BPMN-Symbolik. Die
Ereignis-Unterscheidung über Strichstärke existiert dort nicht; Start/Ende sind
beschriftete Pillen-/Ovalformen.

### Whimsical — kuratierte Flowchart-Formen, ebenfalls kein BPMN

[Whimsical](https://whimsical.com/flowcharts) vermarktet eine bewusst kleine
„collection of relevant flowchart shapes" und nimmt auf BPMN gar keinen Bezug. Wie
bei FigJam gilt die verbreitete Flowchart-Konvention (vgl. z. B.
[Lucidcharts Symbolübersicht](https://www.lucidchart.com/pages/flowchart-symbols-meaning-explained)):
Terminator (Oval/Pille) für Start und Ende, Raute für Entscheidungen mit
Ja/Nein-beschrifteten Ausgängen, Rechteck für Schritte.

**Muster über alle Werkzeuge:** Die „Leichtigkeit" entsteht nie durch neue Symbole,
sondern durch (a) Reduktion auf vier bis fünf Grundformen, (b) Bedeutung über
**Textbeschriftung statt Symbolvarianten**, (c) Verzicht auf alles, was nur für
ausführbare Modelle gebraucht wird (Ereignistypen, Lanes, Nachrichtenflüsse,
Marker-Zoo).

---

## 3. Empfehlung für unser UI

Unser Diagramm (`apps/web/src/components/process-flow-diagram.tsx`) besteht heute aus
`w-80`-Schrittkarten mit Nummernkreis auf gepunktetem React-Flow-Grund; Kanten sind
1 px in `--muted-foreground`, Fokus in `--primary` bei 3 px. Darauf aufbauend:

### Formen und Strichstärken

| Element | Form | Stroke | Größe | Beschriftung |
| --- | --- | --- | --- | --- |
| Start | Kreis, offen (nur Kontur) | 1,5 px `--muted-foreground` | ~40 px (`size-10`) | Label darunter/daneben in `text-ui`, z. B. „Schaden gemeldet" |
| Ende | Kreis, offen | 3,5–4 px `--foreground` oder `--primary` | ~40 px | fachlicher Endzustand, z. B. „Fall abgeschlossen" |
| XOR-Gateway | Raute (45°-Quadrat), offen, **mit ×** | 1,5 px, × ebenfalls 1,5–2 px | ~44 px | Frage als Label am Knoten („Deckung gegeben?"), Antworten an den Kanten („ja"/„nein") |
| Rücksprung | normale Kante zurück nach oben, orthogonal/gebogen geführt | wie Kanten heute (1 px, Fokus 3 px) | — | Kantenlabel mit der Antwort, z. B. „Unterlagen fehlen" |

Begründungen:

- **Dünn vs. dick ist der Kern der BPMN-Anmutung** — genau das Merkmal, das die Spec
  als MUST für die Unterscheidung definiert. Ein Faktor ~2,5 zwischen den Stärken
  (1,5 px vs. 4 px) ist bei 40 px Durchmesser auch für Laien sofort sichtbar.
  Zusätzlich tragen die deutschen Labels die Bedeutung, sodass niemand die
  Konvention kennen muss (FigJam/Whimsical-Prinzip: Text schlägt Symbolkunde).
- **× immer zeigen** (Camunda-Empfehlung, Spec-Konsistenzregel). Da wir ohnehin nur
  XOR haben, droht keine Verwechslung mit anderen Gateway-Typen — das × dient bei
  uns als Lesehilfe „hier trennt sich der Weg", nicht als Typunterscheidung.
- **Gateway-Beschriftung nach Spec-Semantik:** Frage am Gateway, Antworten an den
  ausgehenden Kanten. Das ist zugleich die verständlichste Form für Fachanwender
  (identisch mit der Ja/Nein-Konvention klassischer Flowcharts).
- **Rücksprung als Kante, nicht als Loop-Marker.** Der eingerollte Pfeil der Spec ist
  ohne BPMN-Vorwissen nicht lesbar und versteckt die Wiederholungsbedingung. Eine
  sichtbare Rückkante mit beschriftetem Grund („Unterlagen fehlen → zurück zu
  Schritt 2") zeigt Zustand, nächste Aktion und Begründung — das entspricht auch
  unserer UX-Regel „Show the current state, the next required action, and why".
- **Farbe:** Konturen neutral (`--muted-foreground`/`--foreground`), Grün nur als
  Fokus-/Aktivzustand (`--primary`, `--ring`) — konsistent mit dem Token-Kommentar
  in `styles.css` („die brand green lives in --primary and --ring only"). Keine
  gefüllten Flächen: Start/Ende bleiben offene Kreise auf weißem Grund, wie die
  Karten selbst („--card always paired with a border, never a shadow").
- **Schrift:** Labels in Geist `text-ui` (14 px), wie die Sekundärtexte der Karten;
  keine Beschriftung *im* Symbol (BPMN setzt Event-Namen ebenfalls außerhalb).

### Was wir bewusst weglassen

- **Ereignistypen/Trigger-Marker** (Brief, Uhr, Fehler …): Marker-Zoo, den keines der
  leichten Werkzeuge seinen Nutzern zumutet. Der Auslöser steht bei uns als Text.
- **Zwischenereignisse (Doppellinien-Kreis):** ohne Dritttyp bleibt dünn/dick trivial.
- **Alle anderen Gateway-Typen** (AND-Parallel „+", OR „○", ereignisbasiert): unsere
  Erfassung kennt nur alternative Wege. Sollte „parallel" später nötig werden, ist
  das „+"-Gateway die einzige sinnvolle Erweiterung.
- **Loop-/Multi-Instance-Marker an Aktivitäten** — siehe oben, Rückkante statt Marker.
- **Pools und Lanes:** Camunda rät selbst davon ab („Consider avoiding lanes for most
  of your models altogether"); Zuständigkeit steht bei uns in der Karte.
- **Nachrichten-, Daten- und Assoziationsflüsse.**

### Umsetzung: eigene SVGs statt lucide

lucide hat keine passenden Glyphen: `circle`/`circle-dot` unterscheiden keine
Strichstärke pro Instanz sinnvoll (lucide skaliert `stroke-width` einheitlich über
`strokeWidth`-Prop, aber die Ikonografie soll Knoten sein, kein 16-px-Icon), eine
Raute mit innenliegendem × existiert nicht (`diamond` ist leer, `x` separat), und
der eingerollte Loop-Pfeil (`iteration-ccw`/`repeat`) wäre gerade das Symbol, das
wir vermeiden wollen. Empfehlung:

- **Drei kleine Inline-SVG-Komponenten** als neue React-Flow-Knotentypen neben
  `step`: `StartNode`, `EndNode`, `GatewayNode`. Jeweils ein `<circle>` bzw.
  `<path>` (Raute + ×) mit `stroke="currentColor"`, `fill="var(--card)"` (deckend
  gegen den Punktraster) und `vector-effect="non-scaling-stroke"`, damit die
  Strichstärken beim Zoomen (0.45–1.4) stabil bleiben — genau die Eigenschaft, die
  die Spec zur Bedeutungsträgerin macht.
- Rückkanten als zusätzlicher Kantentyp auf Basis des bestehenden `MentionEdge`
  (Label + Mention-Knopf funktionieren dann auch für Schleifen).
- lucide bleibt für UI-Chrome (Info, MessageCircle) — die Prozesssymbole sind
  Diagramm-Vokabular, kein Interface-Icon-Set, und sollten auch dateiseitig getrennt
  liegen (z. B. `apps/web/src/components/process-flow-symbols.tsx`).

---

## Quellen

- OMG, [Business Process Model and Notation (BPMN), Version 2.0.2](https://www.omg.org/spec/BPMN/2.0.2/PDF) — Abschnitte 10.3 (Loop-Marker, S. 189), 10.5.2 (Start Event, S. 237 f.), 10.5.3 (End Event, S. 246), 10.6.1–10.6.2 (Gateways, S. 287–290).
- Camunda, [BPMN 2.0 Symbols — Reference](https://camunda.com/bpmn/reference/) — XOR-Marker-Empfehlung, Loop-Task-Semantik.
- Camunda 8 Docs, [Creating readable process models](https://docs.camunda.io/docs/components/best-practices/modeling/creating-readable-process-models/) — Teilmengen- und Beschriftungsregeln.
- Camunda 8 Docs, [BPMN primer](https://docs.camunda.io/docs/components/modeler/bpmn/bpmn-primer/) — Grundvokabular Events/Gateways/Sequenzfluss.
- Miro, [What is BPMN?](https://miro.com/diagramming/what-is-bpmn/) — vereinfachte Symbolerklärung, Template-Ansatz.
- Figma Learn, [Visualize information using shapes with text](https://help.figma.com/hc/en-us/articles/1500004414382-Visualize-information-using-shapes-with-text) — FigJams Formenkategorien.
- Whimsical, [Flowcharts](https://whimsical.com/flowcharts) — kuratierte Formensammlung ohne BPMN-Bezug.
- Lucidchart, [Flowchart symbols and notation](https://www.lucidchart.com/pages/flowchart-symbols-meaning-explained) — klassische Flowchart-Konvention (Terminator/Raute) als Vergleichsmaßstab.
