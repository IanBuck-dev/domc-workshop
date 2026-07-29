import { Plus, Trash2 } from "lucide-react";
import type { ProcessUnderstanding } from "../lib/process-types";
import { Badge } from "./ui/badge";
import { Button, IconButton } from "./ui/button";

type Step = ProcessUnderstanding["steps"][number];
type Decision = Step["decisions"][number];

const decisionModeCopy: Record<Decision["mode"], string> = {
  rule_based: "Feste Regel",
  professional_judgement: "Fachliche Einschätzung",
  mixed: "Regel und fachliche Einschätzung",
  unknown: "Noch nicht bekannt",
};

export function ProcessStepDecisions({
  decisions,
  steps,
}: {
  decisions: Decision[];
  steps: ProcessUnderstanding["steps"];
}) {
  const stepById = new Map(steps.map((step) => [step.id, step]));
  return (
    <section className="step-detail-section">
      <h3>Varianten und Entscheidungen</h3>
      {decisions.length ? (
        <div className="decision-list">
          {decisions.map((decision) => (
            <article className="decision-card" key={decision.id}>
              <header>
                <h4>{decision.question}</h4>
                <Badge>{decisionModeCopy[decision.mode]}</Badge>
              </header>
              {decision.options.length ? (
                <div className="step-table-wrap">
                  <table className="decision-option-table">
                    <thead>
                      <tr>
                        <th scope="col">Option</th>
                        <th scope="col">Feststellung</th>
                        <th scope="col">Folge</th>
                      </tr>
                    </thead>
                    <tbody>
                      {decision.options.map((option) => {
                        const nextStep = option.nextStepId
                          ? stepById.get(option.nextStepId)
                          : undefined;
                        return (
                          <tr key={option.id}>
                            <td data-label="Option">{option.label}</td>
                            <td data-label="Feststellung">
                              {option.determination ??
                                "Feststellung noch unbekannt"}
                            </td>
                            <td data-label="Folge">
                              <span>
                                {option.consequence ?? "Folge noch unbekannt"}
                              </span>
                              {nextStep && (
                                <small>
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
                <p className="empty-value">
                  Entscheidungsoptionen noch unbekannt
                </p>
              )}
            </article>
          ))}
        </div>
      ) : (
        <p className="empty-value">
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
    <section className="step-editor-section">
      <div className="step-editor-section-heading">
        <h3>Varianten und Entscheidungen</h3>
        <Button
          variant="secondary"
          className="compact-button"
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
        <div className="decision-editor-list">
          {decisions.map((decision, decisionIndex) => (
            <fieldset className="decision-editor-card" key={decision.id}>
              <legend>Entscheidung {decisionIndex + 1}</legend>
              <div className="decision-editor-head">
                <label>
                  Entscheidungsfrage
                  <textarea
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
                <label>
                  Modus
                  <select
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
                  </select>
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
              <div className="decision-options-heading">
                <h4>Optionen</h4>
                <Button
                  variant="secondary"
                  className="compact-button"
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
                <div className="nested-editor-list">
                  {decision.options.map((option, optionIndex) => (
                    <fieldset
                      className="decision-option-editor"
                      key={option.id}
                    >
                      <legend>Option {optionIndex + 1}</legend>
                      <label>
                        Bezeichnung
                        <input
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
                      <label>
                        Feststellung
                        <textarea
                          rows={2}
                          value={option.determination ?? ""}
                          placeholder="Noch unbekannt"
                          onChange={(event) =>
                            updateOption(decisionIndex, optionIndex, {
                              determination: event.target.value || null,
                            })
                          }
                        />
                      </label>
                      <label>
                        Folge
                        <textarea
                          rows={2}
                          value={option.consequence ?? ""}
                          placeholder="Noch unbekannt"
                          onChange={(event) =>
                            updateOption(decisionIndex, optionIndex, {
                              consequence: event.target.value || null,
                            })
                          }
                        />
                      </label>
                      <label>
                        Optionaler Folgeschritt
                        <select
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
                        </select>
                      </label>
                      <IconButton
                        label={`Option ${optionIndex + 1} entfernen`}
                        tone="danger"
                        className="nested-remove-button"
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
                <p className="empty-value">
                  Entscheidungsoptionen noch unbekannt
                </p>
              )}
            </fieldset>
          ))}
        </div>
      ) : (
        <p className="empty-value">
          Keine Entscheidung erforderlich oder benannt
        </p>
      )}
    </section>
  );
}
