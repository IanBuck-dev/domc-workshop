import type { ProcessUnderstanding } from "./process-understanding.ts";

type StepReference = {
  stepId: string;
  decisionId: string;
  optionId: string;
};

function renumber(understanding: ProcessUnderstanding) {
  understanding.steps.forEach((step, index) => {
    step.order = index + 1;
  });
  return understanding;
}

export function insertProcessStep(
  understanding: ProcessUnderstanding,
  index: number,
  id: string,
) {
  if (understanding.steps.length >= 8)
    throw new Error("Ein Prozessbild kann höchstens acht Schritte enthalten.");
  if (
    !Number.isInteger(index) ||
    index < 0 ||
    index > understanding.steps.length
  )
    throw new Error("Die Einfügeposition ist ungültig.");
  if (understanding.steps.some((step) => step.id === id))
    throw new Error("Die neue Schritt-ID wird bereits verwendet.");

  const next = structuredClone(understanding);
  next.steps.splice(index, 0, {
    id,
    order: index + 1,
    name: "",
    activity: "",
    inputs: [],
    outputs: [],
    informationItems: [],
    decisions: [],
    miscellaneous: null,
    provenance: "user_confirmed",
    evidenceIds: [],
    confidence: null,
    assumptions: [],
    confirmed: true,
  });
  return renumber(next);
}

export function moveProcessStep(
  understanding: ProcessUnderstanding,
  stepId: string,
  direction: -1 | 1,
) {
  const index = understanding.steps.findIndex((step) => step.id === stepId);
  if (index < 0) throw new Error("Der Prozessschritt wurde nicht gefunden.");
  const target = index + direction;
  if (target < 0 || target >= understanding.steps.length)
    throw new Error("Der Prozessschritt kann nicht weiter verschoben werden.");

  const next = structuredClone(understanding);
  [next.steps[index], next.steps[target]] = [
    next.steps[target]!,
    next.steps[index]!,
  ];
  return renumber(next);
}

export function referencesToStep(
  understanding: ProcessUnderstanding,
  stepId: string,
): StepReference[] {
  return understanding.steps.flatMap((step) =>
    step.decisions.flatMap((decision) =>
      decision.options
        .filter((option) => option.nextStepId === stepId)
        .map((option) => ({
          stepId: step.id,
          decisionId: decision.id,
          optionId: option.id,
        })),
    ),
  );
}

export function removeProcessStep(
  understanding: ProcessUnderstanding,
  stepId: string,
) {
  if (understanding.steps.length <= 1)
    throw new Error("Ein Prozessbild muss mindestens einen Schritt enthalten.");
  const index = understanding.steps.findIndex((step) => step.id === stepId);
  if (index < 0) throw new Error("Der Prozessschritt wurde nicht gefunden.");
  if (referencesToStep(understanding, stepId).length)
    throw new Error(
      "Der Prozessschritt wird noch von einer Entscheidungsoption verwendet.",
    );

  const next = structuredClone(understanding);
  next.steps.splice(index, 1);
  return renumber(next);
}
