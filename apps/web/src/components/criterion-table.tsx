import { Check, Sparkles } from "lucide-react";
import type { AssessmentConfig, CriterionValue } from "../lib/assessment-types";
import { CriterionInput } from "./criterion-input";
import { ProgressBar } from "./progress-bar";

export function CriterionTable({
  config,
  values,
  onChange,
  onConfirm,
  busy,
}: {
  config: AssessmentConfig;
  values: CriterionValue[];
  onChange: (id: string, value: number | boolean | null) => void;
  onConfirm: (id: string) => void;
  busy?: boolean;
}) {
  const byId = new Map(values.map((v) => [v.criterionId, v]));
  const confirmed = values.filter((v) => v.confirmation === "confirmed").length;
  return (
    <div className="criteria-form">
      <ProgressBar
        value={confirmed}
        max={config.criteria.length}
        label="Bestätigte Kriterien"
      />
      {[...config.chat.sections]
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map((section) => {
          const definitions = config.criteria
            .filter((c) => c.sectionId === section.id)
            .sort((a, b) => a.displayOrder - b.displayOrder);
          return (
            <section className="criteria-section" key={section.id}>
              <h2>{section.name}</h2>
              {section.description && <p>{section.description}</p>}
              <div
                className="criteria-table"
                role="table"
                aria-label={section.name}
              >
                <div className="criteria-row criteria-head" role="row">
                  <b>Kriterium</b>
                  <b>Beschreibung</b>
                  <b>Eingabe</b>
                  <b>Status</b>
                  <span />
                </div>
                {definitions.map((definition) => {
                  const record = byId.get(definition.id) ?? {
                    criterionId: definition.id,
                    value: null,
                    source: "none" as const,
                    confirmation: "empty" as const,
                    rationale: "",
                    evidence: [],
                    assumptions: [],
                    confidence: null,
                    updatedBy: null,
                    updatedAt: null,
                  };
                  return (
                    <div
                      className="criteria-row"
                      role="row"
                      key={definition.id}
                    >
                      <b>{definition.name}</b>
                      <div className="criterion-description">
                        <span>{definition.description}</span>
                        {record.source === "ai" && record.rationale && (
                          <details className="criterion-ai-evidence">
                            <summary>KI-Begründung ansehen</summary>
                            <p>{record.rationale}</p>
                            {record.confidence !== null && (
                              <small>
                                Konfidenz:{" "}
                                {record.confidence.toLocaleString("de-DE")} %
                              </small>
                            )}
                            {record.evidence.length > 0 && (
                              <ul>
                                {record.evidence.map((evidence) => (
                                  <li key={evidence}>{evidence}</li>
                                ))}
                              </ul>
                            )}
                            {record.assumptions.length > 0 && (
                              <p>
                                <b>Annahmen:</b>{" "}
                                {record.assumptions.join(" · ")}
                              </p>
                            )}
                          </details>
                        )}
                      </div>
                      <CriterionInput
                        definition={definition}
                        record={record}
                        disabled={busy}
                        onChange={(value) => onChange(definition.id, value)}
                      />
                      <span
                        className={`criterion-state ${record.confirmation}`}
                      >
                        {record.confirmation === "empty"
                          ? "Leer"
                          : record.confirmation === "pending"
                            ? "KI-Vorschlag – nicht bestätigt"
                            : "Vom Menschen bestätigt/eingetragen"}
                      </span>
                      {record.confirmation === "pending" ? (
                        <button
                          className="small-button"
                          disabled={busy}
                          onClick={() => onConfirm(definition.id)}
                        >
                          <Check />
                          Bestätigen
                        </button>
                      ) : record.source === "ai" ? (
                        <Sparkles
                          className="source-icon"
                          aria-label="Von KI vorgeschlagen"
                        />
                      ) : (
                        <span />
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
    </div>
  );
}
