import { ChevronDown } from "lucide-react";
import { useState } from "react";
import type { ProcessUnderstanding } from "../lib/process-types";
import { ProcessStepDecisions } from "./process-step-decisions";
import { ProcessStepInformation } from "./process-step-information";

export function ProcessStepCard({
  step,
  steps,
}: {
  step: ProcessUnderstanding["steps"][number];
  steps: ProcessUnderstanding["steps"];
}) {
  const [open, setOpen] = useState(false);
  return (
    <li className="process-step-card">
      <details onToggle={(event) => setOpen(event.currentTarget.open)}>
        <summary>
          <span className="step-number">{step.order}</span>
          <span className="step-summary-copy">
            <strong>{step.name}</strong>
            <small>{step.activity}</small>
          </span>
          <ChevronDown
            className="step-chevron"
            aria-hidden="true"
            data-open={open ? "true" : "false"}
          />
        </summary>
        <div className="step-details">
          <StepValueList title="Input" values={step.inputs ?? []} />
          <StepValueList title="Output" values={step.outputs ?? []} />
          <ProcessStepInformation items={step.informationItems ?? []} />
          <ProcessStepDecisions
            decisions={step.decisions ?? []}
            steps={steps}
          />
          <section className="step-detail-section">
            <h3>Sonstiges</h3>
            <p>{step.miscellaneous ?? "Keine weiteren Angaben"}</p>
          </section>
        </div>
      </details>
    </li>
  );
}

function StepValueList({ title, values }: { title: string; values: string[] }) {
  return (
    <section className="step-detail-section">
      <h3>{title}</h3>
      {values.length ? (
        <ul>
          {values.map((value) => (
            <li key={value}>{value}</li>
          ))}
        </ul>
      ) : (
        <p className="empty-value">Noch nicht bekannt</p>
      )}
    </section>
  );
}
