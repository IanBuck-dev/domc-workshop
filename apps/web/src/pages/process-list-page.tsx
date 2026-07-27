import { useEffect, useState } from "react";
import { ArrowRight, Plus, Workflow } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "../components/ui/badge";
import { api } from "../lib/api-client";
import type { OpportunityDiscoverySummary } from "../lib/opportunity-types";
import { processNavigationModel } from "../lib/process-navigation-model";
import type { ProcessCaptureRecord } from "../lib/process-types";
import { buttonClassName } from "../components/ui/button";
import { Kicker } from "../components/ui/kicker";
import { Card } from "../components/ui/card";

const nextAction: Record<ProcessCaptureRecord["state"], string> = {
  capture_in_progress: "Fünf Themen beantworten",
  follow_up_required: "Gezielte Rückfragen beantworten",
  synthesis_ready: "Prozessbild erstellen",
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
    <section>
      <div className="hero compact-hero">
        <div>
          <Kicker>Prozesse verstehen</Kicker>
          <h1>Heutige Abläufe klar erfassen.</h1>
          <p>
            Ein kompakter Prozesssteckbrief und eine übersichtliche Prozesskarte
            schaffen die Grundlage für spätere KI-Use-Cases.
          </p>
        </div>
        <Link className={buttonClassName()} to="/processes/new">
          <Plus /> Prozess erfassen
        </Link>
      </div>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <div className="section-head">
        <div>
          <Kicker>Lokal gespeichert</Kicker>
          <h2>Prozessaufnahmen</h2>
        </div>
        <span>{records.length} Prozesse</span>
      </div>
      {!records.length ? (
        <Card className="empty-state">
          <Workflow />
          <h2>Noch kein Prozess erfasst</h2>
          <p>Starten Sie mit einem fiktiven oder anonymisierten Prozess.</p>
        </Card>
      ) : (
        <div className="process-list">
          {records.map((record) => {
            const opportunity = opportunities[record.id];
            const navigation = processNavigationModel(record, opportunity);
            return (
              <article className="process-row" key={record.id}>
                <Link
                  className="process-row-link"
                  to={`/processes/${record.id}`}
                  aria-label={`Prozess „${record.cover.processName}“ öffnen`}
                >
                  <div className="process-row-main">
                    <Workflow />
                    <div>
                      <b>{record.cover.processName}</b>
                      <small>
                        {record.cover.department} · {record.id} · aktualisiert{" "}
                        {new Date(record.updatedAt).toLocaleString("de-DE", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </small>
                      <span className="next-action">
                        Nächster Schritt: {nextAction[record.state]}
                      </span>
                    </div>
                  </div>
                  <div className="process-row-side">
                    <Badge
                      tone={navigation.listTone}
                      className="navigation-state"
                    >
                      {navigation.listStatus}
                    </Badge>
                    <span className="process-row-arrow" aria-hidden="true">
                      <ArrowRight />
                    </span>
                  </div>
                </Link>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
