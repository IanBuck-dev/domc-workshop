import { ArrowDown, ChevronDown, Expand, MessageCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ChatMention, ProcessUnderstanding } from "../lib/process-types";
import type { ChatMentionTarget } from "./chat-mention";
import { ProcessConfirmationActions } from "./process-confirmation-actions";
import { ProcessStepDetails } from "./process-step-details";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";

export function ProcessTrackerSkeleton() {
  return (
    <aside
      className="flex h-full min-h-0 flex-col border-l bg-muted"
      role="status"
      aria-busy="true"
      aria-label="Prozessbild wird geladen"
    >
      <span className="sr-only">Prozessbild wird geladen</span>
      <header className="flex items-center justify-between border-b px-3 py-3">
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="size-8 shrink-0 rounded-md" />
      </header>
      <div className="min-h-0 flex-1 space-y-6 px-3 py-4">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="flex items-start gap-2">
            <Skeleton className="size-6 shrink-0 rounded-full" />
            <Skeleton className="h-4 flex-1" />
          </div>
        ))}
      </div>
    </aside>
  );
}

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
  // Mehrere Schritte dürfen gleichzeitig offen sein — wie in der Formularerfassung.
  const [openStepIds, setOpenStepIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    const id =
      focusedTarget?.kind === "step"
        ? focusedTarget.stepId
        : focusedTarget?.fromStepId;
    if (!id) return;
    stepRefs.current
      .get(id)
      ?.scrollIntoView({ block: "center", behavior: "smooth" });
    if (focusedTarget?.kind === "step")
      setOpenStepIds((current) => new Set(current).add(id));
  }, [focusedTarget]);
  function changeOpenStep(stepId: string, open: boolean) {
    setOpenStepIds((current) => {
      const next = new Set(current);
      if (open) next.add(stepId);
      else next.delete(stepId);
      return next;
    });
  }
  return (
    <aside className="flex h-full min-h-0 flex-col border-l bg-muted">
      <header className="flex items-center justify-between border-b px-3 py-3">
        <div>
          <h2 className="font-semibold">Prozessbild</h2>
          <p className="text-caption text-muted-foreground">
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
                className={`group relative rounded-md pb-3 ${stepFocused ? "ring-1 ring-primary/40" : ""}`}
              >
                <details
                  className={`group/step rounded-md ${stepFocused ? "bg-primary/10" : "bg-background"}`}
                  open={openStepIds.has(step.id)}
                  onToggle={(event) => {
                    if (event.currentTarget.open !== openStepIds.has(step.id))
                      changeOpenStep(step.id, event.currentTarget.open);
                  }}
                >
                  {/* `hover:bg-accent`, nicht `bg-muted`: Die Spalte selbst ist
                      schon `bg-muted`, der Zeilen-Hover wäre dort unsichtbar. */}
                  <summary className="cursor-pointer list-none rounded-md p-2 marker:hidden hover:bg-accent [&::-webkit-details-marker]:hidden">
                    {/*
                      Kopfzeile und Unterzeile sind getrennt: Der Nummernkreis
                      ist genauso hoch wie die Zeile des Namens (`size-5` zu
                      `text-label`, 20px), und die Aktivität läuft darunter über
                      die volle Breite statt neben dem Kreis eingerückt.
                    */}
                    {/* `items-start`: Bei zweizeiligen Namen soll der Kreis auf
                        der ersten Zeile sitzen, nicht mittig dazwischen. */}
                    <span className="flex items-start gap-2">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-caption text-primary-foreground">
                        {step.order}
                      </span>
                      <span
                        className="line-clamp-2 min-w-0 flex-1 text-label"
                        title={step.name}
                      >
                        {step.name}
                      </span>
                      {onMention && (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            onMention({
                              kind: "step",
                              stepId: step.id,
                              label: `Schritt-${step.order}`,
                              nameSnapshot: null,
                              understandingRevision: null,
                            });
                          }}
                          className="rounded p-1 text-muted-foreground opacity-0 hover:bg-background focus:opacity-100 group-hover:opacity-100"
                          aria-label={`Schritt ${step.order} im Gespräch erwähnen`}
                        >
                          <MessageCircle className="size-4" />
                        </button>
                      )}
                      <ChevronDown
                        className="size-4 shrink-0 text-muted-foreground transition-transform group-open/step:rotate-180"
                        aria-hidden="true"
                      />
                    </span>
                    <span
                      className="mt-1 line-clamp-2 block text-caption text-muted-foreground"
                      title={step.activity}
                    >
                      {step.activity}
                    </span>
                  </summary>
                  <div className="border-t border-border px-2 pb-4 pt-4">
                    <ProcessStepDetails
                      step={step}
                      steps={steps}
                      layout="compact"
                    />
                  </div>
                </details>
                {next && (
                  // Nur ein zentrierter Pfeil, keine Trennlinie: Die Karten
                  // grenzen sich schon durch ihre Fläche ab.
                  <div className="group/transition relative mt-3 flex items-center justify-center">
                    <ArrowDown
                      className={`size-4 ${transitionFocused ? "text-primary" : "text-muted-foreground"}`}
                      aria-hidden="true"
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
                        // Direkt rechts neben dem Pfeil, aber absolut
                        // positioniert: So bleibt der Pfeil mittig, egal ob der
                        // Knopf gerade sichtbar ist.
                        className="absolute left-1/2 ml-3 rounded p-1 text-muted-foreground opacity-0 hover:bg-background focus:opacity-100 group-hover/transition:opacity-100"
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
          <li className="py-8 text-center text-ui text-muted-foreground">
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
