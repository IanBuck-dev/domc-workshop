import { AlertTriangle, Download, RefreshCw, Sparkles } from "lucide-react";
import { useState } from "react";
import { AgenticPotentialAssessmentTable } from "../components/agentic-potential-assessment-table";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Spinner } from "../components/ui/spinner";
import { api } from "../lib/api-client";
import { useOpportunityWorkspace } from "../lib/opportunity-workspace";

export function AgenticPotentialAssessmentPage() {
  const {
    process,
    opportunity,
    assessment: detail,
    reload,
  } = useOpportunityWorkspace();
  const id = process.id;
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const record = detail?.record;
  const scenario = opportunity.record.scenarios?.scenarios.find(
    (item) => item.id === "SCN-agentic",
  );
  const blockedReason =
    opportunity.record.state !== "completed"
      ? "Die Szenarioanalyse ist noch nicht abgeschlossen. Schließen Sie zuerst die drei KI-Szenarien ab."
      : opportunity.isStale
        ? "Das Prozessbild wurde nach der Szenarioanalyse geändert. Bestätigen Sie den Prozess erneut und lassen Sie die Szenarien neu erstellen."
        : "";
  const result = record?.state === "completed" ? record.result : null;
  const run = async (retry = false) => {
    setBusy(true);
    setError("");
    try {
      if (retry) await api.retryAgenticAssessment(id);
      else await api.startAgenticAssessment(id);
      await reload();
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const exportWorkbook = async () => {
    setExporting(true);
    setError("");
    try {
      const result = await api.exportAgenticAssessment(id);
      const url = URL.createObjectURL(result.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setExporting(false);
    }
  };
  return (
    <>
      <p className="text-ui text-muted-foreground">
        Bewertetes Szenario: {scenario?.title ?? "noch nicht verfügbar"}
      </p>
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-ui text-destructive"
        >
          {error}
        </p>
      )}
      {detail?.isStale && (
        <p
          role="status"
          className="flex gap-2 rounded-lg border border-amber-700/30 bg-amber-50 px-4 py-3 text-ui text-amber-950"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            Historischer Stand: Diese Bewertung gehört zu dem Prozessstand, der
            beim Start eingefroren wurde. Das aktuelle Prozessbild wurde seither
            geändert.
          </span>
        </p>
      )}
      {!record && (
        <Card as="section" className="items-start gap-4 p-6">
          <Sparkles className="size-7 text-primary" />
          <h2 className="text-title">Bewertung vorbereiten</h2>
          <p className="max-w-3xl">
            Die Bewertung ordnet das fertige agentische Szenario einmal gegen
            den gespeicherten Kriterienkatalog ein. Anschließend sind Webprüfung
            und Excel-Export deterministisch.
          </p>
          {blockedReason ? (
            <p className="flex max-w-3xl gap-2 rounded-lg border border-amber-700/30 bg-amber-50 px-4 py-3 text-ui text-amber-950">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>
                <b>Noch nicht möglich:</b> {blockedReason}
              </span>
            </p>
          ) : (
            <p className="text-ui text-muted-foreground">
              Nächster Schritt: Bewertung starten. Der Lauf dauert wenige
              Minuten und kann danach nur noch neu gestartet werden.
            </p>
          )}
          <Button
            variant="primary"
            disabled={busy || Boolean(blockedReason)}
            aria-busy={busy}
            onClick={() => void run()}
          >
            {busy ? <Spinner /> : <Sparkles />}
            {busy ? "Wird gestartet …" : "Bewertung erstellen"}
          </Button>
        </Card>
      )}
      {record && ["queued", "running"].includes(record.state) && (
        <Card
          as="section"
          className="items-center gap-3 p-10 text-center"
          aria-live="polite"
        >
          <Spinner className="size-7 text-primary" />
          <h2 className="text-title">Die Kriterien werden bewertet.</h2>
          <p className="max-w-xl text-muted-foreground">
            Der Lauf verwendet den beim Start eingefrorenen Szenario- und
            Kriterienstand. Das Ergebnis erscheint hier automatisch; Sie können
            die Seite offen lassen.
          </p>
        </Card>
      )}
      {record?.state === "failed" && (
        <Card
          as="section"
          className="flex-col items-start gap-4 border-destructive/30 p-6 sm:flex-row sm:items-center"
          role="alert"
        >
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
          <div className="min-w-0 flex-1">
            <h2 className="text-heading">Bewertung unterbrochen</h2>
            <p className="break-words">{record.lastError?.message}</p>
            <p className="mt-1 text-ui text-muted-foreground">
              {detail?.isStale
                ? "Ein neuer Versuch ist erst möglich, wenn die Szenarien wieder zum bestätigten Prozessstand passen."
                : "Nächster Schritt: Den Lauf erneut starten. Es wird derselbe eingefrorene Stand verwendet."}
            </p>
          </div>
          <Button
            variant="primary"
            disabled={busy || detail?.isStale}
            aria-busy={busy}
            onClick={() => void run(true)}
          >
            {busy ? <Spinner /> : <RefreshCw />}
            {busy ? "Wird gestartet …" : "Erneut versuchen"}
          </Button>
        </Card>
      )}
      {detail && record && result && (
        <>
          <section aria-labelledby="assessment-summary" className="space-y-3">
            <h2 id="assessment-summary" className="text-title">
              Ergebnisüberblick
            </h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                {
                  label: "Bewertet",
                  value: result.criteria.filter(
                    (item) => item.status === "scored",
                  ).length,
                  hint: "Kriterien mit belegter Einschätzung",
                },
                {
                  label: "Nicht ausreichend belegt",
                  value: result.criteria.filter(
                    (item) => item.status === "insufficient_evidence",
                  ).length,
                  hint: "Kriterien mit offenen Fachfragen",
                },
                {
                  label: "Ausgeschlossen",
                  value: result.criteria.filter(
                    (item) => item.status === "policy_excluded",
                  ).length,
                  hint: "Nicht Bestandteil dieser Ausbaustufe",
                },
              ].map((item) => (
                <Card key={item.label} className="gap-1 p-5">
                  <p className="text-overline uppercase text-muted-foreground">
                    {item.label}
                  </p>
                  <strong className="text-title">
                    {item.value}{" "}
                    <span className="text-ui font-normal text-muted-foreground">
                      von {result.criteria.length}
                    </span>
                  </strong>
                  <p className="text-ui text-muted-foreground">{item.hint}</p>
                </Card>
              ))}
            </div>
          </section>
          <Card
            as="section"
            className="flex-col items-start gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <h2 className="text-heading">Excel-Arbeitsmappe erstellen</h2>
              <p className="text-ui text-muted-foreground">
                Enthält denselben Stand wie diese Seite — ohne Gewichtungen,
                Finanzwerte oder Gesamtscore.
              </p>
            </div>
            <Button
              variant="primary"
              disabled={exporting}
              aria-busy={exporting}
              onClick={() => void exportWorkbook()}
            >
              {exporting ? <Spinner /> : <Download />}
              {exporting ? "Wird erstellt …" : "Excel erstellen"}
            </Button>
          </Card>
          <AgenticPotentialAssessmentTable detail={detail} />
          <p className="text-ui text-muted-foreground">
            Geprüfter Prozessstand: Version{" "}
            {record.sourceSnapshot.sourceProcessHash.slice(0, 12)}
            {record.assessmentRevision
              ? ` · Bewertung: Version ${record.assessmentRevision.slice(0, 12)}`
              : ""}
          </p>
        </>
      )}
    </>
  );
}
