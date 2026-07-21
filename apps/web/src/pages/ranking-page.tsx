import { useEffect, useState } from "react";
import { ArrowRight, BarChart3, Plus, Scale } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../lib/api-client";
import type { AssessmentRecord, RankingEntry } from "../lib/assessment-types";

export function RankingPage() {
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [assessments, setAssessments] = useState<AssessmentRecord[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    Promise.all([api.ranking(), api.assessments()])
      .then(([r, a]) => {
        setRanking(r);
        setAssessments(a);
      })
      .catch((e: Error) => setError(e.message));
  }, []);
  const comparisonGroups = [
    ...new Set(
      assessments
        .map((assessment) => assessment.comparisonGroupId)
        .filter((id): id is string => !!id),
    ),
  ].filter(
    (groupId) =>
      assessments.filter(
        (assessment) => assessment.comparisonGroupId === groupId,
      ).length > 1,
  );
  return (
    <section>
      <div className="ranking-hero">
        <div>
          <span className="eyebrow">
            <BarChart3 />
            KI-POTENZIALE
          </span>
          <h1>
            Geschäftsprozesse
            <br />
            <em>vergleichbar bewerten.</em>
          </h1>
          <p>
            Bestätigte Bewertungen werden anhand derselben nachvollziehbaren
            Kriterien priorisiert.
          </p>
        </div>
        <Link className="button hero-button" to="/assessments/new">
          <Plus />
          Prozess einreichen
        </Link>
        <div className="hero-stat">
          <b>{ranking.length}</b>
          <span>bestätigte Potenziale</span>
        </div>
      </div>
      <div className="section-head">
        <div>
          <span className="kicker">PRIORISIERUNG</span>
          <h2>Rangliste</h2>
        </div>
      </div>
      {error && <p className="notice error">{error}</p>}
      {ranking.length === 0 ? (
        <div className="empty-state panel">
          <Scale />
          <h2>Noch keine bestätigten Bewertungen</h2>
          <p>
            Nach der Kriterienbewertung und Plausibilitätsprüfung erscheinen
            qualifizierte Prozesse hier.
          </p>
          <Link className="button" to="/assessments/new">
            Erste Bewertung starten
          </Link>
        </div>
      ) : (
        <div className="ranking-list">
          {ranking.map((entry) => (
            <Link
              className="ranking-row"
              key={entry.assessment.id}
              to={`/assessments/${entry.assessment.id}/${entry.assessment.mode}`}
            >
              <span className="rank">#{entry.rank}</span>
              <div>
                <b>{entry.assessment.cover.processName}</b>
                <small>
                  {entry.assessment.cover.department} ·{" "}
                  {entry.assessment.mode === "form"
                    ? "Formular"
                    : "KI-Gespräch"}
                </small>
              </div>
              <div className="score">
                <b>{Math.round(entry.overallScore)}</b>
                <small>Punkte</small>
              </div>
              <div className="score-parts">
                <span>
                  Strategie{" "}
                  <b>{Math.round(entry.strategicRelevancePercent ?? 0)} %</b>
                </span>
                <span>
                  Umsetzung{" "}
                  <b>{Math.round(entry.implementationFactorPercent ?? 0)} %</b>
                </span>
                <span>
                  KI-Eignung{" "}
                  <b>
                    {Math.round(entry.technicalAttractivenessPercent ?? 0)} %
                  </b>
                </span>
              </div>
              <ArrowRight />
            </Link>
          ))}
        </div>
      )}
      {assessments.filter((a) => a.state !== "confirmed").length > 0 && (
        <>
          <div className="section-head">
            <div>
              <span className="kicker">IN BEARBEITUNG</span>
              <h2>Offene Bewertungen</h2>
            </div>
          </div>
          <div className="assessment-list">
            {assessments
              .filter((a) => a.state !== "confirmed")
              .map((a) => (
                <Link
                  key={a.id}
                  to={`/assessments/${a.id}/${a.state === "gateway_in_progress" ? "gateway" : a.mode}`}
                >
                  <div>
                    <b>{a.cover.processName}</b>
                    <small>
                      {a.cover.department} ·{" "}
                      {a.mode === "form" ? "Formular" : "KI-Gespräch"}
                    </small>
                  </div>
                  <span className="state">
                    {a.state === "submitted_without_clear_ai_signal"
                      ? "Eingereicht"
                      : "Weiter bearbeiten"}
                  </span>
                </Link>
              ))}
          </div>
        </>
      )}
      {comparisonGroups.length > 0 && (
        <>
          <div className="section-head">
            <div>
              <span className="kicker">INTERAKTIONSQUALITÄT</span>
              <h2>Direkte Vergleiche</h2>
            </div>
          </div>
          <div className="assessment-list">
            {comparisonGroups.map((groupId) => {
              const pair = assessments.filter(
                (assessment) => assessment.comparisonGroupId === groupId,
              );
              return (
                <Link key={groupId} to={`/comparisons/${groupId}`}>
                  <div>
                    <b>{pair[0]?.cover.processName}</b>
                    <small>Formular und KI-Gespräch gegenüberstellen</small>
                  </div>
                  <span className="state">Vergleich öffnen</span>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
