import { useEffect, useState } from "react";
import { ArrowRight, Plus, Workflow } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "../components/ui/badge";
import { buttonVariants } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { api } from "../lib/api-client";
import type { OpportunityDiscoverySummary } from "../lib/opportunity-types";
import { processNavigationModel } from "../lib/process-navigation-model";
import type { ProcessCaptureRecord } from "../lib/process-types";

const nextAction: Record<ProcessCaptureRecord["state"], string> = {
  capture_in_progress: "Fünf Themen beantworten",
  follow_up_required: "Angaben ergänzen",
  synthesis_ready: "Mit dem Prozessbild fortfahren",
  review_required: "Prozessbild fachlich prüfen",
  confirmed: "Prozessbild abgeschlossen",
};
export function ProcessListPage() {
  const [records, setRecords] = useState<ProcessCaptureRecord[]>([]);
  const [opportunities, setOpportunities] = useState<
    Record<string, OpportunityDiscoverySummary>
  >({});
  const [error, setError] = useState("");
  useEffect(() => {
    Promise.all([api.processes(), api.opportunitySummaries()])
      .then(([processes, summaries]) => {
        setRecords(processes);
        setOpportunities(
          Object.fromEntries(summaries.map((item) => [item.processId, item])),
        );
      })
      .catch((e: Error) => setError(e.message));
  }, []);
  return (
    <section className="mx-auto w-full max-w-7xl space-y-10 px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <div className="flex flex-col justify-between gap-6 rounded-2xl bg-secondary p-6 sm:p-9 md:flex-row md:items-end">
        <div>
          <p className="mb-2 text-sm font-bold uppercase tracking-[0.14em] text-primary">
            Prozesse verstehen
          </p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Heutige Abläufe klar erfassen.
          </h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Ein kompakter Prozesssteckbrief und eine übersichtliche Prozesskarte
            schaffen die Grundlage für spätere KI-Use-Cases.
          </p>
        </div>
        <Link className={buttonVariants({ size: "lg" })} to="/processes/new">
          <Plus className="size-4" /> Prozess erfassen
        </Link>
      </div>
      {error && (
        <p
          className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm font-medium text-destructive"
          role="alert"
        >
          {error}
        </p>
      )}
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-sm font-bold uppercase tracking-[0.14em] text-primary">
            Lokal gespeichert
          </p>
          <h2 className="text-2xl font-bold tracking-tight">
            Prozessaufnahmen
          </h2>
        </div>
        <span className="text-sm text-muted-foreground">
          {records.length} Prozesse
        </span>
      </div>
      {!records.length ? (
        <Card>
          <CardContent className="grid place-items-center gap-3 p-10 text-center">
            <Workflow className="size-8 text-primary" />
            <h2 className="text-xl font-semibold">Noch kein Prozess erfasst</h2>
            <p className="text-muted-foreground">
              Starten Sie mit einem fiktiven oder anonymisierten Prozess.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {records.map((record) => {
            const opportunity = opportunities[record.id];
            const navigation = processNavigationModel(record, opportunity);
            return (
              <article key={record.id}>
                <Link
                  className="group block rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  to={`/processes/${record.id}`}
                  aria-label={`Prozess „${record.cover.processName}“ öffnen`}
                >
                  <Card className="py-0 transition-colors group-hover:border-primary/40 group-hover:bg-secondary/30">
                    <CardContent className="grid min-h-24 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 p-4 sm:p-5">
                      <div className="flex min-w-0 items-center gap-4">
                        <Workflow className="size-6 shrink-0 text-primary" />
                        <div className="min-w-0 space-y-1">
                          <b className="block truncate text-lg">
                            {record.cover.processName}
                          </b>
                          <small className="block truncate text-sm text-muted-foreground">
                            {record.cover.department} · {record.id} ·
                            aktualisiert{" "}
                            {new Date(record.updatedAt).toLocaleString(
                              "de-DE",
                              {
                                dateStyle: "short",
                                timeStyle: "short",
                              },
                            )}
                          </small>
                          <span className="block text-sm font-semibold text-primary">
                            Nächster Schritt: {nextAction[record.state]}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge
                          variant={badgeVariant(navigation.listTone)}
                          className="hidden sm:inline-flex"
                        >
                          {navigation.listStatus}
                        </Badge>
                        <span
                          className="grid size-9 place-items-center rounded-full text-primary transition group-hover:translate-x-0.5 group-hover:bg-secondary"
                          aria-hidden="true"
                        >
                          <ArrowRight className="size-5" />
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function badgeVariant(
  tone: "neutral" | "success" | "warning" | "danger" | "info",
) {
  return {
    neutral: "secondary",
    success: "secondary",
    warning: "outline",
    danger: "destructive",
    info: "outline",
  }[tone] as "secondary" | "outline" | "destructive";
}
