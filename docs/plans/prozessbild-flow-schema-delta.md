# Spezifikation: Schema-Delta und Capture-Agent

> Wayfinder-Entscheidungsticket „Schema-Delta und Capture-Agent“  
> Status: entschiedene Spezifikation für die spätere Implementierungsplanung  
> Stand: 7. August 2026

## 1. Ziel und Grenze

Dieses Papier konkretisiert das Domänen- und Capture-Delta für ein erstklassiges,
typisiertes Prozessgraph-Modell. Der Graph `flow` wird Bestandteil des
`ProcessUnderstanding`, wird vom Capture-Agenten direkt geschrieben und ist die
einzige strukturierte Quelle für Ablauf, Verzweigungen und Rücksprünge.

```text
trigger ──> startEvent ──> step ──> gateway ──> step ──> endEvent <── outcome
                                  │
                                  └── Rücksprung auf früheren step
```

Fest und nicht Gegenstand der Diskussion sind:

- `flow` ist ein erstklassiger typisierter Graph.
- Knoten sind `startEvent`, `step`, `gateway` und `endEvent`; alle Gateways sind
  vorerst XOR, deshalb gibt es kein Gateway-Typfeld.
- Ein `step`-Knoten referenziert einen Eintrag aus `steps[]`.
- Gateway-Frage und Modus liegen am Gateway. Antwort, Feststellung und Folge
  liegen an der ausgehenden Gateway-Kante.
- Ein Rücksprung ist eine normale Kante auf einen früheren Knoten.
- `step.decisions[]` entfällt. Detailansicht und Formularbearbeitung lesen
  Entscheidungen aus `flow`.
- Mentions referenzieren generisch Knoten- oder Kanten-IDs. Ihre Gültigkeit
  hängt nur davon ab, ob diese ID im aktuellen Graphen existiert.
- Das bereits prototypisierte Rendering mit dagre, Gutter-Rückkante und der
  schmalen Text-Chip-Spalte ist ein Abnehmer dieses Deltas, nicht sein
  Entscheidungsgegenstand.

Nicht Teil dieses Papiers sind visuelles Design, Layout-Engine-Auswahl,
KI-Potenzialbewertung und Schreibzugriffe aus der Potenzialanalyse.

## 2. Befund im aktuellen Code

### 2.1 Domain

`packages/domain/src/process-understanding.ts` hat aktuell drei relevante
Generationen in einer Datei:

1. Das unversionierte Altformat nutzt `legacyProcessStepSchema` mit einfachen
   Feldern wie `decision`, `trigger`, `information` und `output`.
2. `migrateLegacyProcessUnderstanding()` überführt es beim Lesen in Version 2.
   Eine alte `decision` wird dabei zu genau einer strukturierten Entscheidung
   ohne Optionen.
3. Version 2 speichert `processDecisionSchema` und
   `processDecisionOptionSchema` in `processStepSchema.decisions[]`.

`addUnderstandingIssues()` prüft heute zusammenhängende Schritt-Reihenfolgen,
globale Eindeutigkeit von Schritt-, Informations- und Entscheidungs-IDs,
`nextStepId`-Referenzen, Evidenz-IDs und Dokumentabdeckung. Diese Struktur ist
das Muster für die Graph-Refinements: lokale Feldregeln bleiben in den
Teilschemata, referenzielle und graphweite Regeln bleiben in einem zentralen
`superRefine`.

### 2.2 Speicherung und Revisionen

`packages/storage/src/process-capture-repository.ts` liest das Formularformat
und bestätigte Chat-Stände über `processUnderstandingStorageSchema`. Damit gibt
es dort bereits einen geeigneten Legacy-Einstiegspunkt. Unbestätigte
Chat-Prozesse nehmen dagegen einen Sonderweg: Sie lesen
`chat/last-valid-process-understanding.json` über
`processUnderstandingSchema` direkt.

`packages/storage/src/chat-capture-repository.ts` verwaltet keine Sammlung
vollständiger Revisionen. Es gibt:

- die vom Agenten überschriebene Arbeitsdatei `process-understanding.json`;
- den atomar überschriebenen letzten gültigen Stand
  `chat/last-valid-process-understanding.json`;
- den SHA-256-Hash dieses normalisierten Stands als `lastValidRevision`;
- append-only Audit-Einträge mit Revisionshash, aber ohne vollständige Kopie;
- Mentions im append-only Transkript, die den damaligen Revisionshash tragen.

Die Migration muss daher alle drei Lesepfade abdecken: Hauptdatei, letzter
gültiger Chat-Stand und eingebetteter Opportunity-Snapshot. Ein Umbau nur im
`ProcessCaptureRepository.get()` reicht nicht.

### 2.3 Capture-Agent und Schemafehler

Der Chat-Prompt lebt in `defaults/prompts/process-chat.md`, das maschinenlesbare
Schema in `defaults/ai-schemas/process-understanding.json`. Beim Anlegen eines
Chat-Prozesses kopiert `ChatCaptureRepository.initialize()` beide Dateien nach
`chat/contracts/`. `ChatCaptureService.freezeContracts()` respektiert danach
das Manifest: Änderungen an den Defaults wirken nur auf neu angelegte
Prozesse.

Der Agent erhält Schreibzugriff auf genau die Prozessdatei und schreibt sie mit
dem Claude-`Write`-Tool. Während des Zuges ruft `ChatTurnRunner` alle 350 ms
`reconcile()` auf. `reconcile()` begrenzt die Datei auf 2 MiB, parst JSON,
validiert mit Zod und prüft Evidenzreferenzen. Bei Erfolg veröffentlicht es den
Stand atomar; bei Fehler liefert es `status: "invalid"` und behält den letzten
gültigen Stand.

**Wichtig:** Das ist eine Validierungs- und Veröffentlichungs-Schleife, keine
Reparaturschleife. Ein Zod-Fehler wird dem Agenten nicht zurückgegeben.
`finishTurn()` akzeptiert einen sauber beendeten Provider-Stream auch dann,
wenn der abschließende Reconcile ungültig ist. Auch der Formularpfad repariert
nicht: `SandboxRunner` parst die Antwort nach Prozessende einmal mit Zod und
wirft bei einem Fehler.

## 3. Verbindliches Zielmodell

### 3.1 Identitäten und Textquellen

Der Graph verwendet feste typbasierte Ordinal-IDs: `start`, `end`,
`step-<n>`, `xor-<n>` und `edge-<n>`. Die Ordinale sind pro Typ positiv,
folgen der Erzeugungsreihenfolge; `start` und `end` kommen je genau einmal
vor. Bestehende fachliche Schritt-IDs bleiben unverändert und
werden ausschließlich in `stepId` referenziert.

Knoten- und Kanten-IDs sind über den gesamten Graphen eindeutig. Umbenennung,
Umordnung oder fachliche Anreicherung ändert eine vorhandene ID nicht;
entfernte IDs werden im selben Prozess nicht wiederverwendet.

`startEvent` und `endEvent` speichern keinen zweiten Text. Ihre sichtbaren
Namen werden aus `trigger.value` beziehungsweise `outcome.value` abgeleitet.
Ein `step`-Knoten leitet Name und Aktivität aus dem referenzierten Schritt ab.
Nur das Gateway besitzt mit `question` und `mode` eigene fachliche Felder.

### 3.2 Topologische Grammatik

Der verbindliche Graph erlaubt diese Verbindungen:

```text
startEvent -> step
step       -> step | gateway | endEvent
gateway    -> step | endEvent
endEvent   -> nichts
```

Ein `startEvent` und ein `step` haben genau eine ausgehende Kante. Nur ein
Gateway darf verzweigen. Ein Gateway hat genau eine eingehende Kante aus einem
`step`-Knoten; dadurch kann eine Schritt-Detailansicht ihre Entscheidung ohne
zusätzliches `ownerStepId` bestimmen. Rücksprünge zielen auf einen
`step`-Knoten, nicht auf Start, Ende oder ein anderes Gateway.

`flow.nodes` und `flow.edges` definieren jedes Graphobjekt genau einmal. Es
gibt keine rückwärts gerichteten Besitz- oder Reihenfolgenfelder wie
`afterStepId` oder `ownerStepId` und keine zweite Verkettung in `steps[]`.
Das Frontend parst den Graphen einmal und leitet Gateway-Zuordnung,
Vorgänger/Nachfolger und die Darstellung daraus ab.

Diese Grammatik bildet das aktuelle Fachmodell ab und begrenzt einen Schritt
auf höchstens ein unmittelbar folgendes Gateway.

### 3.3 Vollständiger Zod-Delta-Entwurf

Der folgende Code ist die konkrete Ersatzstruktur für den relevanten Bereich
in `packages/domain/src/process-understanding.ts` gedacht. Bestehende Helfer
wie `identifierSchema`, `factBase`, `processDecisionModeSchema`,
`processInformationItemSchema` und die globalen Faktenschemata bleiben
unverändert, soweit sie hier nicht ausdrücklich ersetzt werden.

```ts
export const processFlowIdentifierSchema = z
  .string()
  .trim()
  .min(1)
  .regex(
    /^(start|end|step-[1-9]\d*|xor-[1-9]\d*|edge-[1-9]\d*)$/,
    "Graph IDs must be start, end, step-<n>, xor-<n>, or edge-<n>.",
  );

const flowTextSchema = (maximum: number) =>
  z.string().trim().min(1).max(maximum);

export const processFlowStartEventNodeSchema = z
  .object({
    id: processFlowIdentifierSchema,
    kind: z.literal("startEvent"),
  })
  .strict();

export const processFlowStepNodeSchema = z
  .object({
    id: processFlowIdentifierSchema,
    kind: z.literal("step"),
    stepId: identifierSchema,
  })
  .strict();

export const processFlowGatewayNodeSchema = z
  .object({
    id: processFlowIdentifierSchema,
    kind: z.literal("gateway"),
    question: flowTextSchema(2_000),
    mode: processDecisionModeSchema,
  })
  .strict();

export const processFlowEndEventNodeSchema = z
  .object({
    id: processFlowIdentifierSchema,
    kind: z.literal("endEvent"),
  })
  .strict();

export const processFlowNodeSchema = z.discriminatedUnion("kind", [
  processFlowStartEventNodeSchema,
  processFlowStepNodeSchema,
  processFlowGatewayNodeSchema,
  processFlowEndEventNodeSchema,
]);

export const processFlowEdgeSchema = z
  .object({
    id: processFlowIdentifierSchema,
    source: processFlowIdentifierSchema,
    target: processFlowIdentifierSchema,
    label: flowTextSchema(1_000).optional(),
    determination: flowTextSchema(2_000).optional(),
    consequence: flowTextSchema(2_000).optional(),
  })
  .strict();

export const processFlowSchema = z
  .object({
    nodes: z.array(processFlowNodeSchema).min(3).max(64),
    edges: z.array(processFlowEdgeSchema).min(2).max(128),
  })
  .strict();

export const processStepSchema = z
  .object({
    id: identifierSchema,
    order: z.number().int().min(1).max(8),
    name: z.string().trim().min(1).max(500),
    activity: z.string().trim().min(1).max(1_000),
    inputs: uniqueStepTextArray(30),
    outputs: uniqueStepTextArray(30),
    informationItems: z.array(processInformationItemSchema).max(40),
    miscellaneous: z.string().trim().min(1).max(4_000).nullable(),
    ...factBase,
  })
  .strict();

type ProcessFlow = z.infer<typeof processFlowSchema>;
type ProcessStep = z.infer<typeof processStepSchema>;

function walkGraph(start: string, adjacency: Map<string, string[]>) {
  const visited = new Set<string>();
  const pending = [start];
  while (pending.length) {
    const id = pending.pop()!;
    if (visited.has(id)) continue;
    visited.add(id);
    for (const target of adjacency.get(id) ?? [])
      if (!visited.has(target)) pending.push(target);
  }
  return visited;
}

function addFlowIssues(
  value: { flow: ProcessFlow; steps: ProcessStep[] },
  ctx: z.RefinementCtx,
) {
  const { nodes, edges } = value.flow;
  const nodeIds = nodes.map((node) => node.id);
  const edgeIds = edges.map((edge) => edge.id);
  const allGraphIds = [...nodeIds, ...edgeIds];

  if (new Set(nodeIds).size !== nodeIds.length)
    ctx.addIssue({
      code: "custom",
      path: ["flow", "nodes"],
      message: "Flow node IDs must be unique.",
    });
  if (new Set(edgeIds).size !== edgeIds.length)
    ctx.addIssue({
      code: "custom",
      path: ["flow", "edges"],
      message: "Flow edge IDs must be unique.",
    });
  if (new Set(allGraphIds).size !== allGraphIds.length)
    ctx.addIssue({
      code: "custom",
      path: ["flow"],
      message: "Node and edge IDs must be unique across the flow.",
    });

  const starts = nodes.filter((node) => node.kind === "startEvent");
  const ends = nodes.filter((node) => node.kind === "endEvent");
  if (starts.length !== 1)
    ctx.addIssue({
      code: "custom",
      path: ["flow", "nodes"],
      message: "A flow requires exactly one start event.",
    });
  if (ends.length !== 1)
    ctx.addIssue({
      code: "custom",
      path: ["flow", "nodes"],
      message: "A flow requires exactly one end event.",
    });

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const outgoing = new Map(nodes.map((node) => [node.id, [] as number[]]));
  const incoming = new Map(nodes.map((node) => [node.id, [] as number[]]));

  edges.forEach((edge, edgeIndex) => {
    if (!/^edge-[1-9]\d*$/.test(edge.id))
      ctx.addIssue({
        code: "custom",
        path: ["flow", "edges", edgeIndex, "id"],
        message: "An edge ID must be edge-<n>.",
      });
    if (!nodeById.has(edge.source))
      ctx.addIssue({
        code: "custom",
        path: ["flow", "edges", edgeIndex, "source"],
        message: `Unknown source node ID: ${edge.source}`,
      });
    if (!nodeById.has(edge.target))
      ctx.addIssue({
        code: "custom",
        path: ["flow", "edges", edgeIndex, "target"],
        message: `Unknown target node ID: ${edge.target}`,
      });
    outgoing.get(edge.source)?.push(edgeIndex);
    incoming.get(edge.target)?.push(edgeIndex);
  });

  nodes.forEach((node, nodeIndex) => {
    const idMatchesKind =
      (node.kind === "startEvent" && node.id === "start") ||
      (node.kind === "endEvent" && node.id === "end") ||
      (node.kind === "step" && /^step-[1-9]\d*$/.test(node.id)) ||
      (node.kind === "gateway" && /^xor-[1-9]\d*$/.test(node.id));
    if (!idMatchesKind)
      ctx.addIssue({
        code: "custom",
        path: ["flow", "nodes", nodeIndex, "id"],
        message: "The node ID must match its graph-object type.",
      });
    const outgoingEdgeIndexes = outgoing.get(node.id) ?? [];
    const incomingEdgeIndexes = incoming.get(node.id) ?? [];
    const outgoingEdges = outgoingEdgeIndexes.map(
      (edgeIndex) => edges[edgeIndex]!,
    );
    const incomingEdges = incomingEdgeIndexes.map(
      (edgeIndex) => edges[edgeIndex]!,
    );

    if (node.kind === "startEvent") {
      if (incomingEdges.length !== 0 || outgoingEdges.length !== 1)
        ctx.addIssue({
          code: "custom",
          path: ["flow", "nodes", nodeIndex],
          message:
            "The start event requires no incoming and one outgoing edge.",
        });
      if (
        outgoingEdges[0] &&
        nodeById.get(outgoingEdges[0].target)?.kind !== "step"
      )
        ctx.addIssue({
          code: "custom",
          path: ["flow", "nodes", nodeIndex],
          message: "The start event must lead to a step node.",
        });
    }

    if (node.kind === "step" && outgoingEdges.length !== 1)
      ctx.addIssue({
        code: "custom",
        path: ["flow", "nodes", nodeIndex],
        message: "A step node requires exactly one outgoing edge.",
      });

    if (node.kind === "gateway") {
      if (
        incomingEdges.length !== 1 ||
        nodeById.get(incomingEdges[0]?.source ?? "")?.kind !== "step"
      )
        ctx.addIssue({
          code: "custom",
          path: ["flow", "nodes", nodeIndex],
          message: "A gateway requires exactly one incoming edge from a step.",
        });
      if (outgoingEdges.length < 2)
        ctx.addIssue({
          code: "custom",
          path: ["flow", "nodes", nodeIndex],
          message: "A gateway requires at least two outgoing edges.",
        });
      for (const edgeIndex of outgoingEdgeIndexes) {
        const edge = edges[edgeIndex]!;
        if (!edge.label)
          ctx.addIssue({
            code: "custom",
            path: ["flow", "edges", edgeIndex, "label"],
            message: "Gateway branches require an answer label.",
          });
        const targetKind = nodeById.get(edge.target)?.kind;
        if (targetKind !== "step" && targetKind !== "endEvent")
          ctx.addIssue({
            code: "custom",
            path: ["flow", "edges", edgeIndex, "target"],
            message: "A gateway branch must lead to a step or the end event.",
          });
      }
    }

    if (node.kind === "endEvent" && outgoingEdges.length !== 0)
      ctx.addIssue({
        code: "custom",
        path: ["flow", "nodes", nodeIndex],
        message: "The end event cannot have outgoing edges.",
      });
  });

  const stepIds = new Set(value.steps.map((step) => step.id));
  const stepNodes = nodes.flatMap((node, nodeIndex) =>
    node.kind === "step" ? [{ node, nodeIndex }] : [],
  );
  const referencedStepIds = stepNodes.map(({ node }) => node.stepId);
  stepNodes.forEach(({ node, nodeIndex }) => {
    if (!stepIds.has(node.stepId))
      ctx.addIssue({
        code: "custom",
        path: ["flow", "nodes", nodeIndex, "stepId"],
        message: `Unknown step ID: ${node.stepId}`,
      });
  });
  if (new Set(referencedStepIds).size !== referencedStepIds.length)
    ctx.addIssue({
      code: "custom",
      path: ["flow", "nodes"],
      message: "Every step may be referenced by only one flow node.",
    });
  value.steps.forEach((step, stepIndex) => {
    if (!referencedStepIds.includes(step.id))
      ctx.addIssue({
        code: "custom",
        path: ["steps", stepIndex, "id"],
        message: `Step is missing its flow node: ${step.id}`,
      });
  });

  if (starts.length !== 1 || ends.length !== 1) return;
  const adjacency = new Map(nodes.map((node) => [node.id, [] as string[]]));
  const reverse = new Map(nodes.map((node) => [node.id, [] as string[]]));
  for (const edge of edges) {
    if (!nodeById.has(edge.source) || !nodeById.has(edge.target)) continue;
    adjacency.get(edge.source)!.push(edge.target);
    reverse.get(edge.target)!.push(edge.source);
  }

  const reachableFromStart = walkGraph(starts[0]!.id, adjacency);
  nodes.forEach((node, nodeIndex) => {
    if (!reachableFromStart.has(node.id))
      ctx.addIssue({
        code: "custom",
        path: ["flow", "nodes", nodeIndex],
        message: `Node is not reachable from the start event: ${node.id}`,
      });
  });

  // Rückwärts vom Ende laufen. Diese stärkere Definition von „kein totes
  // Ende“ erkennt auch geschlossene Zyklen, die zwar Ausgänge besitzen, aber
  // niemals zum endEvent führen.
  const canReachEnd = walkGraph(ends[0]!.id, reverse);
  nodes.forEach((node, nodeIndex) => {
    if (!canReachEnd.has(node.id))
      ctx.addIssue({
        code: "custom",
        path: ["flow", "nodes", nodeIndex],
        message: `Node cannot reach the end event: ${node.id}`,
      });
  });
}
```

Die Einbettung in die aktuelle Version sieht so aus:

```ts
// Das globale decisions-Fakt wird in V3 entfernt: flow ist die einzige
// persistierte Quelle für Entscheidungen und Ablauf.
const {
  decisions: _removedGlobalDecisionsSchema,
  ...processUnderstandingV3Fields
} = processUnderstandingFields;

const processUnderstandingV3BaseSchema = z
  .object({
    schemaVersion: z.literal(3),
    ...processUnderstandingV3Fields,
    steps: z.array(processStepSchema).min(1).max(8),
    flow: processFlowSchema,
  })
  .strict();

function addUnderstandingV3Issues(
  value: z.infer<typeof processUnderstandingV3BaseSchema>,
  ctx: z.RefinementCtx,
) {
  addSharedUnderstandingIssues(value, ctx);
  addFlowIssues(value, ctx);
}

export const processUnderstandingSchema =
  processUnderstandingV3BaseSchema.superRefine(addUnderstandingV3Issues);

export const processUnderstandingV3Schema = processUnderstandingSchema;
```

`addUnderstandingIssues()` wird dabei mechanisch geteilt:

- `addSharedUnderstandingIssues()` behält Schritt-ID/-Reihenfolge,
  Information-ID, Evidenz, Coverage und Fakt-Evidenzreferenzen bei;
- `addUnderstandingV3Issues()` ergänzt ausschließlich die Graphregeln;
- `processDecisionSchema` und `processDecisionOptionSchema` verschwinden aus
  dem aktuellen Domain-Vertrag; der einmalige Migrationsbefehl besitzt seine
  von der Laufzeit getrennten Altformat-Decoder;
- `processStepSchema` enthält kein Feld `decisions`;
- `processStepAiSchema` omittiert künftig nur `informationItems`; die
  Server-Normalisierung erzeugt weiter stabile Informations-IDs, aber keine
  Decision-/Option-IDs mehr;
- `processSynthesisAiResultSchema` wechselt auf Version 3 und enthält `flow`.

## 4. Validierungsregeln und Aufwand

Alle Aufwände beziehen sich auf Implementierung plus fokussierte Domain-Tests,
nicht auf die abhängigen UI-Umbauten.

| Regel                    | Präzise Semantik                                                                                        | Komplexität |          Aufwand |
| ------------------------ | ------------------------------------------------------------------------------------------------------- | ----------: | ---------------: |
| Genau ein Start          | Exakt ein `startEvent`, ohne Eingang, mit genau einem Ausgang zu `step`                                 |      O(V+E) |            klein |
| Genau ein Ende           | Exakt ein `endEvent`, ohne Ausgang                                                                      |      O(V+E) |            klein |
| Referenzen               | `source` und `target` jeder Kante existieren                                                            |      O(V+E) |            klein |
| Eindeutige IDs           | Keine doppelten Knoten- oder Kanten-IDs; auch keine Überschneidung zwischen beiden Mengen               |      O(V+E) |            klein |
| Kanonische Definition    | Jeder Knoten und jede Kante steht genau einmal in `flow`; keine Rückwärtsverweise oder Doppelverkettung |      O(V+E) |            klein |
| Erreichbarkeit           | Jeder Knoten ist vom Start aus erreichbar                                                               |      O(V+E) |            klein |
| Keine toten Enden        | Jeder Knoten kann über mindestens einen Pfad das Ende erreichen; geschlossene Zyklen scheitern          |      O(V+E) |            klein |
| Gateway-Ausgänge         | Mindestens zwei ausgehende Kanten, jede mit nichtleerem `label`                                         |      O(V+E) |            klein |
| XOR-Ort                  | Nur Gateways dürfen mehr als eine ausgehende Kante haben                                                |      O(V+E) |            klein |
| Gateway-Zuordnung        | Genau ein eingehender `step`; Ziele nur `step` oder `endEvent`                                          |      O(V+E) | klein bis mittel |
| Schritt-Konsistenz       | Bijection: jeder `steps[]`-Eintrag genau ein `step`-Knoten, kein unbekannter `stepId`                   |      O(V+S) |            klein |
| Bestehende Schrittregeln | Schritt-IDs eindeutig, `order` lückenlos 1..n, Informations-IDs graphunabhängig eindeutig               |      O(S+I) |            klein |

Die Rückwärts-Erreichbarkeit zum Ende ist absichtlich stärker als die bloße
Regel „jeder Nicht-Endknoten hat einen Ausgang“. Sonst wäre ein vollständig
erreichbarer Zyklus ohne Ausstieg formal gültig und fachlich ein totes Ende.

Nicht im Domain-Schema geprüft werden Layout, „früher“ anhand von
`steps[].order`, Kantenkreuzungen oder ein Maximum der Zyklusanzahl. Ein
Rücksprung darf deshalb auch auf denselben Schritt zeigen; die Demo soll jedoch
mindestens einen echten Rücksprung auf einen Schritt mit kleinerer `order`
enthalten.

## 5. Migration gespeicherter Stände

Beim Start des Servers läuft vor dem Öffnen irgendeines Repositorys genau
einmal `migrateProcessFlowStorage()`. Der Befehl folgt den bestehenden
Storage-Mustern: Er findet pro Workspace die Hauptdatei,
`chat/last-valid-process-understanding.json`, die Chat-Arbeitsdatei,
Opportunity-Snapshots, Chat-Transkripte und die eingefrorenen Chat-Verträge,
schreibt jede Zieldatei atomar auf Schema-Version 3 beziehungsweise
Transkript-Ereignisversion 2 und protokolliert jeden umgestellten Stand
append-only mit altem und neuem Revisionshash.

Der Migrationsbefehl trägt die unversionierten und V2-Decoder privat bei sich;
nach erfolgreicher Migration akzeptieren `processUnderstandingStorageSchema`
und alle Repository-Leser ausschließlich V3. Ein unterbrochener Lauf ist
idempotent: Bereits auf V3 geschriebene Dateien werden validiert und
übersprungen, unvollständige Workspaces werden vor dem ersten normalen
Lesezugriff weiter migriert. Eingefrorene V2-Verträge werden gemeinsam auf den
V3-Vertrag gehoben, damit kein aktiver Agent wieder V2 schreiben kann; der
Audit-Eintrag bewahrt ihren vorherigen Hash.

Die Migration erzeugt `start`, `end`, einen `step-<n>`-Knoten je Schritt,
`xor-<n>` für eindeutig darstellbare Entscheidungen und fortlaufende
`edge-<n>`-Kanten. Lineare Altbestände werden deterministisch übersetzt;
eine einzelne vollständige V2-Entscheidung wird zu einem Gateway und ihren
Kanten, `nextStepId: null` führt zu `end`, und Rücksprünge bleiben normale
Kanten. Mehrere Entscheidungen oder weniger als zwei Optionen sind nicht
eindeutig: Die Migration bewahrt den linearen Verlauf und ergänzt je
ausgelassener Frage die Wissenslücke `Migration: Entscheidungsverlauf zu „…“
muss im Prozessbild geklärt werden.`

Es gibt keinen dauerhaften Legacy-Lesepfad, kein optionales `flow` und keine
V2- oder unversionierten Laufzeit-Schemas. V2-Fixtures existieren nur als
Eingabe für den einmaligen Migrationsbefehl; die verworfenen Laufzeit-Adapter
bleiben höchstens als historische Notiz in diesem Absatz dokumentiert.

## 6. Capture-Agent

### 6.1 Vertragsdateien

Für neue Chat-Prozesse werden gemeinsam versioniert:

- `defaults/prompts/process-chat.md`: Arbeitsregeln und ein kompaktes
  abstraktes Graphbeispiel;
- `defaults/ai-schemas/process-understanding.json`: JSON Schema V3 mit der
  Knoten-Union, Kantenform und `flow` als Pflichtfeld;
- `defaults/prompts/process-synthesis.md`: dieselben Graphregeln für den
  Formular-Synthesepfad;
- die Zod-AI-Schemata in `process-understanding.ts`, damit das JSON Schema und
  die Laufzeitvalidierung dieselbe Form verlangen.

Der Chat-Prompt ersetzt insbesondere die heutige Aussage „Varianten gehören
als Entscheidungen in Schritte, nicht als gezeichnete Verzweigungen“ durch:

- pflege `steps[]` als kompakte fachliche Schrittinhalte;
- pflege `flow` bei jeder materiellen Änderung vollständig mit;
- erzeuge für jeden Schritt genau einen referenzierenden Knoten;
- verzweige ausschließlich über XOR-Gateways;
- schreibe Antwort/Feststellung/Folge auf die jeweilige Gateway-Kante;
- modelliere Wiederholung als Kante auf den früheren Schritt;
- behalte IDs unveränderter Knoten und Kanten stabil;
- erfinde keinen Zweig, wenn Antwort, Ziel oder Folge fachlich unbekannt sind;
  erfasse die Unklarheit dann als `knowledgeGap`.

Ein kurzes Beispiel im Prompt ist sinnvoll, weil das JSON Schema zwar die
Form, aber nicht die Zusammenarbeit von `steps[]`, Gateway und Rückkante
erklärt. Das Beispiel bleibt abstrakt und enthält genau einen Start, zwei
Schritte, ein Gateway, ein Ende und einen Rücksprung. Es darf keine
Versicherungsbegriffe enthalten, damit es nicht als fachliche Vorlage wirkt.

```json
{
  "nodes": [
    { "id": "start", "kind": "startEvent" },
    {
      "id": "step-1",
      "kind": "step",
      "stepId": "step-pruefen"
    },
    {
      "id": "xor-1",
      "kind": "gateway",
      "question": "Sind die Angaben vollständig?",
      "mode": "rule_based"
    },
    {
      "id": "step-2",
      "kind": "step",
      "stepId": "step-bearbeiten"
    },
    { "id": "end", "kind": "endEvent" }
  ],
  "edges": [
    {
      "id": "edge-1",
      "source": "start",
      "target": "step-1"
    },
    {
      "id": "edge-2",
      "source": "step-1",
      "target": "xor-1"
    },
    {
      "id": "edge-3",
      "source": "xor-1",
      "target": "step-2",
      "label": "Ja"
    },
    {
      "id": "edge-4",
      "source": "xor-1",
      "target": "step-1",
      "label": "Nein",
      "consequence": "Fehlende Angaben werden ergänzt."
    },
    {
      "id": "edge-5",
      "source": "step-2",
      "target": "end"
    }
  ]
}
```

Neue Prozesse frieren Prompt und Schema V3 ein. Beim Serverstart migrierte
bestehende Prozesse erhalten in `chat/contracts/` denselben V3-Vertrag, bevor
sie wieder einen Zug annehmen; es gibt keinen V2-Chatbetrieb nach der
Migration.

### 6.2 Verhalten bei ungültigem Graphen

Der Capture-Agent schreibt den Kandidaten in die Prozessdatei und ruft danach
im selben Zug das interne Tool `verify_process_flow` auf. Das Tool prüft das
feste V3-Schema und zusätzlich Bijektion Schritte↔`step`-Knoten, konsistente
Vorgänger/Nachfolger, Erreichbarkeit vom `start`, keine toten Enden außer
`end`, mindestens zwei Gateway-Ausgänge, existierende Kantenziele und
eindeutige Knoten- sowie Kanten-IDs.

```text
Write candidate -> verify_process_flow -> ok: publish and finish turn
                                  \-> errors: agent corrects and verifies again
```

Die Tool-Schnittstelle folgt den übrigen Agent-Verträgen: Eingabe ist keine
fachliche Nutzlast, sondern die bereits geschriebene Prozessdatei; die Ausgabe
ist entweder `{ "ok": true }` oder `{ "ok": false, "errors": [{ "path":
"flow.edges[2].target", "code": "unknown_target", "message": "…" }] }`.
Die strukturierte Fehlerliste bleibt intern, geht unmittelbar an den Agenten
zurück und wird von ihm wiederholt bearbeitet, bis das Tool grün meldet; erst
dann ist der Turn abgeschlossen.

`reconcile()` bleibt ausschließlich die atomare Veröffentlichungsgrenze und
veröffentlicht nur einen erfolgreich verifizierten Stand. Scheitert der
Provider-Zug oder wird kein grünes Tool-Ergebnis erreicht, bleiben
Arbeitsdatei und letzter gültiger Stand getrennt; die UI zeigt nur den
allgemeinen fehlgeschlagenen Zug ohne Roh-JSON, Schema-Pfade oder
Modellbegriffe.

## 7. Mention-Delta

### 7.1 Aktuelles Problem

`packages/domain/src/chat-capture.ts` kennt `step` und `transition`.
`apps/web/src/components/chat-mention.tsx` erklärt einen Übergang nur dann für
gültig, wenn `toIndex === fromIndex + 1`. Diese Regel verliert bei Gateways,
Rücksprüngen und parallelen Kanten ihre Bedeutung.

### 7.2 Neues Schema

```ts
import { processFlowIdentifierSchema } from "./process-understanding.ts";

const mentionBase = {
  label: z.string().trim().min(1).max(500),
  nameSnapshot: z.string().trim().min(1).max(240).nullable().default(null),
  understandingRevision: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .nullable()
    .default(null),
};

export const chatMentionSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("node"),
      nodeId: processFlowIdentifierSchema,
      ...mentionBase,
    })
    .strict(),
  z
    .object({
      kind: z.literal("edge"),
      edgeId: processFlowIdentifierSchema,
      ...mentionBase,
    })
    .strict(),
]);

// Ausschließlich der einmalige Migrationsbefehl verwendet dieses V1-Schema.
const migrationOnlyChatMentionV1Schema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("step"),
      stepId: idSchema,
      ...mentionBase,
    })
    .strict(),
  z
    .object({
      kind: z.literal("transition"),
      fromStepId: idSchema,
      toStepId: idSchema,
      ...mentionBase,
    })
    .strict(),
]);
```

Neue Request-Daten und der Laufzeitleser akzeptieren ausschließlich
`chatMentionSchema` in Transkript-Ereignisversion 2. Der einmalige
Migrationsbefehl verwendet das private V1-Schema, schreibt das aktive
Transkript atomar auf V2 und archiviert den alten Ereignis-Hash im Audit;
`chatTranscriptEventStorageSchema` enthält danach keinen V1-Zweig.
Eindeutigkeit lautet `node:${nodeId}` beziehungsweise `edge:${edgeId}`.

### 7.3 Konkrete Alt-zu-neu-Regel

- `kind: "step"` wird zu `kind: "node"` mit der beim Prozessumzug erzeugten
  `step-<n>`-ID für dieses `stepId`.
- `kind: "transition"` wird zu `kind: "edge"` mit der zugeordneten
  `edge-<n>`-ID, wenn die lineare Altbeziehung als direkte Kante existiert.
- `label`, `nameSnapshot` und `understandingRevision` bleiben bytegleich.
- Existiert die abgeleitete ID im aktuellen `flow`, ist die Mention gültig.
- Existiert keine direkte Kante, wird die Mention als historischer, nicht
  aktivierbarer Transkriptbezug ohne `ChatMentionTarget` erhalten. Es wird
  keine „ähnliche“ Kante geraten.

Das letzte Verhalten ist wichtig für alte lineare Übergänge, an deren Stelle
die V3-Migration ein Gateway eingefügt hat. Eine alte Relation von Schritt A
zu Schritt B umfasst dann zwei Kanten und lässt sich nicht ehrlich auf genau
eine davon reduzieren.

### 7.4 UI-Auflösung

`ChatMentionTarget` wird zu `{ kind: "node"; nodeId } | { kind: "edge";
edgeId }`. `isChatMentionTargetAvailable()` prüft nur noch die jeweilige
ID-Menge. `resolveChatMention()` leitet den aktuellen Anzeigenamen ab aus:

- Startknoten: `trigger.value`;
- Schrittknoten: `steps[].order` und `steps[].name` über `stepId`;
- Gateway: `question`;
- Endknoten: `outcome.value`;
- Kante: `label`, andernfalls Namen von Quell- und Zielknoten.

`process-chat-page.tsx`, Composer, Transcript, Tracker und Diagramm verwenden
für Keys, Fokus und Snapshot-Erzeugung ebenfalls nur `nodeId` oder `edgeId`.
Die lineare Indexregel entfällt vollständig.

`ChatCaptureService.startTurn()` beschreibt Mentions gegenüber dem Agenten als
„Knoten-ID …“ oder „Kanten-ID …“. Es gibt keine synthetische Von-/Zu-Relation
mehr. `nameSnapshot` bleibt Kontext, nie Identität.

## 8. Inventar der heutigen `decisions[]`-Leser

Die Suche nach `.decisions`, `nextStepId`, `processDecisionSchema` und den
Entscheidungskomponenten ergibt folgende produktive Stellen. Das globale
Faktenfeld `understanding.decisions` ist getrennt aufgeführt, weil es nicht
`step.decisions[]` ist.

### 8.1 Domain und Storage

- `packages/domain/src/process-understanding.ts`: Der aktuelle Vertrag enthält
  V3, Graph-Validierung und AI-Normalisierung. Die einmalige Migration hält
  ihre V2-Decoder und die V2→V3-Projektion außerhalb der Laufzeitleser.
- `packages/domain/src/process-understanding-editing.ts`: Neue Schritte legen
  zugleich einen `step`-Knoten an; `referencesToStep()` sucht eingehende
  Flow-Kanten; Löschen entfernt den Schrittknoten und seine Kanten nur nach
  expliziter Behandlung aller Referenzen; Verschieben ändert weiterhin nur
  `steps[].order`, nie die Graphkante.
- `packages/storage/src/process-capture-repository.ts`: `globalFactNames`
  entfernt das globale `decisions`; Korrekturvergleiche behandeln `flow` als
  eigenen strukturellen Teil und protokollieren dessen Änderung.

### 8.2 Web

- `apps/web/src/components/process-brief.tsx`: `firstInvalidField()` prüft
  Gateway-Frage und Kantenlabel sowie unbekannte Knotenreferenzen; der
  `processUnderstandingSchema.safeParse()` bleibt die abschließende Prüfung.
- `apps/web/src/components/process-step-card.tsx`: Übergibt nicht mehr
  `step.decisions`, sondern das aus dem einmal geparsten Graphen abgeleitete
  direkte Gateway samt seinen ausgehenden Kanten.
- `apps/web/src/components/process-step-decisions.tsx`: Der aktuelle
  Decision-/Option-Editor wird zu einem Gateway-/Kanten-Editor; Frage und Modus
  ändern den Gateway-Knoten, Option/Feststellung/Folge/Ziel ändern eine Kante.
- `apps/web/src/components/process-step-details.tsx`: `CompactDecisions` und
  die Editdarstellung verwenden denselben Graph-Selector statt des
  Schrittarrays; sie speichern keine abgeleiteten Besitz- oder
  Reihenfolgenreferenzen zurück.
- `apps/web/src/components/process-step-delete-dialog.tsx`: Verweise werden
  über eingehende Kanten zum `step`-Knoten angezeigt; der Quelltext kommt je
  nach Quellknoten aus Gateway-Frage oder Schrittname.

### 8.3 Diagramm und schmale Spalte

- `apps/web/src/components/process-flow-diagram.tsx` liest heute noch keine
  echten `decisions[]`, sondern erzeugt bei mindestens drei Schritten fest
  synthetische Start-, Gateway- und Endknoten sowie „Ja“/„Nein“-Kanten. Dieser
  gesamte `proto`-Zweig, `prototypeMention()` und die synthetische lineare
  `mentionEdge()`-Ableitung werden entfernt. React-Flow-Knoten und -Kanten
  entstehen ausschließlich aus `understanding.flow`; eine Kante auf einen
  Knoten mit kleinerem
  `steps[].order` erhält den vorhandenen `gutter`-Edge-Typ und wird aus der
  dagre-Rangberechnung ausgeschlossen.
- `apps/web/src/components/process-tracker.tsx` leitet Übergänge heute aus
  benachbarten `steps[]` ab. Die schmale, bereits entschiedene Chip-Spalte
  rendert künftig die Graphknoten und beschrifteten Kanten und fokussiert deren
  echte IDs.

### 8.4 Nachgelagerte Potenzialanalyse

- `packages/domain/src/opportunity-discovery.ts` greift nicht direkt auf
  `step.decisions[]` zu, bettet aber das vollständige `understanding` in den
  bestätigten Snapshot ein. Snapshot-Schema und Storage-Migration wechseln auf
  V3; die Zuordnung der Hypothesen zu `steps[].id` bleibt unverändert.
- Die Opportunity-Prompts erhalten den vollständigen Graphen statt
  Schrittentscheidungen. Sie bleiben read-only und erzeugen weder Flow-Knoten
  noch Kanten.

### 8.5 Verträge, Fixtures und Tests

- `defaults/ai-schemas/process-understanding.json` entfernt `decision`,
  `decisionOption` und `step.decisions`, ergänzt dafür die vollständigen
  `$defs` für Flow-Knoten und Kanten.
- `defaults/prompts/process-chat.md` und
  `defaults/prompts/process-synthesis.md` wechseln auf das Graphvokabular.
- `tests/process-fixtures.ts` baut V3-Graphen; separate V2-Fixtures bleiben nur
  für Migrationstests.
- `tests/process-domain.test.ts`, `tests/process-ai-contract.test.ts`,
  `tests/process-api.test.ts`, `tests/process-storage.test.ts`,
  `tests/chat-storage.test.ts`, `tests/chat-domain.test.ts`,
  `tests/chat-presentation.test.ts`, `tests/chat-api.test.ts`,
  `tests/chat-ui.test.ts`, `tests/opportunity-domain.test.ts`,
  `tests/opportunity-ai-contract.test.ts` und `tests/demo-data.test.ts` werden
  auf Graphregeln, Mention-IDs und V2→V3-Migration umgestellt.

Das globale Themenfeld `decisions-controls-handoffs` und das Arbeitsmerkmal
`uncertain-decisions` bleiben unverändert. Sie sind Capture-Eingaben, keine
persistierte zweite Entscheidungsstruktur.

## 9. Demo-Daten und Seed

`demo-data/szenarien/kfz-glasschaden/verstaendnis.json` ist der geeignete
Referenzfall, weil es bereits Deckungs-, Rechnungs- und Empfängerentscheidungen
enthält. Der V3-Datensatz wird so geändert:

1. `schemaVersion` wird 3; das globale `decisions` und alle
   `steps[].decisions` entfallen.
2. `flow.nodes` enthält Start, Ende, genau einen Knoten je Schritt und je ein
   Gateway für Deckung, Rechnungsplausibilität und Zahlungsempfänger.
3. Für die Rechnungsrückfrage wird ein eigener Schritt „Rückfrage bei Werkstatt
   klären“ ergänzt. Der Zweig „Nicht plausibel“ führt dorthin; dessen Ausgang
   führt zurück zum früheren Schritt „Rechnung prüfen“. Der Zweig „Plausibel“
   führt weiter zur Berechnung. Damit enthält der Datensatz eine echte
   Verzweigung samt Rücksprung, nicht nur eine Selbstkante.
4. Wegen des vorläufig einzigen Endknotens wird `outcome.value` fachlich breit
   genug formuliert, dass sowohl regulierte als auch dokumentiert abgelehnte
   Fälle dort enden können. Die Kantenfolge erklärt den konkreten Ausgang.
5. Die bisherigen `determination`- und `consequence`-Texte wandern unverändert
   auf die jeweiligen Gateway-Kanten; die bisherigen Optionslabels werden
   knappe Antwortlabels.

`scripts/seed-demo-process.ts` parst `verstaendnis.json` bereits vor dem
Schreiben. Es muss deshalb keine Graphableitung enthalten. Es wird nur auf V3
umgestellt und behält die bestehende Remap-Logik für Upload- und
Chat-Evidenz-IDs. Flow-IDs werden nicht umgeschrieben.

`tests/demo-data.test.ts` ergänzt neben dem allgemeinen Schema-Parse eine
explizite Schutzregel: Mindestens ein Demo-Verständnis enthält ein Gateway mit
mindestens zwei ausgehenden Kanten und mindestens eine Kante von einem
späteren Schrittpfad auf einen Schritt mit kleinerer `order`. So kann die
Demoanforderung nicht durch spätere Datenbereinigung unbemerkt verschwinden.

Der Seed-Abnahmelauf ist:

```sh
bun run seed kfz-glasschaden --stufe bestaetigt
```

Danach müssen der bestätigte Prozess und sein Opportunity-Snapshot mit V3
lesbar sein; das Diagramm muss die Rechnungsrückfrage als Gutter-Rückkante
darstellen.

## 10. Prüfszenarien für die spätere Umsetzung

### Domain

- Minimaler Graph: Start → ein Schritt → Ende ist gültig.
- Zwei Start- oder Endknoten scheitern mit Pfad `flow.nodes`.
- Unbekannte Quellen und Ziele scheitern am konkreten Kantenfeld.
- Doppelte Knoten-, Kanten- und graphweit kollidierende IDs scheitern.
- Ein unerreichbarer Knoten scheitert.
- Ein erreichbarer, geschlossener Zyklus ohne Weg zum Ende scheitert.
- Ein Gateway mit einer Kante oder einer unbeschrifteten Kante scheitert.
- Ein Schritt mit zwei direkten Ausgängen scheitert.
- Fehlende, doppelte oder unbekannte `stepId`-Referenzen scheitern.
- Ein Rücksprung mit zusätzlichem Weg zum Ende ist gültig.

### Migration

- Unversioniert und V2 → V3 ist im einmaligen Migrationslauf deterministisch.
- V2 ohne Entscheidungen wird zum linearen Graphen.
- V2 mit einer vollständigen Entscheidung wird zu Gateway-Kanten.
- `nextStepId: null` führt zum Ende.
- Eine unvollständige oder mehrfache Entscheidung erzeugt linearen Flow plus
  präfixierte Wissenslücke.
- Hauptdatei, Chat-Arbeitsdatei, letzter gültiger Chat-Stand,
  Opportunity-Snapshot und eingefrorener Vertrag werden atomar auf V3,
  Transkript-Ereignisse auf V2 geschrieben und erhalten einen Audit-Eintrag.
- Ein abgebrochener Lauf setzt idempotent fort; Laufzeitleser akzeptieren
  danach ausschließlich V3.

### Capture

- Ein neuer Prozess friert Prompt und Schema V3 ein.
- Ein migrierter Prozess erhält vor dem nächsten Zug den V3-Vertrag;
  der Audit-Eintrag enthält den früheren Vertrags-Hash.
- Ein gültiger Write veröffentlicht eine neue Revision.
- Ein ungültiger Write lässt die letzte gültige Revision unangetastet.
- `verify_process_flow` gibt nur `ok` oder eine strukturierte Fehlerliste
  zurück und prüft Schema plus alle Graph-Guardrails.
- Der Agent beendet den Turn erst nach einem grünen Tool-Ergebnis; die
  Fehlerliste bleibt intern.

### Mentions und UI-Verbrauch

- Neue Knoten- und Kantenmentions bleiben nach Umbenennung gültig.
- Löschen der referenzierten ID macht den Chip historisch und inaktiv.
- Eine Rücksprungkante ist aktivierbar, obwohl ihr Ziel eine kleinere
  Schrittordnung hat.
- Alte Schrittmentions werden deterministisch zum Schrittknoten migriert.
- Alte Übergangsmentions ohne direkte V3-Kante bleiben historisch, statt auf
  einen Gateway-Zweig umgedeutet zu werden.
- Diagramm und schmale Spalte erzeugen keine synthetischen IDs mehr.

## 11. Voraussichtliche Dateien einer späteren Umsetzung

### Domain, Storage und Server

- `packages/domain/src/process-understanding.ts`
- `packages/domain/src/process-understanding-editing.ts`
- `packages/domain/src/chat-capture.ts`
- `packages/domain/src/opportunity-discovery.ts`
- `packages/storage/src/process-capture-repository.ts`
- `packages/storage/src/chat-capture-repository.ts`
- `apps/server/src/chat-capture-service.ts`
- `apps/server/src/chat-turn-runner.ts`

### Verträge und UI-Abnehmer

- `defaults/ai-schemas/process-understanding.json`
- `defaults/prompts/process-chat.md`
- `defaults/prompts/process-synthesis.md`
- `apps/web/src/components/chat-mention.tsx`
- `apps/web/src/components/process-flow-diagram.tsx`
- `apps/web/src/components/process-tracker.tsx`
- `apps/web/src/components/process-step-decisions.tsx`
- `apps/web/src/components/process-step-details.tsx`
- `apps/web/src/components/process-step-card.tsx`
- `apps/web/src/components/process-step-delete-dialog.tsx`
- `apps/web/src/components/process-brief.tsx`
- `apps/web/src/components/process-chat-composer.tsx`
- `apps/web/src/components/process-chat-transcript.tsx`
- `apps/web/src/pages/process-chat-page.tsx`

### Demo und Tests

- `demo-data/szenarien/kfz-glasschaden/verstaendnis.json`
- `scripts/seed-demo-process.ts`
- die in Abschnitt 8.5 genannten Testdateien

## 12. Entschieden

### 1. Schritt-Bijektion

Jeder Eintrag in `steps[]` hat genau einen `step`-Knoten und jeder
`step`-Knoten referenziert genau einen bestehenden Schritt.[^decision-1]

### 2. Globales Entscheidungsfakt

`understanding.decisions` entfällt in V3; `flow` ist die einzige persistierte
Quelle für Ablauf und Entscheidungen.[^decision-2]

### 3. Start- und Endtexte

Start- und Endknoten speichern keinen Text. Die UI leitet ihn aus
`trigger.value` beziehungsweise `outcome.value` ab.[^decision-3]

### 4. Kanonischer Graph

Jeder Knoten und jede Kante ist in `flow` genau einmal definiert. Es gibt
keine Duplikat-Informationen, `afterStepId`, `ownerStepId` oder
Doppelverkettung; das Frontend parst den Graphen einmal und leitet alle
Zugehörigkeiten ab.[^decision-4]

### 5. Graph-IDs

Graphobjekte verwenden ausschließlich typbasierte Ordinal-IDs: `start`,
`end`, `step-<n>`, `xor-<n>` und `edge-<n>`. Die Regex und alle Beispiele
folgen dieser Regel.[^decision-5]

### 6. Graphgröße

`flow.nodes` ist auf 64 und `flow.edges` auf 128 Einträge begrenzt.[^decision-6]

### 7. Bestandsmigration

Alle Bestandsdateien werden vor normalem Betrieb einmalig atomar in-place auf
V3 migriert; danach gibt es keine Legacy-Leser oder optionales `flow` mehr.
Lineare Altbestände werden deterministisch übertragen, Unklares wird als
Wissenslücke markiert.[^decision-7]

### 8. Nicht eindeutig migrierbare Entscheidungen

Mehrdeutige Altentscheidungen erzeugen einen linearen Verlauf und eine
präfixierte Wissenslücke; die Migration erfindet keine Zweige oder Ziele.[^decision-8]

### 9. Optionale Kantenfelder

`label`, `determination` und `consequence` fehlen bei Nichtverwendung;
`label` ist nur an Gateway-Ausgängen verpflichtend.[^decision-9]

### 10. Ungültiger Agent-Output

Der Agent schreibt den Kandidaten und verifiziert ihn im selben Turn mit
`verify_process_flow`, bis das Tool `ok` meldet. Die interne strukturierte
Fehlerliste steuert die Korrektur; eine Rewrite-Zählung gibt es nicht.[^decision-10]

[^decision-1]: Verworfen: fehlende oder mehrfach referenzierte Schritte.

[^decision-2]: Verworfen: persistierte oder abgeleitete Entscheidungszusammenfassung.

[^decision-3]: Verworfen: zweiter Ereignistext oder Faktenreferenz am Ereignisknoten.

[^decision-4]: Verworfen: rückwärts gerichtete Besitz- und Reihenfolgenfelder.

[^decision-5]: Verworfen: freie Namespace-IDs, UUIDs und inhaltsabgeleitete IDs.

[^decision-6]: Verworfen: unbegrenzte oder niedrigere Graphlimits.

[^decision-7]: Verworfen: dauerhafter Legacy-Adapter und Laufzeit-Fallback.

[^decision-8]: Verworfen: Migrationsabbruch oder synthetische Prozesslogik.

[^decision-9]: Verworfen: überall nullable oder überall verpflichtende Kantenfelder.

[^decision-10]: Verworfen: begrenzte Rewrite-Zählung, reiner Fallback und zweiter Provider-Zug.
