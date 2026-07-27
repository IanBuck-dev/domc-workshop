import { provenanceCopy, provenanceTone } from "../lib/process-provenance";
import type { ProcessUnderstanding } from "../lib/process-types";
import { Badge } from "./ui/badge";

export function ProcessStepCard({
  step,
}: {
  step: ProcessUnderstanding["steps"][number];
}) {
  return (
    <li className="process-step-card">
      <div className="step-number">{step.order}</div>
      <details>
        <summary>
          <span>
            <b>{step.name}</b>
            <small>{step.activity}</small>
          </span>
          {!["ai_structured", "user_stated"].includes(step.provenance) && (
            <Badge as="em" tone={provenanceTone[step.provenance]}>
              {provenanceCopy[step.provenance]}
            </Badge>
          )}
        </summary>
        <dl>
          <dt>Auslöser</dt>
          <dd>{step.trigger || "Noch nicht bekannt"}</dd>
          <dt>Verantwortlich</dt>
          <dd>{join(step.responsibleRoles)}</dd>
          <dt>Benötigte Informationen</dt>
          <dd>{join(step.information)}</dd>
          <dt>Ergebnis</dt>
          <dd>{step.output || "Noch nicht bekannt"}</dd>
          <dt>Systeme</dt>
          <dd>{join(step.systems)}</dd>
          <dt>Entscheidung</dt>
          <dd>{step.decision || "Keine benannt"}</dd>
          <dt>Regel oder Einschätzung</dt>
          <dd>{step.ruleOrJudgement || "Noch nicht bekannt"}</dd>
          <dt>Übergabe</dt>
          <dd>{step.handover || "Keine benannt"}</dd>
          <dt>Kontrollen</dt>
          <dd>{join(step.controls)}</dd>
          <dt>Probleme</dt>
          <dd>{join(step.painPoints)}</dd>
        </dl>
      </details>
    </li>
  );
}

function join(value: string[]) {
  return value.length ? value.join(", ") : "Noch nicht bekannt";
}
