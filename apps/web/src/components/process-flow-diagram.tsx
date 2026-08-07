import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  getBezierPath,
  type Edge,
  type EdgeProps,
  type NodeProps,
  type ReactFlowInstance,
} from "@xyflow/react";
import dagre from "@dagrejs/dagre";
import { Info, MessageCircle, X } from "lucide-react";
import type { ChatMention, ProcessUnderstanding } from "../lib/process-types";
import type { ChatMentionTarget } from "./chat-mention";
import { ProcessStepDetails } from "./process-step-details";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Skeleton } from "./ui/skeleton";

export function ProcessFlowDiagramSkeleton({
  className,
}: {
  className?: string;
}) {
  return (
    <div
      className={`flex h-full min-h-0 items-center justify-center bg-muted/30 p-6 ${className ?? ""}`}
      role="status"
      aria-busy="true"
      aria-label="Prozessbild wird geladen"
    >
      <span className="sr-only">Prozessbild wird geladen</span>
      <Skeleton className="h-32 w-80 rounded-xl" />
    </div>
  );
}

type StepNodeData = {
  order: number;
  name: string;
  activity: string;
  mention: ChatMention;
  onMention?: (mention: ChatMention) => void;
  onInspect?: () => void;
  focused?: boolean;
};

const StepNode = memo(function StepNode({ data }: NodeProps) {
  const value = data as unknown as StepNodeData;
  return (
    // Die Höhe wächst mit dem Inhalt statt fest zu stehen: Bei `h-48` blieb
    // unter dem Text die halbe Karte leer. `min-h` hält kurze Schritte trotzdem
    // auf einer gemeinsamen Grundfläche.
    <div
      className={`group grid min-h-28 w-80 gap-2 overflow-hidden rounded-xl border border-border bg-card p-4 ${value.focused ? "ring-2 ring-primary ring-offset-2" : ""}`}
    >
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <div className="flex items-start gap-2">
        {/* Gleicher Nummernkreis wie in der schmalen Spalte: `size-5` bleibt
            innerhalb der ersten Titelzeile, `size-6` hing zwei Pixel darunter. */}
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-caption text-primary-foreground">
          {value.order}
        </span>
        {/*
          `hyphens-auto`: Deutsche Komposita wie „Zuständigkeitsklärung" sind
          länger als die Spalte und wurden sonst mitten im Wort umbrochen.
        */}
        <p
          className="line-clamp-3 min-w-0 flex-1 hyphens-auto break-words font-semibold leading-snug"
          title={value.name}
        >
          {value.name}
        </p>
        {/*
          `pointer-events-auto` ist nötig, weil React Flow die Knoten ohne
          Auswahl und ohne Ziehen auf `pointer-events: none` setzt; aus
          demselben Grund sind beide Knöpfe dauerhaft sichtbar statt beim
          Überfahren der Karte einzublenden — ein Hover auf der Karte kommt gar
          nicht erst an.
        */}
        <div className="pointer-events-auto flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            className="nodrag rounded-md p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            onClick={() => value.onInspect?.()}
            aria-label={`Schritt ${value.order} im Detail ansehen`}
            title="Details ansehen"
          >
            <Info className="size-4" />
          </button>
          {value.onMention && (
            <button
              type="button"
              className="nodrag rounded-md p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              onClick={() => value.onMention?.(value.mention)}
              aria-label={`Schritt ${value.order} im Gespräch erwähnen`}
              title="Im Gespräch erwähnen"
            >
              <MessageCircle className="size-4" />
            </button>
          )}
        </div>
      </div>
      {/* Über die volle Breite, nicht neben dem Nummernkreis eingerückt — wie
          in der schmalen Spalte. Hier ohne `hyphens-auto`: Im Fließtext setzt
          die Silbentrennung in fast jeder Zeile einen Bindestrich. */}
      <p
        className="line-clamp-3 break-words text-ui text-muted-foreground"
        title={value.activity}
      >
        {value.activity}
      </p>
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  );
});

function MentionEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerStart,
  markerEnd,
  style,
  data,
}: EdgeProps) {
  const [hovered, setHovered] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    },
    [],
  );
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });
  const mentionData = data as
    | {
        mention: ChatMention;
        onMention?: (mention: ChatMention) => void;
        text?: string;
      }
    | undefined;
  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerStart={markerStart}
        markerEnd={markerEnd}
        style={style}
        interactionWidth={0}
      />
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={24}
        className="react-flow__edge-interaction"
        // React Flow setzt Kanten ohne Selektierbarkeit auf `pointer-events: none`, daher hier explizit.
        style={{ pointerEvents: "stroke" }}
        onMouseEnter={() => {
          if (hideTimer.current) clearTimeout(hideTimer.current);
          setHovered(true);
        }}
        onMouseLeave={() => {
          hideTimer.current = setTimeout(() => setHovered(false), 120);
        }}
      />
      {mentionData?.text && (
        <EdgeLabelRenderer>
          <span
            className="absolute rounded bg-card px-1.5 py-0.5 text-caption text-muted-foreground"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
          >
            {mentionData.text}
          </span>
        </EdgeLabelRenderer>
      )}
      {mentionData?.onMention && (
        <EdgeLabelRenderer>
          <button
            type="button"
            className={`nodrag nopan absolute flex size-8 items-center justify-center rounded-full border bg-card text-muted-foreground transition hover:text-primary focus:opacity-100 ${hovered ? "opacity-100" : "opacity-0"}`}
            style={{
              transform: `translate(-50%, -50%) translate(${labelX + 26}px, ${labelY}px)`,
              pointerEvents: "all",
            }}
            onClick={() => mentionData.onMention?.(mentionData.mention)}
            onMouseEnter={() => {
              if (hideTimer.current) clearTimeout(hideTimer.current);
              setHovered(true);
            }}
            onMouseLeave={() => setHovered(false)}
            aria-label={`${mentionData.mention.label} im Gespräch erwähnen`}
            title="Übergang im Gespräch erwähnen"
          >
            <MessageCircle className="size-4" />
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

/**
 * PROTOTYP (Ticket #6, Wegwerf-Branch): BPMN-light-Knoten nach der
 * Ikonografie-Recherche — Start dünner Kreis, Ende dicker Kreis, XOR-Raute
 * mit ×; Frage am Gateway, Antworten an den Kanten. Konturen neutral, Grün
 * bleibt dem Fokus vorbehalten.
 */
const EventNode = memo(function EventNode({ data }: NodeProps) {
  const value = data as unknown as {
    kind: "start" | "end";
    label: string;
    mention: ChatMention;
    onMention?: (mention: ChatMention) => void;
  };
  const end = value.kind === "end";
  return (
    <div className="pointer-events-auto group relative flex w-[200px] flex-col items-center gap-1.5">
      {end && (
        <Handle
          type="target"
          position={Position.Top}
          className="opacity-0"
          style={{ top: -8 }}
        />
      )}
      <span className="relative block size-10">
        <span
          aria-hidden="true"
          className={
            end
              ? "block size-10 rounded-full border-4 border-foreground bg-card"
              : "block size-10 rounded-full border-[1.5px] border-muted-foreground bg-card"
          }
        />
      </span>
      {value.onMention && (
        <button
          type="button"
          className="nodrag absolute left-[calc(50%+26px)] top-2 rounded-md p-1 text-muted-foreground opacity-0 transition hover:bg-accent hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring group-hover:opacity-100"
          onClick={() => value.onMention?.(value.mention)}
          aria-label={`${value.mention.label} im Gespräch erwähnen`}
          title="Im Gespräch erwähnen"
        >
          <MessageCircle className="size-4" />
        </button>
      )}
      <span className="max-w-full text-center text-ui text-muted-foreground">
        {value.label}
      </span>
      {!end && (
        <Handle
          type="source"
          position={Position.Bottom}
          className="opacity-0"
        />
      )}
    </div>
  );
});

const GatewayNode = memo(function GatewayNode({ data }: NodeProps) {
  const value = data as unknown as {
    question: string;
    mention: ChatMention;
    onMention?: (mention: ChatMention) => void;
  };
  return (
    <div className="pointer-events-auto group flex w-[260px] flex-col items-center gap-1.5">
      <Handle
        type="target"
        position={Position.Top}
        className="opacity-0"
        style={{ top: -8 }}
      />
      <span className="relative flex size-11 items-center justify-center">
        <span
          aria-hidden="true"
          className="absolute inset-[3px] rotate-45 rounded-[3px] border-[1.5px] border-muted-foreground bg-card"
        />
        <X
          className="relative size-4 text-muted-foreground"
          strokeWidth={2}
          aria-hidden="true"
        />
        {value.onMention && (
          <button
            type="button"
            className="nodrag absolute left-[calc(50%+36px)] rounded-md p-1 text-muted-foreground opacity-0 transition hover:bg-accent hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring group-hover:opacity-100"
            onClick={() => value.onMention?.(value.mention)}
            aria-label={`${value.mention.label} im Gespräch erwähnen`}
            title="Im Gespräch erwähnen"
          >
            <MessageCircle className="size-4" />
          </button>
        )}
      </span>
      <span className="max-w-full text-center text-ui font-medium">
        {value.question}
      </span>
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
      {/* Eigener Ausgang am linken Rautenzipfel für die Rückkante. */}
      <Handle
        id="alt"
        type="source"
        position={Position.Left}
        className="opacity-0"
        style={{ top: 22, left: "calc(50% - 26px)" }}
      />
    </div>
  );
});

/** Orthogonaler Pfad mit abgerundeten Ecken für die Gutter-Rückkante. */
function roundedOrthPath(points: Array<[number, number]>, radius: number) {
  let d = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = points[i - 1];
    const [cx, cy] = points[i];
    const [nx, ny] = points[i + 1];
    const r = Math.min(
      radius,
      Math.hypot(cx - px, cy - py) / 2,
      Math.hypot(nx - cx, ny - cy) / 2,
    );
    const bx = cx === px ? cx : cx - Math.sign(cx - px) * r;
    const by = cy === py ? cy : cy - Math.sign(cy - py) * r;
    const ax = cx === nx ? cx : cx + Math.sign(nx - cx) * r;
    const ay = cy === ny ? cy : cy + Math.sign(ny - cy) * r;
    d += ` L ${bx} ${by} Q ${cx} ${cy} ${ax} ${ay}`;
  }
  const [lx, ly] = points[points.length - 1];
  return `${d} L ${lx} ${ly}`;
}

/**
 * Rücksprung-Kante: dagre kennt kein Edge-Routing, also führt die Schleife
 * von Hand durch eine Gutter-Spalte links an den Karten vorbei (Empfehlung
 * aus docs/research/layout-engine-react-flow.md).
 */
function GutterEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  markerEnd,
  style,
  data,
}: EdgeProps) {
  const [hovered, setHovered] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    },
    [],
  );
  const edgeData = data as
    | {
        gutterX?: number;
        label?: string;
        mention: ChatMention;
        onMention?: (mention: ChatMention) => void;
      }
    | undefined;
  const gutterX = edgeData?.gutterX ?? sourceX - 140;
  const aboveY = targetY - 28;
  const path = roundedOrthPath(
    [
      [sourceX, sourceY],
      [gutterX, sourceY],
      [gutterX, aboveY],
      [targetX, aboveY],
      [targetX, targetY],
    ],
    10,
  );
  const labelY = (sourceY + aboveY) / 2;
  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        style={style}
        interactionWidth={0}
      />
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={24}
        className="react-flow__edge-interaction"
        // React Flow setzt Kanten ohne Selektierbarkeit auf `pointer-events: none`, daher hier explizit.
        style={{ pointerEvents: "stroke" }}
        onMouseEnter={() => {
          if (hideTimer.current) clearTimeout(hideTimer.current);
          setHovered(true);
        }}
        onMouseLeave={() => {
          hideTimer.current = setTimeout(() => setHovered(false), 120);
        }}
      />
      {edgeData?.label && (
        <EdgeLabelRenderer>
          <span
            className="absolute rounded bg-card px-1.5 py-0.5 text-caption text-muted-foreground"
            style={{
              transform: `translate(-50%, -50%) translate(${gutterX}px, ${labelY}px)`,
            }}
          >
            {edgeData.label}
          </span>
        </EdgeLabelRenderer>
      )}
      {edgeData?.onMention && (
        <EdgeLabelRenderer>
          <button
            type="button"
            className={`nodrag nopan absolute flex size-8 items-center justify-center rounded-full border bg-card text-muted-foreground transition hover:text-primary focus:opacity-100 ${hovered ? "opacity-100" : "opacity-0"}`}
            style={{
              transform: `translate(-50%, -50%) translate(${gutterX}px, ${labelY + 20}px)`,
              pointerEvents: "all",
            }}
            onClick={() => edgeData.onMention?.(edgeData.mention)}
            onMouseEnter={() => {
              if (hideTimer.current) clearTimeout(hideTimer.current);
              setHovered(true);
            }}
            onMouseLeave={() => setHovered(false)}
            aria-label={`${edgeData.mention.label} im Gespräch erwähnen`}
            title="Übergang im Gespräch erwähnen"
          >
            <MessageCircle className="size-4" />
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

const nodeTypes = {
  step: StepNode,
  bpmnEvent: EventNode,
  gateway: GatewayNode,
};
const edgeTypes = { mention: MentionEdge, gutter: GutterEdge };

export function ProcessFlowDiagram({
  understanding,
  status,
  updating,
  onMention,
  className,
  focusedTarget,
}: {
  understanding: ProcessUnderstanding | null;
  status: "missing" | "invalid" | "valid";
  updating: boolean;
  onMention?: (mention: ChatMention) => void;
  className?: string;
  focusedTarget?: ChatMentionTarget | null;
}) {
  const flowRef = useRef<ReactFlowInstance<any, any> | null>(null);
  const [inspectStepId, setInspectStepId] = useState<string | null>(null);
  const steps = understanding?.steps ?? [];
  const inspectStep = steps.find((step) => step.id === inspectStepId) ?? null;
  const graph = useMemo(() => {
    const steps = understanding?.steps ?? [];
    const stepNodes = steps.map((step) => ({
      id: step.id,
      type: "step",
      position: { x: 0, y: 0 },
      data: {
        order: step.order,
        name: step.name,
        activity: step.activity,
        mention: {
          kind: "step" as const,
          stepId: step.id,
          label: `Schritt-${step.order}`,
          nameSnapshot: null,
          understandingRevision: null,
        },
        onMention,
        onInspect: () => setInspectStepId(step.id),
        focused:
          focusedTarget?.kind === "step" && focusedTarget.stepId === step.id,
      },
    }));
    const mentionEdge = (
      step: (typeof steps)[number],
      next: (typeof steps)[number],
    ) => {
      return {
        id: `${step.id}-${next.id}`,
        source: step.id,
        target: next.id,
        type: "mention",
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: "var(--muted-foreground)",
        },
        data: {
          mention: {
            kind: "transition" as const,
            fromStepId: step.id,
            toStepId: next.id,
            label: `Übergang-${step.order}-${next.order}`,
            nameSnapshot: null,
            understandingRevision: null,
          },
          onMention,
        },
        style: {
          stroke:
            focusedTarget?.kind === "transition" &&
            focusedTarget.fromStepId === step.id &&
            focusedTarget.toStepId === next.id
              ? "var(--primary)"
              : "var(--muted-foreground)",
          strokeWidth:
            focusedTarget?.kind === "transition" &&
            focusedTarget.fromStepId === step.id &&
            focusedTarget.toStepId === next.id
              ? 3
              : 1,
        },
      };
    };

    // PROTOTYP: hart verdrahteter BPMN-light-Fluss um die vorhandenen
    // Schritte — Start, Gateway nach Schritt 2 (Ja → Schritt 3,
    // Nein → Rücksprung zu Schritt 1), Ende.
    const proto = steps.length >= 3;
    // PROTOTYP-BEHELF bis Schema-Delta #8: BPMN-Knoten und -Kanten erhalten
    // vorläufig Step-/Transition-Mentions mit sprechenden Klartext-Labels.
    const prototypeMention = (
      label: string,
      fromStepId: string,
      toStepId: string,
    ): ChatMention => ({
      kind: "transition",
      fromStepId,
      toStepId,
      label,
      nameSnapshot: null,
      understandingRevision: null,
    });
    const zero = { x: 0, y: 0 };
    const nodes: Array<{
      id: string;
      type: string;
      position: { x: number; y: number };
      data: Record<string, unknown>;
    }> = proto
      ? [
          {
            id: "start",
            type: "bpmnEvent",
            position: zero,
            data: {
              kind: "start",
              label: "Glasschadenfall gemeldet",
              mention: {
                kind: "step",
                stepId: steps[0].id,
                label: 'Start „Glasschadenfall gemeldet"',
                nameSnapshot: null,
                understandingRevision: null,
              },
              onMention,
            },
          },
          ...stepNodes,
          {
            id: "gw1",
            type: "gateway",
            position: zero,
            data: {
              question: "Kann sofort reguliert werden?",
              mention: {
                kind: "step",
                stepId: steps[1].id,
                label: 'Verzweigung „Kann sofort reguliert werden?"',
                nameSnapshot: null,
                understandingRevision: null,
              },
              onMention,
            },
          },
          {
            id: "end",
            type: "bpmnEvent",
            position: zero,
            data: {
              kind: "end",
              label: "Fall abgeschlossen",
              mention: {
                kind: "step",
                stepId: steps[2].id,
                label: 'Ende „Fall abgeschlossen"',
                nameSnapshot: null,
                understandingRevision: null,
              },
              onMention,
            },
          },
        ]
      : stepNodes;
    const plainEdge = (
      id: string,
      source: string,
      target: string,
      mention: ChatMention,
      text?: string,
    ) => ({
      id,
      source,
      target,
      type: "mention",
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: "var(--muted-foreground)",
      },
      style: { stroke: "var(--muted-foreground)", strokeWidth: 1 },
      data: { mention, onMention, ...(text ? { text } : {}) },
    });
    const backEdgeData: {
      label: string;
      gutterX?: number;
      mention: ChatMention;
      onMention?: (mention: ChatMention) => void;
    } | null = proto
      ? {
          label: "Nein — Unterlagen fehlen",
          mention: prototypeMention(
            'Rücksprung „Nein — Unterlagen fehlen"',
            steps[1].id,
            steps[0].id,
          ),
          onMention,
        }
      : null;
    const edges: Edge[] = proto
      ? [
          plainEdge(
            "start-edge",
            "start",
            steps[0].id,
            prototypeMention('Übergang „Start"', steps[0].id, steps[0].id),
          ),
          mentionEdge(steps[0], steps[1]),
          plainEdge(
            "to-gateway",
            steps[1].id,
            "gw1",
            prototypeMention(
              'Übergang „zur Verzweigung"',
              steps[1].id,
              steps[1].id,
            ),
          ),
          plainEdge(
            "gateway-ja",
            "gw1",
            steps[2].id,
            prototypeMention('Übergang „Ja"', steps[1].id, steps[2].id),
            "Ja",
          ),
          plainEdge(
            "to-end",
            steps[2].id,
            "end",
            prototypeMention(
              'Übergang „zum Abschluss"',
              steps[2].id,
              steps[2].id,
            ),
          ),
          {
            id: "gateway-nein",
            source: "gw1",
            target: steps[0].id,
            type: "gutter",
            sourceHandle: "alt",
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: "var(--muted-foreground)",
            },
            style: { stroke: "var(--muted-foreground)", strokeWidth: 1 },
            data: backEdgeData ?? undefined,
          },
        ]
      : steps
          .slice(0, -1)
          .map((step, index) => mentionEdge(step, steps[index + 1]));

    // dagre rechnet nur über die Vorwärtskanten — die Rückkante würde die
    // Rangzuweisung kippen und wird stattdessen durch die Gutter geroutet.
    const sizes: Record<string, { width: number; height: number }> = {
      step: { width: 320, height: 150 },
      bpmnEvent: { width: 200, height: 76 },
      gateway: { width: 260, height: 112 },
    };
    const layout = new dagre.graphlib.Graph();
    layout.setGraph({ rankdir: "TB", ranksep: 48, nodesep: 64 });
    layout.setDefaultEdgeLabel(() => ({}));
    for (const node of nodes) layout.setNode(node.id, { ...sizes[node.type] });
    for (const edge of edges)
      if (edge.type !== "gutter")
        layout.setEdge(edge.source as string, edge.target as string);
    dagre.layout(layout);
    for (const node of nodes) {
      const pos = layout.node(node.id);
      const size = sizes[node.type];
      node.position = {
        x: pos.x - size.width / 2,
        y: pos.y - size.height / 2,
      };
    }
    if (backEdgeData)
      backEdgeData.gutterX =
        Math.min(...nodes.map((node) => node.position.x)) - 56;
    return { nodes, edges };
  }, [understanding, onMention, focusedTarget]);
  useEffect(() => {
    if (!flowRef.current || !focusedTarget) return;
    const ids =
      focusedTarget.kind === "step"
        ? [focusedTarget.stepId]
        : [focusedTarget.fromStepId, focusedTarget.toStepId];
    flowRef.current.fitView({
      nodes: ids.map((id) => ({ id })),
      padding: 0.35,
      duration: 250,
    });
  }, [focusedTarget, understanding]);

  if (!graph.nodes.length)
    return (
      <div className="flex h-full min-h-80 items-center justify-center p-8 text-center">
        <div className="max-w-sm">
          <div className="mx-auto mb-5 flex gap-3" aria-hidden="true">
            {[0, 1, 2].map((item) => (
              <Skeleton key={item} className="h-16 flex-1 rounded-lg border" />
            ))}
          </div>
          <p className="font-medium">
            {status === "invalid"
              ? "Das Prozessbild wird noch aufgebaut …"
              : "Aus Ihren Angaben entsteht hier das erste Prozessbild."}
          </p>
          <p className="mt-2 text-ui text-muted-foreground">
            Es erscheint automatisch, sobald ein gültiger Zwischenstand
            vorliegt.
          </p>
        </div>
      </div>
    );

  return (
    <div className={`relative h-full min-h-80 ${className ?? ""}`}>
      {updating && (
        <div className="absolute left-3 top-3 z-10 rounded-full bg-card px-3 py-1 text-caption text-muted-foreground">
          Prozessbild wird aktualisiert …
        </div>
      )}
      <ReactFlow
        nodes={graph.nodes}
        edges={graph.edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        deleteKeyCode={null}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.45}
        maxZoom={1.4}
        onInit={(instance) => {
          flowRef.current = instance;
          if (focusedTarget) {
            const ids =
              focusedTarget.kind === "step"
                ? [focusedTarget.stepId]
                : [focusedTarget.fromStepId, focusedTarget.toStepId];
            instance.fitView({
              nodes: ids.map((id) => ({ id })),
              padding: 0.35,
            });
          }
        }}
      >
        <Background gap={24} size={1} />
        <Controls
          showInteractive={false}
          position="top-right"
          className="!right-3 !top-3"
        />
      </ReactFlow>
      {/* Geschwister des Diagramms, damit Zoom und Neuaufbau der Knoten den Dialog nicht beeinflussen. */}
      {inspectStep && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setInspectStepId(null);
          }}
        >
          {/* `sm:` nötig, weil DialogContent selbst ein `sm:max-w-lg` mitbringt. */}
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>
                Schritt {inspectStep.order}: {inspectStep.name}
              </DialogTitle>
              <DialogDescription>{inspectStep.activity}</DialogDescription>
            </DialogHeader>
            {/* `min-w-0`: Rasterkinder wachsen sonst über den Dialog hinaus. */}
            <div className="min-w-0">
              <ProcessStepDetails step={inspectStep} steps={steps} />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="secondary">Schließen</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
