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
  type EdgeProps,
  type NodeProps,
} from "@xyflow/react";
import { MessageCircle } from "lucide-react";
import type { ChatMention, ProcessUnderstanding } from "../lib/process-types";

type StepNodeData = {
  order: number;
  name: string;
  activity: string;
  mention: ChatMention;
  onMention?: (mention: ChatMention) => void;
};

const StepNode = memo(function StepNode({ data }: NodeProps) {
  const value = data as unknown as StepNodeData;
  return (
    <div className="group h-48 w-64 overflow-hidden rounded-xl border border-border bg-card p-4 shadow-sm">
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <div className="flex items-start gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
          {value.order}
        </span>
        <div className="min-w-0 flex-1">
          <p
            className="line-clamp-3 font-semibold leading-snug"
            title={value.name}
          >
            {value.name}
          </p>
          <p
            className="mt-1 line-clamp-3 text-sm text-muted-foreground"
            title={value.activity}
          >
            {value.activity}
          </p>
        </div>
        {value.onMention && (
          <button
            type="button"
            className="nodrag rounded-md p-1.5 text-muted-foreground opacity-0 transition hover:bg-secondary hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring group-hover:opacity-100"
            onClick={() => value.onMention?.(value.mention)}
            aria-label={`Schritt ${value.order} im Gespräch erwähnen`}
            title="Im Gespräch erwähnen"
          >
            <MessageCircle className="size-4" />
          </button>
        )}
      </div>
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
    | { mention: ChatMention; onMention?: (mention: ChatMention) => void }
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
        onMouseEnter={() => {
          if (hideTimer.current) clearTimeout(hideTimer.current);
          setHovered(true);
        }}
        onMouseLeave={() => {
          hideTimer.current = setTimeout(() => setHovered(false), 120);
        }}
      />
      {mentionData?.onMention && (
        <EdgeLabelRenderer>
          <button
            type="button"
            className={`nodrag nopan absolute flex size-8 items-center justify-center rounded-full border bg-card text-muted-foreground shadow-sm transition hover:text-primary focus:opacity-100 ${hovered ? "opacity-100" : "opacity-0"}`}
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
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

const nodeTypes = { step: StepNode };
const edgeTypes = { mention: MentionEdge };

export function ProcessFlowDiagram({
  understanding,
  status,
  updating,
  onMention,
}: {
  understanding: ProcessUnderstanding | null;
  status: "missing" | "invalid" | "valid";
  updating: boolean;
  onMention?: (mention: ChatMention) => void;
}) {
  const graph = useMemo(() => {
    const steps = understanding?.steps ?? [];
    const nodes = steps.map((step, index) => ({
      id: step.id,
      type: "step",
      position: { x: 80, y: index * 240 },
      data: {
        order: step.order,
        name: step.name,
        activity: step.activity,
        mention: {
          kind: "step" as const,
          stepId: step.id,
          label: `Schritt-${step.order}`,
        },
        onMention,
      },
    }));
    const edges = steps.slice(0, -1).map((step, index) => {
      const next = steps[index + 1];
      return {
        id: `${step.id}-${next.id}`,
        source: step.id,
        target: next.id,
        type: "mention",
        style: { stroke: "var(--muted-foreground)" },
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
          },
          onMention,
        },
      };
    });
    return { nodes, edges };
  }, [understanding, onMention]);

  if (!graph.nodes.length)
    return (
      <div className="flex h-full min-h-80 items-center justify-center p-8 text-center">
        <div className="max-w-sm">
          <div className="mx-auto mb-5 flex gap-3" aria-hidden="true">
            {[0, 1, 2].map((item) => (
              <span
                key={item}
                className="h-16 flex-1 animate-pulse rounded-lg border bg-muted"
              />
            ))}
          </div>
          <p className="font-medium">
            {status === "invalid"
              ? "Das Prozessbild wird noch aufgebaut …"
              : "Aus Ihren Angaben entsteht hier das erste Prozessbild."}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Es erscheint automatisch, sobald ein gültiger Zwischenstand
            vorliegt.
          </p>
        </div>
      </div>
    );

  return (
    <div className="relative h-full min-h-80">
      {updating && (
        <div className="absolute left-3 top-3 z-10 rounded-full bg-card px-3 py-1 text-xs text-muted-foreground shadow-sm">
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
      >
        <Background gap={24} size={1} />
        <Controls
          showInteractive={false}
          position="top-right"
          className="!right-3 !top-3"
        />
      </ReactFlow>
    </div>
  );
}
