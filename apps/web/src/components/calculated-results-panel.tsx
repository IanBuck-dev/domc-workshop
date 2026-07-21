import { Calculator } from "lucide-react";
import type { AssessmentRecord } from "../lib/assessment-types";

export function CalculatedResultsPanel({
  assessment,
}: {
  assessment: AssessmentRecord;
}) {
  const results = assessment.calculatedResults;
  if (!results) return null;
  const rows = [
    [
      "Amortisationszeit",
      results.paybackMonths === null
        ? "Nicht erreicht"
        : `${number(results.paybackMonths)} Monate`,
    ],
    ["Netto-Ertrag im ersten Jahr", euro(results.yearOneNetReturn)],
    [
      "ROI im ersten Jahr",
      results.roi === null ? "Nicht definiert" : percent(results.roi * 100),
    ],
    [
      "Betriebswirtschaftliche Rentabilität",
      percent(results.profitabilityPercent),
    ],
    [
      "Qualitativ-strategische Relevanz der Lösung",
      percent(results.strategicRelevancePercent),
    ],
    ["Implementierungsfaktor", percent(results.implementationFactorPercent)],
    [
      "Technische Attraktivität für den Einsatz von KI",
      percent(results.technicalAttractivenessPercent),
    ],
    [
      "Alternativlosigkeit",
      `${number(results.alternativlosigkeitPoints)} Punkte`,
    ],
    ["Gesamtergebnis", `${number(results.overallScore)} Punkte`],
  ] as const;
  return (
    <section className="panel calculated-results">
      <div className="results-heading">
        <Calculator />
        <div>
          <span className="kicker">DETERMINISTISCHE BERECHNUNG</span>
          <h2>Bewertungsergebnis</h2>
          <p>
            Diese Werte werden ausschließlich aus den eingetragenen Kriterien
            und der eingefrorenen Konfiguration berechnet.
          </p>
        </div>
      </div>
      <dl className="result-grid">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <details className="calculation-details">
        <summary>Berechnung nachvollziehen</summary>
        <p>
          Basiswert: {number(results.baseValue)} · Wirtschaftlichkeit{" "}
          {percent(assessment.configSnapshot.scoring.profitabilityWeight * 100)}
          , Strategie{" "}
          {percent(assessment.configSnapshot.scoring.strategicWeight * 100)}
        </p>
        <div className="calculation-components">
          {Object.entries(results.components).map(([key, component]) => (
            <article key={key}>
              <h3>{componentLabel(key)}</h3>
              <p>
                Ergebniswert:{" "}
                {component.value === null ? "–" : number(component.value)} ·{" "}
                Punkte: {number(component.points)}
              </p>
              {component.thresholds.length > 0 && (
                <p>
                  Verwendete Schwellen:{" "}
                  {component.thresholds.map(number).join(" · ")}
                </p>
              )}
              <dl>
                {Object.entries(component.inputs).map(([input, value]) => (
                  <div key={input}>
                    <dt>{inputLabel(input, assessment)}</dt>
                    <dd>{number(value)}</dd>
                  </div>
                ))}
              </dl>
            </article>
          ))}
        </div>
      </details>
    </section>
  );
}

function number(value: number) {
  return value.toLocaleString("de-DE", { maximumFractionDigits: 2 });
}

function euro(value: number) {
  return value.toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

function percent(value: number) {
  return `${number(value)} %`;
}

function componentLabel(key: string) {
  return (
    {
      payback: "Amortisation",
      yearOneNetReturn: "Netto-Ertrag im ersten Jahr",
      roi: "ROI",
      strategic: "Strategische Relevanz",
      implementation: "Implementierungsfaktor",
      technical: "Technische KI-Attraktivität",
      absoluteNecessity: "Absolute Notwendigkeit",
    }[key] ?? key
  );
}

function inputLabel(input: string, assessment: AssessmentRecord) {
  return (
    assessment.configSnapshot.criteria.find(
      (criterion) => criterion.id === input,
    )?.name ??
    {
      annualNetBenefit: "Jährlicher Nettonutzen",
      initialNetCost: "Einmalige Nettokosten",
      yearOneNetReturn: "Netto-Ertrag im ersten Jahr",
      totalCosts: "Gesamtkosten",
      earnedPoints: "Erreichte Punkte",
      maximumPoints: "Maximal mögliche Punkte",
      weightedSum: "Gewichtete Summe",
      maximumWeightedSum: "Maximal gewichtete Summe",
      value: "Wert",
    }[input] ??
    input
  );
}
