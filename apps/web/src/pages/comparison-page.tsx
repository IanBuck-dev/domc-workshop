import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/api-client";
import type { ComparisonResult } from "../lib/assessment-types";

export function ComparisonPage() {
  const { comparisonGroupId = "" } = useParams();
  const [data, setData] = useState<ComparisonResult | null>(null);
  const [ratings, setRatings] = useState<Record<string, RatingSet>>({});
  const [error, setError] = useState("");
  useEffect(() => {
    api
      .comparison(comparisonGroupId)
      .then((result) => {
        setData(result);
        setRatings(
          Object.fromEntries(
            result.assessments.map((assessment) => [
              assessment.id,
              assessment.metrics.facilitatorRatings ?? defaultRatings,
            ]),
          ),
        );
      })
      .catch((e: Error) => setError(e.message));
  }, [comparisonGroupId]);
  if (!data) return <p>{error || "Vergleich wird geladen …"}</p>;
  const [form, chat] = [
    data.assessments.find((a) => a.mode === "form"),
    data.assessments.find((a) => a.mode === "chat"),
  ];
  const formMetrics = data.metrics?.find((metric) => metric.mode === "form");
  const chatMetrics = data.metrics?.find((metric) => metric.mode === "chat");
  const metricNames = [
    "aiCompletionCoverage",
    "finalCompleteness",
    "humanOverrideCount",
    "humanOverrideRate",
    "gatewayFollowUpUsage",
    "mainChatTurns",
    "followUpChatTurns",
    "userElapsedMs",
    "aiProcessingMs",
    "uploadCount",
    "inputTokens",
    "outputTokens",
    "model",
    "reviewerFindings",
    "overallScore",
    "rank",
  ];
  return (
    <section>
      <div className="page-title">
        <div>
          <span className="kicker">QUALITÄTSVERGLEICH</span>
          <h1>Formular und KI-Gespräch</h1>
          <p>
            Der Vergleich bewertet die Erfassungsqualität – nicht die fachliche
            Richtigkeit.
          </p>
        </div>
      </div>
      {!form || !chat ? (
        <p className="notice warning">
          Für einen direkten Vergleich werden eine Formular- und eine
          Gesprächsbewertung mit derselben Konfiguration benötigt.
        </p>
      ) : (
        <div className="comparison-grid">
          <div className="comparison-head">
            <span />
            <b>Formular</b>
            <b>KI-Gespräch</b>
          </div>
          {metricNames.map((name) => (
            <div className="comparison-row" key={name}>
              <b>{metricLabel(name)}</b>
              <span>{formatMetric(name, formMetrics?.[name])}</span>
              <span>{formatMetric(name, chatMetrics?.[name])}</span>
            </div>
          ))}
          <div className="comparison-row">
            <b>Abschließender Status</b>
            <span>{stateLabel(form.state)}</span>
            <span>{stateLabel(chat.state)}</span>
          </div>
          <section className="facilitator-ratings">
            <h2>Optionale Workshop-Einschätzung</h2>
            <p>
              Diese Werte bewerten die Erfassungserfahrung und fließen nicht in
              die fachliche Rangliste ein.
            </p>
            <div className="rating-columns">
              {[form, chat].map((assessment) => (
                <div className="rating-card" key={assessment.id}>
                  <h3>
                    {assessment.mode === "form" ? "Formular" : "KI-Gespräch"}
                  </h3>
                  {ratingFields.map(([key, label]) => (
                    <label key={key}>
                      {label}
                      <select
                        name={`${assessment.id}-${key}`}
                        value={ratings[assessment.id]?.[key] ?? 3}
                        onChange={(event) =>
                          setRatings({
                            ...ratings,
                            [assessment.id]: {
                              ...(ratings[assessment.id] ?? defaultRatings),
                              [key]: Number(event.target.value),
                            },
                          })
                        }
                      >
                        {[1, 2, 3, 4, 5].map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                  <button
                    className="small-button"
                    onClick={async () => {
                      await api.saveFacilitatorRatings(
                        assessment.id,
                        ratings[assessment.id] ?? defaultRatings,
                      );
                      setData(await api.comparison(comparisonGroupId));
                    }}
                  >
                    Einschätzung speichern
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
      {!!data.criterionDifferences?.length && (
        <section className="panel differences">
          <h2>Abweichende Kriterien</h2>
          {data.criterionDifferences
            .filter((d) => d.differs)
            .map((d) => (
              <div key={d.criterionId}>
                <b>
                  {form?.configSnapshot.criteria.find(
                    (c) => c.id === d.criterionId,
                  )?.name ?? d.criterionId}
                </b>
                <span>
                  {String(
                    d.values.find((v) => v.mode === "form")?.value ?? "–",
                  )}
                </span>
                <span>
                  {String(
                    d.values.find((v) => v.mode === "chat")?.value ?? "–",
                  )}
                </span>
              </div>
            ))}
        </section>
      )}
    </section>
  );
}

type RatingSet = {
  completeness: number;
  plausibility: number;
  traceability: number;
  userEffort: number;
};

const defaultRatings: RatingSet = {
  completeness: 3,
  plausibility: 3,
  traceability: 3,
  userEffort: 3,
};

const ratingFields = [
  ["completeness", "Vollständigkeit"],
  ["plausibility", "Plausibilität"],
  ["traceability", "Nachvollziehbarkeit"],
  ["userEffort", "Aufwand für die einreichende Person"],
] as const;
function metricLabel(value: string) {
  return (
    (
      {
        aiCompletionCoverage: "KI-Abdeckung vor Korrekturen",
        humanOverrideRate: "Anteil menschlicher Änderungen",
        finalCompleteness: "Vollständigkeit am Ende",
        humanOverrideCount: "Menschliche Änderungen",
        gatewayFollowUpUsage: "Rückfragen am Einstieg",
        mainChatTurns: "Hauptantworten im Gespräch",
        followUpChatTurns: "Rückfragen im Gespräch",
        userElapsedMs: "Bearbeitungszeit",
        aiProcessingMs: "KI-Verarbeitungszeit",
        uploadCount: "Genutzte Unterlagen",
        inputTokens: "Eingabetokens",
        outputTokens: "Ausgabetokens",
        model: "KI-Modell",
        reviewerFindings: "Prüfhinweise",
        overallScore: "Gesamtergebnis",
        rank: "Rang in der Gesamtliste",
      } as Record<string, string>
    )[value] ?? value
  );
}
function formatMetric(name: string, value: unknown) {
  if (value === null || value === undefined) return "–";
  if (typeof value === "number") {
    if (
      [
        "aiCompletionCoverage",
        "finalCompleteness",
        "humanOverrideRate",
      ].includes(name)
    )
      return `${Math.round(value * 100)} %`;
    if (["userElapsedMs", "aiProcessingMs"].includes(name))
      return `${(value / 1000).toLocaleString("de-DE", {
        maximumFractionDigits: 1,
      })} s`;
    if (name === "overallScore")
      return value.toLocaleString("de-DE", { maximumFractionDigits: 1 });
    return value.toLocaleString("de-DE");
  }
  if (typeof value === "object")
    return Object.entries(value as Record<string, unknown>)
      .map(([key, count]) => `${key}: ${String(count)}`)
      .join(" · ");
  return String(value);
}

function stateLabel(value: string) {
  return value === "confirmed" ? "Bestätigt" : value;
}
