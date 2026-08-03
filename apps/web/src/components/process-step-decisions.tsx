import { Plus, Trash2 } from "lucide-react";
import type { ProcessUnderstanding } from "../lib/process-types";
import { Badge } from "./ui/badge";
import { Button, IconButton } from "./ui/button";
import { Input } from "./ui/input";
import { NativeSelect } from "./ui/native-select";
import { Textarea } from "./ui/textarea";
import { cn } from "../lib/utils";

type Step = ProcessUnderstanding["steps"][number];
type Decision = Step["decisions"][number];

const decisionModeCopy: Record<Decision["mode"], string> = {
  rule_based: "Feste Regel",
  professional_judgement: "Fachliche Einschätzung",
  mixed: "Regel und fachliche Einschätzung",
  unknown: "Noch nicht bekannt",
};

export function ProcessStepDecisions({
  stepId,
  decisions,
  steps,
  isEditMode = false,
  onChange = () => undefined,
}: {
  stepId?: string;
  decisions: Decision[];
  steps: ProcessUnderstanding["steps"];
  isEditMode?: boolean;
  onChange?: (decisions: Decision[]) => void;
}) {
  if (isEditMode)
    return (
      <ProcessStepDecisionsEditor
        stepId={stepId ?? "step"}
        decisions={decisions}
        steps={steps}
        onChange={onChange}
      />
    );
  const stepById = new Map(steps.map((step) => [step.id, step]));
  return (
    <section className="grid gap-3">
      <h3 className="text-base font-semibold">Varianten und Entscheidungen</h3>
      {decisions.length ? (
        <div className="grid gap-3">
          {decisions.map((decision) => (
            <article
              className="rounded-lg border bg-muted p-4"
              key={decision.id}
            >
              <header className="flex flex-wrap items-start justify-between gap-3">
                <h4 className="font-semibold">{decision.question}</h4>
                <Badge>{decisionModeCopy[decision.mode]}</Badge>
              </header>
              {decision.options.length ? (
                <div className="overflow-x-auto rounded-lg border bg-card">
                  <table className="w-full min-w-[38rem] text-sm">
                    <thead>
                      <tr className="border-b bg-muted text-left">
                        <th className="px-4 py-3 font-semibold" scope="col">
                          Option
                        </th>
                        <th className="px-4 py-3 font-semibold" scope="col">
                          Feststellung
                        </th>
                        <th className="px-4 py-3 font-semibold" scope="col">
                          Folge
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {decision.options.map((option) => {
                        const nextStep = option.nextStepId
                          ? stepById.get(option.nextStepId)
                          : undefined;
                        return (
                          <tr
                            className="border-b last:border-b-0"
                            key={option.id}
                          >
                            <td className="px-4 py-3" data-label="Option">
                              {option.label}
                            </td>
                            <td className="px-4 py-3" data-label="Feststellung">
                              {option.determination ??
                                "Feststellung noch unbekannt"}
                            </td>
                            <td className="px-4 py-3" data-label="Folge">
                              <span>
                                {option.consequence ?? "Folge noch unbekannt"}
                              </span>
                              {nextStep && (
                                <small className="mt-1 block text-muted-foreground">
                                  Weiter mit Schritt {nextStep.order}:{" "}
                                  {nextStep.name}
                                </small>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Entscheidungsoptionen noch unbekannt
                </p>
              )}
            </article>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Keine Entscheidung erforderlich oder benannt
        </p>
      )}
    </section>
  );
}

export function ProcessStepDecisionsEditor({
  stepId,
  decisions,
  steps,
  onChange,
}: {
  stepId: string;
  decisions: Decision[];
  steps: ProcessUnderstanding["steps"];
  onChange: (decisions: Decision[]) => void;
}) {
  function updateDecision(index: number, next: Partial<Decision>) {
    onChange(
      decisions.map((decision, decisionIndex) =>
        decisionIndex === index ? { ...decision, ...next } : decision,
      ),
    );
  }
  function updateOption(
    decisionIndex: number,
    optionIndex: number,
    next: Partial<Decision["options"][number]>,
  ) {
    const decision = decisions[decisionIndex]!;
    updateDecision(decisionIndex, {
      options: decision.options.map((option, currentOptionIndex) =>
        currentOptionIndex === optionIndex ? { ...option, ...next } : option,
      ),
    });
  }
  return (
    <section className="grid gap-3 rounded-lg border bg-muted p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-semibold">
          Varianten und Entscheidungen
        </h3>
        <Button
          variant="secondary"
          className="h-8 px-3 text-xs"
          onClick={() =>
            onChange([
              ...decisions,
              {
                id: crypto.randomUUID(),
                question: "",
                mode: "unknown",
                options: [],
              },
            ])
          }
        >
          <Plus /> Entscheidung hinzufügen
        </Button>
      </div>
      {decisions.length ? (
        <div className="grid gap-4">
          {decisions.map((decision, decisionIndex) => (
            <fieldset
              className="grid gap-4 rounded-lg border bg-card p-4"
              key={decision.id}
            >
              <legend>Entscheidung {decisionIndex + 1}</legend>
              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem_auto]">
                <label className="grid gap-2 text-sm font-semibold">
                  <span>Entscheidungsfrage</span>
                  <Textarea
                    name={`${stepId}-decision-${decision.id}-question`}
                    rows={2}
                    required
                    value={decision.question}
                    onChange={(event) =>
                      updateDecision(decisionIndex, {
                        question: event.target.value,
                      })
                    }
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold">
                  <span>Modus</span>
                  <NativeSelect
                    name={`${stepId}-decision-${decision.id}-mode`}
                    value={decision.mode}
                    onChange={(event) =>
                      updateDecision(decisionIndex, {
                        mode: event.target.value as Decision["mode"],
                      })
                    }
                  >
                    {Object.entries(decisionModeCopy).map(([value, label]) => (
                      <option value={value} key={value}>
                        {label}
                      </option>
                    ))}
                  </NativeSelect>
                </label>
                <IconButton
                  label={`Entscheidung ${decisionIndex + 1} entfernen`}
                  tone="danger"
                  onClick={() =>
                    onChange(
                      decisions.filter(
                        (_, currentIndex) => currentIndex !== decisionIndex,
                      ),
                    )
                  }
                >
                  <Trash2 />
                </IconButton>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h4 className="font-semibold">Optionen</h4>
                <Button
                  variant="secondary"
                  className="h-8 px-3 text-xs"
                  onClick={() =>
                    updateDecision(decisionIndex, {
                      options: [
                        ...decision.options,
                        {
                          id: crypto.randomUUID(),
                          label: "",
                          determination: null,
                          consequence: null,
                          nextStepId: null,
                        },
                      ],
                    })
                  }
                >
                  <Plus /> Option hinzufügen
                </Button>
              </div>
              {decision.options.length ? (
                <div className="grid gap-3">
                  {decision.options.map((option, optionIndex) => (
                    <fieldset
                      className="relative grid gap-3 rounded-md border bg-muted p-4 sm:grid-cols-2 lg:grid-cols-4"
                      key={option.id}
                    >
                      <legend>Option {optionIndex + 1}</legend>
                      <label className="grid gap-2 text-sm font-semibold">
                        <span>Bezeichnung</span>
                        <Input
                          name={`${stepId}-decision-${decision.id}-option-${option.id}-label`}
                          required
                          value={option.label}
                          onChange={(event) =>
                            updateOption(decisionIndex, optionIndex, {
                              label: event.target.value,
                            })
                          }
                        />
                      </label>
                      <label
                        className={cn(
                          "grid gap-2 text-sm font-semibold",
                          option.determination === null &&
                            "rounded-md bg-destructive/10 p-2",
                        )}
                      >
                        Feststellung
                        <Textarea
                          name={`${stepId}-decision-${decision.id}-option-${option.id}-determination`}
                          rows={2}
                          value={option.determination ?? ""}
                          placeholder="Noch unbekannt"
                          onChange={(event) =>
                            updateOption(decisionIndex, optionIndex, {
                              determination: event.target.value || null,
                            })
                          }
                        />
                        {option.determination === null && (
                          <span className="text-xs text-destructive">
                            Angabe fehlt
                          </span>
                        )}
                      </label>
                      <label
                        className={cn(
                          "grid gap-2 text-sm font-semibold",
                          option.consequence === null &&
                            "rounded-md bg-destructive/10 p-2",
                        )}
                      >
                        Folge
                        <Textarea
                          name={`${stepId}-decision-${decision.id}-option-${option.id}-consequence`}
                          rows={2}
                          value={option.consequence ?? ""}
                          placeholder="Noch unbekannt"
                          onChange={(event) =>
                            updateOption(decisionIndex, optionIndex, {
                              consequence: event.target.value || null,
                            })
                          }
                        />
                        {option.consequence === null && (
                          <span className="text-xs text-destructive">
                            Angabe fehlt
                          </span>
                        )}
                      </label>
                      <label className="grid gap-2 text-sm font-semibold">
                        <span>Optionaler Folgeschritt</span>
                        <NativeSelect
                          name={`${stepId}-decision-${decision.id}-option-${option.id}-next-step`}
                          value={option.nextStepId ?? ""}
                          onChange={(event) =>
                            updateOption(decisionIndex, optionIndex, {
                              nextStepId: event.target.value || null,
                            })
                          }
                        >
                          <option value="">Kein Folgeschritt festgelegt</option>
                          {steps.map((step) => (
                            <option value={step.id} key={step.id}>
                              Schritt {step.order}: {step.name}
                            </option>
                          ))}
                        </NativeSelect>
                      </label>
                      <IconButton
                        label={`Option ${optionIndex + 1} entfernen`}
                        tone="danger"
                        className="absolute right-3 top-3"
                        onClick={() =>
                          updateDecision(decisionIndex, {
                            options: decision.options.filter(
                              (_, currentIndex) => currentIndex !== optionIndex,
                            ),
                          })
                        }
                      >
                        <Trash2 />
                      </IconButton>
                    </fieldset>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Entscheidungsoptionen noch unbekannt
                </p>
              )}
            </fieldset>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Keine Entscheidung erforderlich oder benannt
        </p>
      )}
    </section>
  );
}
