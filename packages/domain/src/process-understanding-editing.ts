import type { ProcessUnderstanding } from "./process-understanding.ts";

type StepReference = {
  edgeId: string;
  sourceNodeId: string;
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
    miscellaneous: null,
    provenance: "user_confirmed",
    evidenceIds: [],
    confidence: null,
    assumptions: [],
    confirmed: true,
  });
  const ordinals = next.flow.nodes
    .filter((node) => node.kind === "step")
    .map((node) => Number(node.id.slice("step-".length)));
  const edgeOrdinals = next.flow.edges.map((edge) =>
    Number(edge.id.slice("edge-".length)),
  );
  // Graph-IDs bleiben bei Umordnung stabil; ein neuer Knoten erhält die nächste Ordinal-ID.
  const nodeId = `step-${Math.max(0, ...ordinals) + 1}`;
  next.flow.nodes.push({
    id: nodeId,
    kind: "step",
    stepId: id,
  });
  const sourceId =
    index === 0
      ? "start"
      : next.flow.nodes.find(
          (node) =>
            node.kind === "step" && node.stepId === next.steps[index - 1]!.id,
        )?.id;
  const previousEdge = next.flow.edges.find((edge) => edge.source === sourceId);
  if (!sourceId || !previousEdge)
    throw new Error("Der Ablauf kann an dieser Position nicht ergänzt werden.");
  const previousTarget = previousEdge.target;
  previousEdge.target = nodeId;
  next.flow.edges.push({
    id: `edge-${Math.max(0, ...edgeOrdinals) + 1}`,
    source: nodeId,
    target: previousTarget,
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
  const nodeIds = new Set(
    understanding.flow.nodes
      .filter((node) => node.kind === "step" && node.stepId === stepId)
      .map((node) => node.id),
  );
  return understanding.flow.edges
    .filter((edge) => nodeIds.has(edge.target))
    .map((edge) => ({ edgeId: edge.id, sourceNodeId: edge.source }));
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
      "Der Prozessschritt wird noch von einer Ablaufkante verwendet.",
    );

  const next = structuredClone(understanding);
  const nodeIds = new Set(
    next.flow.nodes
      .filter((node) => node.kind === "step" && node.stepId === stepId)
      .map((node) => node.id),
  );
  next.steps.splice(index, 1);
  next.flow.nodes = next.flow.nodes.filter((node) => !nodeIds.has(node.id));
  next.flow.edges = next.flow.edges.filter(
    (edge) => !nodeIds.has(edge.source) && !nodeIds.has(edge.target),
  );
  return renumber(next);
}
