import {
  AlertTriangle,
  ArrowLeft,
  LoaderCircle,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { OpportunityHypothesesView } from "../components/opportunity-hypotheses-view";
import { OpportunityProgress } from "../components/opportunity-progress";
import { OpportunityScenariosView } from "../components/opportunity-scenarios-view";
import { api } from "../lib/api-client";
import type { OpportunityDiscoveryDetail } from "../lib/opportunity-types";
import type { ProcessCaptureRecord } from "../lib/process-types";

const runningStates = new Set([
  "hypotheses_queued",
  "hypotheses_running",
  "scenarios_running",
]);

export function OpportunityDiscoveryPage({
  phase,
}: {
  phase: "hypotheses" | "scenarios";
}) {
  const { id = "" } = useParams();
  const [process, setProcess] = useState<ProcessCaptureRecord | null>(null);
  const [detail, setDetail] = useState<OpportunityDiscoveryDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const discoveryState = detail?.record.state;

  useEffect(() => {
    let mounted = true;
    Promise.all([api.process(id), api.opportunity(id)])
      .then(([nextProcess, nextDetail]) => {
        if (!mounted) return;
        setProcess(nextProcess);
        setDetail(nextDetail);
      })
      .catch((reason: Error) => mounted && setError(reason.message));
    return () => {
      mounted = false;
    };
  }, [id]);

  useEffect(() => {
    if (!discoveryState || !runningStates.has(discoveryState)) return;
    const timer = window.setInterval(() => {
      api
        .opportunity(id)
        .then(setDetail)
        .catch((reason: Error) => setError(reason.message));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [discoveryState, id]);

  const hypotheses = useMemo(
    () =>
      detail?.record.hypotheses?.stepAnalyses.flatMap(
        (analysis) => analysis.hypotheses,
      ) ?? [],
    [detail?.record.hypotheses],
  );

  if (error && (!detail || !process))
    return (
      <p className="notice error" role="alert">
        {error}
      </p>
    );
  if (!detail || !process)
    return <main className="app-loading">Potenzialanalyse wird geladen …</main>;

  const record = detail.record;
  const scenariosAvailable = [
    "scenarios_running",
    "scenarios_failed",
    "completed",
  ].includes(record.state);
  if (phase === "scenarios" && !scenariosAvailable)
    return (
      <Navigate to={`/processes/${id}/opportunities/hypotheses`} replace />
    );
  const failed = record.state.endsWith("failed");
  const highConfidenceCount = hypotheses.filter(
    (hypothesis) => hypothesis.confidenceLevel === "high",
  ).length;
  const mediumConfidenceCount = hypotheses.filter(
    (hypothesis) => hypothesis.confidenceLevel === "medium",
  ).length;
  return (
    <section className="opportunity-page">
      <Link className="back-link" to={`/processes/${id}`}>
        <ArrowLeft /> Zum Prozess
      </Link>
      <div className="opportunity-heading">
        <div>
          <span className="kicker">KI-POTENZIALE ENTDECKEN</span>
          <h1>{process.cover.processName}</h1>
          <p>
            {process.cover.department} · {process.id}
          </p>
        </div>
        <OpportunityProgress record={record} processId={id} active={phase} />
      </div>

      {detail.isStale && (
        <p className="notice warning" role="status">
          <AlertTriangle /> Das Prozessbild wurde nach dieser Analyse geändert.
          Die Ergebnisse beziehen sich auf den ursprünglichen bestätigten Stand.
        </p>
      )}
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {phase === "scenarios" && record.scenarioBasis === "medium_fallback" && (
        <p className="notice warning" role="status">
          <AlertTriangle /> Diese Szenarien basieren auf mehreren plausiblen,
          aber noch nicht hoch-konfidenten Potenzialen. Klären Sie die offenen
          Fachfragen vor einer weiteren Bewertung mit dem Fachbereich.
        </p>
      )}
      {failed && record.lastError && (
        <section className="operation-panel failed panel" role="alert">
          <AlertTriangle />
          <div>
            <b>Diese Phase konnte nicht abgeschlossen werden.</b>
            <p>{record.lastError.message}</p>
          </div>
          {!detail.isStale && (
            <button
              className="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  await api.retryOpportunity(id);
                  setDetail(await api.opportunity(id));
                } catch (reason) {
                  setError((reason as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <RefreshCw /> {busy ? "Wird gestartet …" : "Erneut versuchen"}
            </button>
          )}
        </section>
      )}

      {phase === "hypotheses" && !record.hypotheses && (
        <section className="center-stage panel" aria-live="polite">
          <LoaderCircle className="spin" />
          <span className="kicker">PHASE 1 VON 2</span>
          <h2>Die Prozessschritte werden untersucht.</h2>
          <p>
            Potenziale, Begründungen und ihre Evidenz werden gemeinsam geprüft.
          </p>
        </section>
      )}
      {phase === "hypotheses" && record.hypotheses && (
        <>
          {record.state === "no_supported_hypotheses" && (
            <section className="panel no-supported">
              <Sparkles />
              <h2>Analyse abgeschlossen</h2>
              {highConfidenceCount > 0 || mediumConfidenceCount >= 2 ? (
                <p>
                  Diese bestehende Analyse wurde noch mit der früheren,
                  strengeren Auswahlregel abgeschlossen. Die gefundenen{" "}
                  {mediumConfidenceCount} mittel-konfidenten Hypothesen würden
                  nach der aktuellen Regel eine Szenarioanalyse ermöglichen.
                </p>
              ) : (
                <p>
                  Es wurden {hypotheses.length} Potenzialhypothesen gefunden,
                  davon {highConfidenceCount} mit hoher und{" "}
                  {mediumConfidenceCount} mit mittlerer Konfidenz. Für Szenarien
                  werden mindestens eine hoch-konfidente oder zwei
                  mittel-konfidente Hypothesen benötigt. Fehlende
                  Fachinformationen können weiterhin geklärt werden.
                </p>
              )}
            </section>
          )}
          <OpportunityHypothesesView
            result={record.hypotheses}
            understanding={record.sourceProcess.understanding}
          />
        </>
      )}
      {phase === "scenarios" && !record.scenarios && (
        <section className="center-stage panel" aria-live="polite">
          {record.state === "scenarios_failed" ? (
            <AlertTriangle />
          ) : (
            <LoaderCircle className="spin" />
          )}
          <span className="kicker">PHASE 2 VON 2</span>
          <h2>
            {record.state === "scenarios_failed"
              ? "Die Szenarien sind noch nicht verfügbar."
              : "Drei Szenarien werden erstellt."}
          </h2>
          <p>
            Sie können währenddessen zu den Potenzialhypothesen zurückkehren.
          </p>
        </section>
      )}
      {phase === "scenarios" && record.scenarios && (
        <OpportunityScenariosView
          scenarios={record.scenarios.scenarios}
          hypotheses={hypotheses}
          steps={record.sourceProcess.understanding.steps}
        />
      )}
    </section>
  );
}
