import type { ProcessUnderstanding } from "../lib/process-types";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { NativeSelect } from "./ui/native-select";
import { Textarea } from "./ui/textarea";
import { cn } from "../lib/utils";

type Step = ProcessUnderstanding["steps"][number];
type Flow = ProcessUnderstanding["flow"];
type Gateway = Extract<Flow["nodes"][number], { kind: "gateway" }>;

export const decisionModeCopy: Record<Gateway["mode"], string> = {
  rule_based: "Feste Regel",
  professional_judgement: "Fachliche Einschätzung",
  mixed: "Regel und fachliche Einschätzung",
  unknown: "Noch nicht bekannt",
};

export function gatewayForStep(flow: Flow, stepId: string) {
  const stepNode = flow.nodes.find(
    (node) => node.kind === "step" && node.stepId === stepId,
  );
  const edge = stepNode
    ? flow.edges.find((item) => item.source === stepNode.id)
    : undefined;
  const gateway = edge
    ? flow.nodes.find(
        (node): node is Gateway =>
          node.kind === "gateway" && node.id === edge.target,
      )
    : undefined;
  return {
    gateway,
    edges: gateway
      ? flow.edges.filter((item) => item.source === gateway.id)
      : [],
  };
}

function targetLabel(targetId: string, flow: Flow, steps: Step[]) {
  const target = flow.nodes.find((node) => node.id === targetId);
  if (target?.kind === "step") {
    const step = steps.find((item) => item.id === target.stepId);
    return step ? `Schritt ${step.order}: ${step.name}` : "Unbekannter Schritt";
  }
  return target?.kind === "endEvent" ? "Prozessende" : "Unbekanntes Ziel";
}

export function ProcessStepDecisions({
  stepId,
  flow,
  steps,
  isEditMode = false,
  onChange = () => undefined,
}: {
  stepId: string;
  flow: Flow;
  steps: Step[];
  isEditMode?: boolean;
  onChange?: (flow: Flow) => void;
}) {
  const { gateway, edges } = gatewayForStep(flow, stepId);
  if (isEditMode)
    return (
      <ProcessStepDecisionsEditor
        stepId={stepId}
        gateway={gateway}
        edges={edges}
        flow={flow}
        steps={steps}
        onChange={onChange}
      />
    );
  return (
    <section className="grid gap-3">
      <h3 className="text-subheading">Varianten und Entscheidungen</h3>
      {gateway ? (
        <article className="grid gap-3 rounded-lg border bg-muted p-4">
          <header className="flex flex-wrap items-start justify-between gap-3">
            <h4 className="font-semibold">{gateway.question}</h4>
            <Badge>{decisionModeCopy[gateway.mode]}</Badge>
          </header>
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full min-w-[38rem] text-ui">
              <thead>
                <tr className="border-b bg-muted text-left">
                  <th className="px-4 py-3 font-semibold" scope="col">
                    Kante
                  </th>
                  <th className="px-4 py-3 font-semibold" scope="col">
                    Feststellung
                  </th>
                  <th className="px-4 py-3 font-semibold" scope="col">
                    Folge und Ziel
                  </th>
                </tr>
              </thead>
              <tbody>
                {edges.map((edge) => (
                  <tr className="border-b last:border-b-0" key={edge.id}>
                    <td className="px-4 py-3">{edge.label}</td>
                    <td className="px-4 py-3">
                      {edge.determination ?? "Feststellung noch unbekannt"}
                    </td>
                    <td className="px-4 py-3">
                      <span>{edge.consequence ?? "Folge noch unbekannt"}</span>
                      <small className="mt-1 block text-muted-foreground">
                        {targetLabel(edge.target, flow, steps)}
                      </small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      ) : (
        <p className="text-ui text-muted-foreground">
          Keine Entscheidung erforderlich oder benannt
        </p>
      )}
    </section>
  );
}

function ProcessStepDecisionsEditor({
  stepId,
  gateway,
  edges,
  flow,
  steps,
  onChange,
}: {
  stepId: string;
  gateway: Gateway | undefined;
  edges: Flow["edges"];
  flow: Flow;
  steps: Step[];
  onChange: (flow: Flow) => void;
}) {
  function updateGateway(next: Partial<Gateway>) {
    if (!gateway) return;
    onChange({
      ...flow,
      nodes: flow.nodes.map((node) =>
        node.kind === "gateway" && node.id === gateway.id
          ? { ...node, ...next }
          : node,
      ),
    });
  }
  function updateEdge(edgeId: string, next: Partial<Flow["edges"][number]>) {
    onChange({
      ...flow,
      edges: flow.edges.map((edge) =>
        edge.id === edgeId ? { ...edge, ...next } : edge,
      ),
    });
  }
  const targets = flow.nodes.filter(
    (node) => node.kind === "step" || node.kind === "endEvent",
  );
  return (
    <section className="grid gap-3 rounded-lg border bg-muted p-4">
      <div className="grid gap-1">
        <h3 className="text-subheading">Varianten und Entscheidungen</h3>
        <p className="text-caption text-muted-foreground">
          Knoten und Kanten bleiben unverändert; Sie bearbeiten nur die
          vorhandenen Angaben im Ablauf.
        </p>
      </div>
      {gateway ? (
        <div className="grid gap-4 rounded-lg border bg-card p-4">
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
            <label className="grid gap-2 text-label">
              <span>Entscheidungsfrage</span>
              <Textarea
                name={`${stepId}-gateway-${gateway.id}-question`}
                rows={2}
                required
                value={gateway.question}
                onChange={(event) =>
                  updateGateway({ question: event.target.value })
                }
              />
            </label>
            <label className="grid gap-2 text-label">
              <span>Modus</span>
              <NativeSelect
                name={`${stepId}-gateway-${gateway.id}-mode`}
                value={gateway.mode}
                onChange={(event) =>
                  updateGateway({ mode: event.target.value as Gateway["mode"] })
                }
              >
                {Object.entries(decisionModeCopy).map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </NativeSelect>
            </label>
          </div>
          {edges.map((edge, index) => (
            <fieldset
              className="grid gap-3 rounded-md border bg-muted p-4 sm:grid-cols-2 lg:grid-cols-4"
              key={edge.id}
            >
              <legend>Kante {index + 1}</legend>
              <label
                className={cn(
                  "grid gap-2 text-label",
                  !edge.label?.trim() && "rounded-md bg-destructive/10 p-2",
                )}
              >
                Bezeichnung
                <Input
                  name={`${stepId}-gateway-${gateway.id}-edge-${edge.id}-label`}
                  required
                  value={edge.label ?? ""}
                  onChange={(event) =>
                    updateEdge(edge.id, { label: event.target.value })
                  }
                />
              </label>
              <label className="grid gap-2 text-label">
                Feststellung
                <Textarea
                  name={`${stepId}-gateway-${gateway.id}-edge-${edge.id}-determination`}
                  rows={2}
                  value={edge.determination ?? ""}
                  placeholder="Noch unbekannt"
                  onChange={(event) =>
                    updateEdge(edge.id, {
                      determination: event.target.value || undefined,
                    })
                  }
                />
              </label>
              <label className="grid gap-2 text-label">
                Folge
                <Textarea
                  name={`${stepId}-gateway-${gateway.id}-edge-${edge.id}-consequence`}
                  rows={2}
                  value={edge.consequence ?? ""}
                  placeholder="Noch unbekannt"
                  onChange={(event) =>
                    updateEdge(edge.id, {
                      consequence: event.target.value || undefined,
                    })
                  }
                />
              </label>
              <label className="grid gap-2 text-label">
                Ziel
                <NativeSelect
                  name={`${stepId}-gateway-${gateway.id}-edge-${edge.id}-target`}
                  value={edge.target}
                  onChange={(event) =>
                    updateEdge(edge.id, { target: event.target.value })
                  }
                >
                  {targets.map((target) => (
                    <option value={target.id} key={target.id}>
                      {targetLabel(target.id, flow, steps)}
                    </option>
                  ))}
                </NativeSelect>
              </label>
            </fieldset>
          ))}
        </div>
      ) : (
        <p className="text-ui text-muted-foreground">
          Für diesen Schritt ist keine bearbeitbare Entscheidung hinterlegt.
        </p>
      )}
    </section>
  );
}
