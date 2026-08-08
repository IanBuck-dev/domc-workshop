import type { ChatMention, ProcessUnderstanding } from "../lib/process-types";

export type ChatMentionTarget =
  { kind: "node"; nodeId: string } | { kind: "edge"; edgeId: string };

export type ResolvedChatMention = {
  target: ChatMentionTarget | null;
  currentLabel: string | null;
  historicalLabel: string | null;
  showCurrentLabel: boolean;
};

function nodeLabel(nodeId: string, understanding: ProcessUnderstanding) {
  const node = understanding.flow.nodes.find((item) => item.id === nodeId);
  if (!node) return null;
  if (node.kind === "startEvent")
    return understanding.trigger.value
      ? `Start „${understanding.trigger.value}"`
      : "Start";
  if (node.kind === "endEvent")
    return understanding.outcome.value
      ? `Ende „${understanding.outcome.value}"`
      : "Ende";
  if (node.kind === "gateway") return `Verzweigung „${node.question}"`;
  const step = understanding.steps.find((item) => item.id === node.stepId);
  return step ? `Schritt ${step.order} „${step.name}"` : null;
}

function stepOrderForNode(
  nodeId: string,
  understanding: ProcessUnderstanding,
): number | undefined {
  const node = understanding.flow.nodes.find((item) => item.id === nodeId);
  if (node?.kind === "step")
    return understanding.steps.find((step) => step.id === node.stepId)?.order;
  if (node?.kind === "gateway") {
    const source = understanding.flow.edges.find(
      (edge) => edge.target === node.id,
    )?.source;
    return source ? stepOrderForNode(source, understanding) : undefined;
  }
  return undefined;
}

function edgeLabel(edgeId: string, understanding: ProcessUnderstanding) {
  const edge = understanding.flow.edges.find((item) => item.id === edgeId);
  if (!edge) return null;
  const sourceOrder = stepOrderForNode(edge.source, understanding);
  const targetOrder = stepOrderForNode(edge.target, understanding);
  // Ein Rücksprung ist fachlich die Kante zurück zu einem früheren Schritt.
  const backwards =
    sourceOrder !== undefined &&
    targetOrder !== undefined &&
    targetOrder < sourceOrder;
  if (edge.label)
    return `${backwards ? "Rücksprung" : "Übergang"} „${edge.label}"`;
  const source = nodeLabel(edge.source, understanding);
  const target = nodeLabel(edge.target, understanding);
  return source && target ? `Übergang ${source} → ${target}` : null;
}

export function isChatMentionTargetAvailable(
  target: ChatMentionTarget,
  understanding: ProcessUnderstanding | null,
) {
  if (!understanding) return false;
  return target.kind === "node"
    ? understanding.flow.nodes.some((node) => node.id === target.nodeId)
    : understanding.flow.edges.some((edge) => edge.id === target.edgeId);
}

export function resolveChatMention(
  mention: ChatMention,
  understanding: ProcessUnderstanding | null,
): ResolvedChatMention {
  const target: ChatMentionTarget =
    mention.kind === "node"
      ? { kind: "node", nodeId: mention.nodeId }
      : { kind: "edge", edgeId: mention.edgeId };
  const currentLabel = understanding
    ? target.kind === "node"
      ? nodeLabel(target.nodeId, understanding)
      : edgeLabel(target.edgeId, understanding)
    : null;
  if (currentLabel)
    return {
      target,
      currentLabel,
      historicalLabel: null,
      showCurrentLabel: false,
    };
  return {
    target: null,
    currentLabel: null,
    historicalLabel: `${mention.kind === "node" ? "Bezug" : "Übergang"} existiert nur in einer früheren Version`,
    showCurrentLabel: false,
  };
}

export function ChatMentionToken({
  mention,
  resolved,
  onActivate,
}: {
  mention: ChatMention;
  resolved: ResolvedChatMention;
  onActivate: (target: ChatMentionTarget) => void;
}) {
  const label = `@${resolved.currentLabel ?? mention.label}`;
  if (!resolved.target)
    return (
      <span
        className="inline-flex max-w-full items-center whitespace-nowrap rounded-full border border-primary/25 bg-primary/10 px-2 py-1 text-label text-primary"
        aria-label={`${label}. ${resolved.historicalLabel}`}
        title={resolved.historicalLabel ?? undefined}
      >
        {label}
        <span className="sr-only">. {resolved.historicalLabel}</span>
      </span>
    );
  return (
    <span className="inline-flex max-w-full items-center gap-1">
      <button
        type="button"
        className="inline-flex max-w-full items-center whitespace-nowrap rounded-full border border-primary/25 bg-primary/10 px-2 py-1 text-left text-label text-primary hover:bg-primary/15 focus:outline-none focus:ring-2 focus:ring-ring"
        aria-label={label}
        onClick={() => onActivate(resolved.target!)}
      >
        {label}
      </button>
      {resolved.showCurrentLabel && (
        <span className="text-caption text-muted-foreground">
          {resolved.currentLabel}
        </span>
      )}
    </span>
  );
}
