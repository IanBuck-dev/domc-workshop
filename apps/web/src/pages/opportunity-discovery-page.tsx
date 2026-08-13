import { AlertTriangle, ArrowLeft, RefreshCw, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { OpportunityHypothesesView } from "../components/opportunity-hypotheses-view";
import { OpportunityProgress } from "../components/opportunity-progress";
import { OpportunityScenariosView } from "../components/opportunity-scenarios-view";
import { api } from "../lib/api-client";
import type { OpportunityDiscoveryDetail } from "../lib/opportunity-types";
import type { ProcessCaptureRecord } from "../lib/process-types";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import { Spinner } from "../components/ui/spinner";
import { useProcessChanged } from "../lib/process-events";

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

  // Zwischenstände der laufenden Analyse meldet der Server von sich aus.
  useProcessChanged(id, () => {
    api
      .opportunity(id)
      .then(setDetail)
      .catch((reason: Error) => setError(reason.message));
  });

  const hypotheses = useMemo(
    () =>
      detail?.record.hypotheses?.stepAnalyses.flatMap(
        (analysis) => analysis.hypotheses,
      ) ?? [],
    [detail?.record.hypotheses],
  );

  if (error && (!detail || !process))
    return (
      <p
        className="mx-auto mt-8 w-full max-w-7xl rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-ui text-destructive"
        role="alert"
      >
        {error}
      </p>
    );
  if (!detail || !process) return <OpportunityDiscoveryPageSkeleton id={id} />;

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
    <section className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <Link
        className="inline-flex items-center gap-2 text-label text-primary hover:underline"
        to={`/processes/${id}`}
      >
        <ArrowLeft /> Zum Prozess
      </Link>
      <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div>
          <p className="text-eyebrow uppercase text-primary">
            KI-Potenziale entdecken
          </p>
          <h1 className="mt-1 text-title sm:text-display">
            {process.cover.processName}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {process.cover.department} · {process.id}
          </p>
        </div>
        <OpportunityProgress record={record} processId={id} active={phase} />
      </div>

      {detail.isStale && (
        <p
          className="flex gap-2 rounded-lg border border-amber-700/30 bg-amber-50 px-4 py-3 text-ui text-amber-950"
          role="status"
        >
          <AlertTriangle /> Das Prozessbild wurde nach dieser Analyse geändert.
          Die Ergebnisse beziehen sich auf den ursprünglichen bestätigten Stand.
        </p>
      )}
      {error && (
        <p
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-ui text-destructive"
          role="alert"
        >
          {error}
        </p>
      )}
      {phase === "scenarios" && record.scenarioBasis === "medium_fallback" && (
        <p
          className="flex gap-2 rounded-lg border border-amber-700/30 bg-amber-50 px-4 py-3 text-ui text-amber-950"
          role="status"
        >
          <AlertTriangle /> Diese Szenarien basieren auf mehreren plausiblen,
          aber noch nicht hoch-konfidenten Potenzialen. Klären Sie die offenen
          Fachfragen vor einer weiteren Bewertung mit dem Fachbereich.
        </p>
      )}
      {failed && record.lastError && (
        <Card
          as="section"
          className="flex-row items-start gap-4 border-destructive/30 p-6"
          role="alert"
        >
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
          <div className="min-w-0 flex-1">
            <b>Diese Phase konnte nicht abgeschlossen werden.</b>
            <p>{record.lastError.message}</p>
          </div>
          {!detail.isStale && (
            <Button
              variant="primary"
              disabled={busy}
              aria-busy={busy}
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
              {busy ? <Spinner /> : <RefreshCw />}{" "}
              {busy ? "Wird gestartet …" : "Erneut versuchen"}
            </Button>
          )}
        </Card>
      )}

      {phase === "hypotheses" && !record.hypotheses && (
        <Card
          as="section"
          className="items-center gap-3 p-10 text-center"
          aria-live="polite"
        >
          <Spinner className="size-7 text-primary" />
          <p className="text-eyebrow uppercase text-primary">Phase 1 von 2</p>
          <h2 className="text-title">Die Prozessschritte werden untersucht.</h2>
          <p className="max-w-xl text-muted-foreground">
            Potenziale, Begründungen und ihre Evidenz werden gemeinsam geprüft.
          </p>
        </Card>
      )}
      {phase === "hypotheses" && record.hypotheses && (
        <>
          {record.state === "no_supported_hypotheses" && (
            <Card
              as="section"
              className="gap-3 border-primary/20 bg-secondary/40 p-6"
            >
              <Sparkles className="size-6 text-primary" />
              <h2 className="text-title">Analyse abgeschlossen</h2>
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
            </Card>
          )}
          <OpportunityHypothesesView
            result={record.hypotheses}
            understanding={record.sourceProcess.understanding}
          />
        </>
      )}
      {phase === "scenarios" &&
        !record.scenarios &&
        record.state === "scenarios_failed" && (
          <Card
            as="section"
            className="items-center gap-3 p-10 text-center"
            aria-live="polite"
          >
            <AlertTriangle className="size-7 text-amber-700" />
            <p className="text-eyebrow uppercase text-primary">Phase 2 von 2</p>
            <h2 className="text-title">
              Die Szenarien sind noch nicht verfügbar.
            </h2>
            <p className="text-muted-foreground">
              Sie können währenddessen zu den Potenzialhypothesen zurückkehren.
            </p>
          </Card>
        )}
      {/* Die drei Szenarien haben eine feste, bekannte Form (drei Spalten) –
          anders als die formlose Schritt-Analyse in Phase 1 bekommt dieser
          Wartezustand daher ein Skelett statt eines Spinners. */}
      {phase === "scenarios" &&
        !record.scenarios &&
        record.state !== "scenarios_failed" && <ScenariosSkeleton />}
      {phase === "scenarios" && record.scenarios && (
        <>
          <OpportunityScenariosView
            scenarios={record.scenarios.scenarios}
            hypotheses={hypotheses}
            steps={record.sourceProcess.understanding.steps}
          />
          {record.state === "completed" && (
            <Card className="flex-row items-center justify-between gap-4 p-5">
              <div>
                <h2 className="text-heading">Agentisches Szenario bewerten</h2>
                <p className="text-muted-foreground">
                  Die Kriterienbewertung wird einmal erstellt und danach
                  schreibgeschützt geprüft.
                </p>
              </div>
              <Link
                className="rounded-md bg-primary px-4 py-2 text-label text-primary-foreground"
                to={`/processes/${id}/opportunities/agentic-assessment`}
              >
                Bewertung öffnen
              </Link>
            </Card>
          )}
        </>
      )}
    </section>
  );
}

function OpportunityDiscoveryPageSkeleton({ id }: { id: string }) {
  return (
    <section className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <Link
        className="inline-flex items-center gap-2 text-label text-primary hover:underline"
        to={`/processes/${id}`}
      >
        <ArrowLeft /> Zum Prozess
      </Link>
      <div
        className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end"
        role="status"
        aria-busy="true"
        aria-label="Potenzialanalyse wird geladen"
      >
        <span className="sr-only">Potenzialanalyse wird geladen</span>
        <div className="space-y-2">
          <p className="text-eyebrow uppercase text-primary">
            KI-Potenziale entdecken
          </p>
          <Skeleton className="mt-1 h-9 w-72 sm:h-11" />
          <Skeleton className="mt-2 h-4 w-56" />
        </div>
        <Skeleton className="h-9 w-64" />
      </div>
      <Skeleton className="h-64 w-full rounded-lg" />
    </section>
  );
}

function ScenariosSkeleton() {
  return (
    <section
      className="space-y-4"
      role="status"
      aria-busy="true"
      aria-label="Szenarien werden erstellt"
    >
      <span className="sr-only">Szenarien werden erstellt</span>
      <header className="max-w-3xl space-y-2">
        <Skeleton className="h-7 w-72" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </header>
      <div className="grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Card as="div" key={index} className="gap-0 overflow-hidden p-0">
            <div className="border-b px-5 py-4">
              <Skeleton className="h-5 w-24" />
            </div>
            <div className="space-y-4 p-5">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
