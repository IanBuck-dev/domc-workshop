import type { ChatMention, ProcessUnderstanding } from "../lib/process-types";

export type ChatMentionTarget =
  | { kind: "step"; stepId: string }
  | { kind: "transition"; fromStepId: string; toStepId: string };

export type ResolvedChatMention = {
  target: ChatMentionTarget | null;
  currentLabel: string | null;
  historicalLabel: string | null;
  showCurrentLabel: boolean;
};

export function isChatMentionTargetAvailable(
  target: ChatMentionTarget,
  understanding: ProcessUnderstanding | null,
) {
  const steps = understanding?.steps ?? [];
  if (target.kind === "step")
    return steps.some((step) => step.id === target.stepId);
  const fromIndex = steps.findIndex((step) => step.id === target.fromStepId);
  const toIndex = steps.findIndex((step) => step.id === target.toStepId);
  return fromIndex >= 0 && toIndex === fromIndex + 1;
}

export function resolveChatMention(
  mention: ChatMention,
  understanding: ProcessUnderstanding | null,
): ResolvedChatMention {
  const steps = understanding?.steps ?? [];
  if (mention.kind === "step") {
    const step = steps.find((item) => item.id === mention.stepId);
    return step
      ? {
          target: { kind: "step", stepId: step.id },
          currentLabel: `Jetzt Schritt ${step.order} · ${step.name}`,
          historicalLabel: null,
          showCurrentLabel:
            mention.label !== `Schritt-${step.order}` ||
            (mention.nameSnapshot !== null &&
              mention.nameSnapshot !== step.name),
        }
      : {
          target: null,
          currentLabel: null,
          historicalLabel: "Schritt existiert nur in einer früheren Version",
          showCurrentLabel: false,
        };
  }
  const fromIndex = steps.findIndex((item) => item.id === mention.fromStepId);
  const toIndex = steps.findIndex((item) => item.id === mention.toStepId);
  const from = steps[fromIndex];
  const to = steps[toIndex];
  return from && to && toIndex === fromIndex + 1
    ? {
        target: {
          kind: "transition",
          fromStepId: from.id,
          toStepId: to.id,
        },
        currentLabel: `Jetzt Übergang Schritt ${from.order} zu Schritt ${to.order}`,
        historicalLabel: null,
        showCurrentLabel:
          mention.label !== `Übergang-${from.order}-${to.order}` ||
          (mention.nameSnapshot !== null &&
            mention.nameSnapshot !== `Von ${from.name} zu ${to.name}`),
      }
    : {
        target: null,
        currentLabel: null,
        historicalLabel: "Übergang existiert nur in einer früheren Version",
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
  const label = `@${mention.label}`;
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
        aria-label={`${label}. ${resolved.currentLabel}`}
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
