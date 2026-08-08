import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { resolveChatMention, type ChatMentionTarget } from "./chat-mention";
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
import { ProcessFlowPlaceholder } from "./process-flow-placeholder";

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

type MentionData = {
  mention: ChatMention;
  onMention?: (mention: ChatMention) => void;
};

const StepNode = memo(function StepNode({ data }: NodeProps) {
  const value = data as unknown as MentionData & {
    order: number;
    name: string;
    activity: string;
    onInspect?: () => void;
    focused?: boolean;
  };
  return (
    <div
      className={`group grid min-h-28 w-80 gap-2 overflow-hidden rounded-xl border border-border bg-card p-4 ${value.focused ? "ring-2 ring-primary ring-offset-2" : ""}`}
    >
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <div className="flex items-start gap-2">
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-caption text-primary-foreground">
          {value.order}
        </span>
        <p
          className="line-clamp-3 min-w-0 flex-1 hyphens-auto break-words font-semibold leading-snug"
          title={value.name}
        >
          {value.name}
        </p>
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

const EventNode = memo(function EventNode({ data }: NodeProps) {
  const value = data as unknown as MentionData & {
    kind: "start" | "end";
    label: string;
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
  const value = data as unknown as MentionData & { question: string };
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

function MentionEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
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
  const value = data as (MentionData & { label?: string }) | undefined;
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
        style={{ pointerEvents: "stroke" }}
        onMouseEnter={() => {
          if (hideTimer.current) clearTimeout(hideTimer.current);
          setHovered(true);
        }}
        onMouseLeave={() => {
          hideTimer.current = setTimeout(() => setHovered(false), 120);
        }}
      />
      {value?.label && (
        <EdgeLabelRenderer>
          <span
            className="absolute rounded bg-card px-1.5 py-0.5 text-caption text-muted-foreground"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
          >
            {value.label}
          </span>
        </EdgeLabelRenderer>
      )}
      {value?.onMention && (
        <EdgeLabelRenderer>
          <button
            type="button"
            className={`nodrag nopan absolute flex size-8 items-center justify-center rounded-full border bg-card text-muted-foreground transition hover:text-primary focus:opacity-100 ${hovered ? "opacity-100" : "opacity-0"}`}
            style={{
              transform: `translate(-50%, -50%) translate(${labelX + 26}px, ${labelY}px)`,
              pointerEvents: "all",
            }}
            onClick={() => value.onMention?.(value.mention)}
            onMouseEnter={() => {
              if (hideTimer.current) clearTimeout(hideTimer.current);
              setHovered(true);
            }}
            onMouseLeave={() => setHovered(false)}
            aria-label={`${value.mention.label} im Gespräch erwähnen`}
            title="Übergang im Gespräch erwähnen"
          >
            <MessageCircle className="size-4" />
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

function roundedOrthPath(points: Array<[number, number]>, radius: number) {
  let d = `M ${points[0]![0]} ${points[0]![1]}`;
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = points[i - 1]!;
    const [cx, cy] = points[i]!;
    const [nx, ny] = points[i + 1]!;
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
  const [x, y] = points[points.length - 1]!;
  return `${d} L ${x} ${y}`;
}

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
  const value = data as
    (MentionData & { gutterX?: number; label?: string }) | undefined;
  const gutterX = value?.gutterX ?? sourceX - 140;
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
        style={{ pointerEvents: "stroke" }}
        onMouseEnter={() => {
          if (hideTimer.current) clearTimeout(hideTimer.current);
          setHovered(true);
        }}
        onMouseLeave={() => {
          hideTimer.current = setTimeout(() => setHovered(false), 120);
        }}
      />
      {value?.label && (
        <EdgeLabelRenderer>
          <span
            className="absolute rounded bg-card px-1.5 py-0.5 text-caption text-muted-foreground"
            style={{
              transform: `translate(-50%, -50%) translate(${gutterX}px, ${(sourceY + aboveY) / 2}px)`,
            }}
          >
            {value.label}
          </span>
        </EdgeLabelRenderer>
      )}
      {value?.onMention && (
        <EdgeLabelRenderer>
          <button
            type="button"
            className={`nodrag nopan absolute flex size-8 items-center justify-center rounded-full border bg-card text-muted-foreground transition hover:text-primary focus:opacity-100 ${hovered ? "opacity-100" : "opacity-0"}`}
            style={{
              transform: `translate(-50%, -50%) translate(${gutterX}px, ${(sourceY + aboveY) / 2 + 20}px)`,
              pointerEvents: "all",
            }}
            onClick={() => value.onMention?.(value.mention)}
            onMouseEnter={() => {
              if (hideTimer.current) clearTimeout(hideTimer.current);
              setHovered(true);
            }}
            onMouseLeave={() => setHovered(false)}
            aria-label={`${value.mention.label} im Gespräch erwähnen`}
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
    if (!understanding) return { nodes: [], edges: [] as Edge[] };
    const stepById = new Map(
      understanding.steps.map((step) => [step.id, step]),
    );
    const nodeById = new Map(
      understanding.flow.nodes.map((node) => [node.id, node]),
    );
    const nodeOrder = (id: string): number => {
      const node = nodeById.get(id);
      if (node?.kind === "step") return stepById.get(node.stepId)?.order ?? 0;
      if (node?.kind === "gateway") {
        const incoming = understanding.flow.edges.find(
          (edge) => edge.target === id,
        );
        return incoming ? nodeOrder(incoming.source) : 0;
      }
      return node?.kind === "startEvent" ? 0 : Number.MAX_SAFE_INTEGER;
    };
    const nodeMention = (nodeId: string): ChatMention => {
      const mention: ChatMention = {
        kind: "node",
        nodeId,
        label: "Bezug",
        nameSnapshot: null,
        understandingRevision: null,
      };
      return {
        ...mention,
        label:
          resolveChatMention(mention, understanding).currentLabel ??
          mention.label,
      };
    };
    const edgeMention = (edgeId: string): ChatMention => {
      const mention: ChatMention = {
        kind: "edge",
        edgeId,
        label: "Übergang",
        nameSnapshot: null,
        understandingRevision: null,
      };
      return {
        ...mention,
        label:
          resolveChatMention(mention, understanding).currentLabel ??
          mention.label,
      };
    };
    const nodes = understanding.flow.nodes.map((node) => {
      if (node.kind === "step") {
        const step = stepById.get(node.stepId)!;
        return {
          id: node.id,
          type: "step",
          position: { x: 0, y: 0 },
          data: {
            order: step.order,
            name: step.name,
            activity: step.activity,
            mention: nodeMention(node.id),
            onMention,
            onInspect: () => setInspectStepId(step.id),
            focused:
              focusedTarget?.kind === "node" &&
              focusedTarget.nodeId === node.id,
          },
        };
      }
      if (node.kind === "gateway")
        return {
          id: node.id,
          type: "gateway",
          position: { x: 0, y: 0 },
          data: {
            question: node.question,
            mention: nodeMention(node.id),
            onMention,
          },
        };
      const label =
        node.kind === "startEvent"
          ? (understanding.trigger.value ?? "Prozessstart")
          : (understanding.outcome.value ?? "Prozessende");
      return {
        id: node.id,
        type: "bpmnEvent",
        position: { x: 0, y: 0 },
        data: {
          kind: node.kind === "startEvent" ? "start" : "end",
          label,
          mention: nodeMention(node.id),
          onMention,
        },
      };
    });
    const edges: Edge[] = understanding.flow.edges.map((edge) => {
      const back = nodeOrder(edge.target) < nodeOrder(edge.source);
      const label = edge.label;
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: back ? "gutter" : "mention",
        sourceHandle:
          back && nodeById.get(edge.source)?.kind === "gateway"
            ? "alt"
            : undefined,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: "var(--muted-foreground)",
        },
        style: {
          stroke:
            focusedTarget?.kind === "edge" && focusedTarget.edgeId === edge.id
              ? "var(--primary)"
              : "var(--muted-foreground)",
          strokeWidth:
            focusedTarget?.kind === "edge" && focusedTarget.edgeId === edge.id
              ? 3
              : 1,
        },
        data: {
          label,
          mention: edgeMention(edge.id),
          onMention,
        },
      };
    });
    const sizes: Record<string, { width: number; height: number }> = {
      step: { width: 320, height: 150 },
      bpmnEvent: { width: 200, height: 76 },
      gateway: { width: 260, height: 112 },
    };
    const layout = new dagre.graphlib.Graph();
    layout.setGraph({ rankdir: "TB", ranksep: 48, nodesep: 64 });
    layout.setDefaultEdgeLabel(() => ({}));
    // Kopie je Knoten: dagre schreibt x/y in das übergebene Objekt — ein
    // geteiltes Größenobjekt stapelt sonst alle Knoten eines Typs aufeinander.
    for (const node of nodes) layout.setNode(node.id, { ...sizes[node.type]! });
    for (const edge of edges)
      if (edge.type !== "gutter")
        layout.setEdge(edge.source as string, edge.target as string);
    dagre.layout(layout);
    for (const node of nodes) {
      const position = layout.node(node.id);
      const size = sizes[node.type]!;
      node.position = {
        x: position.x - size.width / 2,
        y: position.y - size.height / 2,
      };
    }
    const gutterX = Math.min(...nodes.map((node) => node.position.x)) - 56;
    for (const edge of edges)
      if (edge.type === "gutter")
        (edge.data as { gutterX?: number }).gutterX = gutterX;
    return { nodes, edges };
  }, [understanding, onMention, focusedTarget]);
  const focus = useCallback(
    (instance: ReactFlowInstance<any, any>) => {
      if (!focusedTarget) return;
      const ids =
        focusedTarget.kind === "node"
          ? [focusedTarget.nodeId]
          : (understanding?.flow.edges
              .filter((edge) => edge.id === focusedTarget.edgeId)
              .flatMap((edge) => [edge.source, edge.target]) ?? []);
      instance.fitView({
        nodes: ids.map((id) => ({ id })),
        padding: 0.35,
        duration: 250,
      });
    },
    [focusedTarget, understanding],
  );
  useEffect(() => {
    if (flowRef.current) focus(flowRef.current);
  }, [focus]);
  if (!graph.nodes.length)
    return (
      <div className="flex h-full min-h-80 items-center justify-center p-8">
        <div className="flex w-full max-w-5xl flex-wrap items-center justify-center gap-x-12 gap-y-6">
          <div className="max-w-sm flex-1 basis-72">
            <p className="font-medium">
              {status === "invalid"
                ? "Das Prozessbild wird noch aufgebaut …"
                : "Aus Ihren Angaben entsteht hier das erste Prozessbild."}
            </p>
            <p className="mt-2 text-ui text-muted-foreground">
              Es erscheint automatisch, sobald ein gültiger Zwischenstand
              vorliegt.
            </p>
            <p className="mt-2 text-ui text-muted-foreground">
              Vergleichen Sie das Bild mit dem tatsächlichen Prozess.
              <br />
              Kommentare können direkt zu einem Schritt oder der Verbindung
              gemacht werden.
            </p>
          </div>
          <div className="w-full max-w-[500px] flex-1 basis-80">
            <ProcessFlowPlaceholder variant="wide" />
          </div>
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
          focus(instance);
        }}
      >
        <Background gap={24} size={1} />
        <Controls
          showInteractive={false}
          position="top-right"
          className="!right-3 !top-3"
        />
      </ReactFlow>
      {inspectStep && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setInspectStepId(null);
          }}
        >
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>
                Schritt {inspectStep.order}: {inspectStep.name}
              </DialogTitle>
              <DialogDescription>{inspectStep.activity}</DialogDescription>
            </DialogHeader>
            <div className="min-w-0">
              <ProcessStepDetails
                step={inspectStep}
                steps={steps}
                flow={understanding!.flow}
              />
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
