import { Expand, MessageCircle } from "lucide-react";
import { useEffect, useRef } from "react";
import type { ChatMention, ProcessUnderstanding } from "../lib/process-types";
import type { ChatMentionTarget } from "./chat-mention";
import { ProcessConfirmationActions } from "./process-confirmation-actions";
import { Button } from "./ui/button";

export function ProcessTracker({
  understanding,
  status,
  updating,
  onMention,
  onExpand,
  confirmationAllowed,
  busy,
  onConfirm,
  focusedTarget,
}: {
  understanding: ProcessUnderstanding | null;
  status: "missing" | "invalid" | "valid";
  updating: boolean;
  onMention?: (mention: ChatMention) => void;
  onExpand: () => void;
  confirmationAllowed?: boolean;
  busy?: boolean;
  onConfirm?: () => void;
  focusedTarget?: ChatMentionTarget | null;
}) {
  const steps = understanding?.steps ?? [];
  const stepRefs = useRef(new Map<string, HTMLLIElement>());
  useEffect(() => {
    const id =
      focusedTarget?.kind === "step"
        ? focusedTarget.stepId
        : focusedTarget?.fromStepId;
    if (id)
      stepRefs.current
        .get(id)
        ?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [focusedTarget]);
  return (
    <aside className="flex h-full min-h-0 flex-col border-l bg-background/90 shadow-sm backdrop-blur">
      <header className="flex items-center justify-between border-b px-3 py-3">
        <div>
          <h2 className="font-semibold">Prozessbild</h2>
          <p className="text-xs text-muted-foreground">
            {updating
              ? "Wird aktualisiert …"
              : status === "valid"
                ? "Aktueller Stand"
                : "Noch kein gültiger Stand"}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onExpand}
          aria-label="Prozessbild erweitern"
          title="Prozessbild erweitern"
        >
          <Expand className="size-4" />
        </Button>
      </header>
      <ol className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        {steps.length ? (
          steps.map((step, index) => {
            const next = steps[index + 1];
            const stepFocused =
              focusedTarget?.kind === "step" &&
              focusedTarget.stepId === step.id;
            const transitionFocused =
              focusedTarget?.kind === "transition" &&
              focusedTarget.fromStepId === step.id &&
              focusedTarget.toStepId === next?.id;
            return (
              <li
                key={step.id}
                ref={(element) => {
                  if (element) stepRefs.current.set(step.id, element);
                  else stepRefs.current.delete(step.id);
                }}
                className={`group relative rounded-md pb-5 ${stepFocused ? "bg-primary/10 ring-1 ring-primary/40" : ""}`}
              >
                <div className="flex items-start gap-2">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                    {step.order}
                  </span>
                  <p
                    className="line-clamp-2 min-w-0 flex-1 text-sm font-medium"
                    title={step.name}
                  >
                    {step.name}
                  </p>
                  {onMention && (
                    <button
                      type="button"
                      onClick={() =>
                        onMention({
                          kind: "step",
                          stepId: step.id,
                          label: `Schritt-${step.order}`,
                          nameSnapshot: null,
                          understandingRevision: null,
                        })
                      }
                      className="rounded p-1 text-muted-foreground opacity-0 hover:bg-muted focus:opacity-100 group-hover:opacity-100"
                      aria-label={`Schritt ${step.order} im Gespräch erwähnen`}
                    >
                      <MessageCircle className="size-4" />
                    </button>
                  )}
                </div>
                {next && (
                  <div className="group/transition ml-3 mt-2 flex items-center gap-1 text-muted-foreground">
                    <span aria-hidden="true">↓</span>
                    <span
                      className={`h-px flex-1 ${transitionFocused ? "bg-primary" : "bg-border"}`}
                    />
                    {onMention && (
                      <button
                        type="button"
                        onClick={() =>
                          onMention({
                            kind: "transition",
                            fromStepId: step.id,
                            toStepId: next.id,
                            label: `Übergang-${step.order}-${next.order}`,
                            nameSnapshot: null,
                            understandingRevision: null,
                          })
                        }
                        className="rounded p-1 opacity-0 hover:bg-muted focus:opacity-100 group-hover/transition:opacity-100"
                        aria-label={`Übergang nach Schritt ${step.order} im Gespräch erwähnen`}
                      >
                        <MessageCircle className="size-4" />
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })
        ) : (
          <li className="py-8 text-center text-sm text-muted-foreground">
            {status === "invalid"
              ? "Das Prozessbild wird noch aufgebaut …"
              : "Hier entsteht Ihr Prozessbild."}
          </li>
        )}
      </ol>
      {onConfirm && (
        <footer className="border-t p-3">
          <ProcessConfirmationActions
            confirmationAllowed={confirmationAllowed ?? false}
            busy={busy ?? false}
            label="Bestätigen"
            onConfirm={onConfirm}
          />
        </footer>
      )}
    </aside>
  );
}
