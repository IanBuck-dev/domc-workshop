# Plan: Prozessbild-UI auf V3-Flow umstellen

## Ziel

Alle verbliebenen Web-Leser verwenden `ProcessUnderstanding.flow` als einzige
Quelle für Ablauf und Entscheidungen. Der bestehende Diagramm-Look, die
Hover-Mentions und die Ikonografie bleiben unverändert.

## Umsetzung

1. `process-flow-diagram.tsx` erzeugt React-Flow-Knoten direkt aus
   `flow.nodes` und Kanten direkt aus `flow.edges`. Schritttexte kommen aus dem
   referenzierten Schritt, Start/Ende aus `trigger.value`/`outcome.value`,
   Gateway-Fragen aus dem XOR-Knoten und Kantenlabels aus `edge.label`.
   Schrittordnungen bestimmen Rückkanten auch für Gateway-Quellen; nur
   Vorwärtskanten gehen in dagre ein, Rückkanten verwenden den bestehenden
   Gutter-Edge-Typ. Jede Mention trägt die echte Knoten- oder Kanten-ID und das
   Klartextlabel nach `chat-mention.tsx`.
2. `process-tracker.tsx` leitet das direkt auf einen Schritt folgende Gateway
   über die eingehende Flow-Kante ab. Ohne Gateway bleibt der zentrierte Pfeil.
   Mit Gateway erscheinen Frage und erwähnbare Kanten-Chips; Vorwärtszweige
   zeigen `<Label> → weiter`, Rücksprünge `<Label> ↺ zurück zu Schritt N`.
3. Die Detail- und Formularkomponenten erhalten den Flow beziehungsweise das
   für den jeweiligen Schritt abgeleitete Gateway samt Ausgangskanten.
   Lesedarstellungen zeigen Gateway-Frage, Modus, Kantenlabel,
   `determination`, `consequence` und Zielschritt. Der Formularmodus editiert
   vorhandene Gateway- und Kantenfelder einschließlich Ziel direkt im Graphen.
   Er erzeugt oder löscht keine Knoten/Kanten, weil die Spezifikation nur die
   Feldbearbeitung festlegt und strukturelle Teilzustände den kanonischen
   Graphen ungültig machen würden; diese Entscheidung wird im Editor kurz auf
   Deutsch kommentiert.
4. `process-brief.tsx` aktualisiert bei Schrittänderungen weiterhin nur den
   Schritt, bei Entscheidungsänderungen ausschließlich `draft.flow`.
   `firstInvalidField()` prüft Gateway-Fragen, Gateway-Kantenlabels und alle
   Knotenreferenzen und überlässt die abschließende Graphgrammatik weiterhin
   `processUnderstandingSchema.safeParse()`.
5. `process-step-delete-dialog.tsx` zeigt eingehende Flow-Kanten. Der Quelltext
   kommt bei einem Gateway aus dessen Frage, bei einem Schritt aus Nummer und
   Name und beim Start aus dem Trigger. Die bestehende Löschsperre bleibt.
6. `tests/chat-ui.test.ts` sichert echte `understanding.flow`-Verdrahtung,
   entfernte Prototypmarker, topologische Gutter-Rückkanten und die entschiedene
   Chip-Variante. Weitere betroffene Tests und bestehende Quelltext-Contracts
   werden an die neuen Props und Flow-Felder angepasst.

## Files To Change

- `apps/web/src/components/process-flow-diagram.tsx`
- `apps/web/src/components/process-tracker.tsx`
- `apps/web/src/components/process-step-details.tsx`
- `apps/web/src/components/process-step-decisions.tsx`
- `apps/web/src/components/process-step-card.tsx`
- `apps/web/src/components/process-brief.tsx`
- `apps/web/src/components/process-step-delete-dialog.tsx`
- `tests/chat-ui.test.ts`
- weitere Tests nur bei nachgewiesenen Contract- oder Typfehlern

## Tests und Abnahme

- `bunx prettier --write` auf allen geänderten Dateien.
- `./scripts/qa test tests/chat-ui.test.ts` während der Reparatur.
- `./scripts/qa all` muss format, lint, typecheck, test und build grün beenden.
- Diff-Prüfung bestätigt: kein `PROTOTYP`-/`proto`-/`prototypeMention`-Behelf,
  keine produktiven `step.decisions`-/`nextStepId`-Leser in den Zielkomponenten,
  keine Branch- oder Commit-Operation.
