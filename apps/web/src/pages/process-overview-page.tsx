import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, MessagesSquare, Plus, Workflow } from "lucide-react";
import type { ProcessRecord } from "../../../../packages/domain/src/schemas";
import { api } from "../lib/api-client";

function nextAction(process: ProcessRecord) {
  if (process.metadata.state === "Interview läuft")
    return "Interview fortsetzen";
  if (process.metadata.state === "Interview abgeschlossen")
    return "PDD erstellen";
  if (process.metadata.state === "PDD erstellt") return "PDD prüfen";
  return "Geprüftes PDD öffnen";
}

export function ProcessOverviewPage() {
  const [processes, setProcesses] = useState<ProcessRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  useEffect(() => {
    api
      .processes()
      .then(setProcesses)
      .catch((value: Error) => setError(value.message));
  }, []);

  async function create() {
    setBusy(true);
    setError("");
    try {
      const process = await api.createProcess();
      navigate(`/processes/${process.metadata.id}/interview`);
    } catch (value) {
      setError((value as Error).message);
      setBusy(false);
    }
  }

  return (
    <section className="process-overview">
      <div className="process-hero">
        <div>
          <span className="eyebrow">
            <MessagesSquare /> PROZESSE VERSTEHEN
          </span>
          <h1>
            Vom Schmerzpunkt zum <em>klaren Ablauf.</em>
          </h1>
          <p>
            Beschreiben Sie Ihren Arbeitsalltag in eigenen Worten. Die
            Prozessaufnahme führt Schritt für Schritt zu einem prüfbaren
            Dokument.
          </p>
        </div>
        <button className="button" onClick={create} disabled={busy}>
          <Plus /> {busy ? "Wird vorbereitet …" : "Neue Prozessaufnahme"}
        </button>
      </div>
      {error && <p className="notice error">{error}</p>}
      <div className="section-head">
        <div>
          <span className="kicker">LOKAL GESPEICHERT</span>
          <h2>Prozess-Übersicht</h2>
        </div>
        <span className="process-count">{processes.length} Aufnahmen</span>
      </div>
      {processes.length === 0 ? (
        <div className="empty">
          <Workflow />
          <p>Noch keine Prozessaufnahme vorhanden.</p>
        </div>
      ) : (
        <div className="process-list">
          {processes.map((process) => {
            const counts = process.extraction.steps.reduce(
              (all, step) => ({
                ...all,
                [step.classification]: (all[step.classification] ?? 0) + 1,
              }),
              {} as Record<string, number>,
            );
            const interview = process.metadata.state === "Interview läuft";
            return (
              <article key={process.metadata.id} className="process-card">
                <div className="process-card-icon">
                  <Workflow />
                </div>
                <div>
                  <div className="card-labels">
                    <span className="state">{process.metadata.state}</span>
                    <span>{process.metadata.id}</span>
                  </div>
                  <h3>{process.extraction.processName}</h3>
                  <p>{process.extraction.department}</p>
                  <div className="classification-summary">
                    <span>
                      <b>{counts.deterministisch ?? 0}</b> regelbasiert
                    </span>
                    <span>
                      <b>{counts["KI-erforderlich"] ?? 0}</b> mit
                      Textverständnis
                    </span>
                    <span>
                      <b>{counts.hybrid ?? 0}</b> kombiniert
                    </span>
                  </div>
                </div>
                <Link
                  className="next"
                  to={
                    interview
                      ? `/processes/${process.metadata.id}/interview`
                      : `/processes/${process.metadata.id}`
                  }
                >
                  <small>Nächster Schritt</small>
                  {nextAction(process)}
                  <ArrowRight />
                </Link>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
