import { useEffect, useState } from "react";
import { ArrowRight, Plus, Trash2, Workflow } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../lib/api-client";
import type { ProcessCaptureRecord } from "../lib/process-types";

const stateCopy: Record<ProcessCaptureRecord["state"], string> = {
  capture_in_progress: "Angaben erfassen",
  follow_up_required: "Rückfragen beantworten",
  synthesis_ready: "Prozessbild erstellen",
  review_required: "Prozessbild prüfen",
  confirmed: "Fachlich bestätigt",
};
const nextAction: Record<ProcessCaptureRecord["state"], string> = {
  capture_in_progress: "Fünf Themen beantworten",
  follow_up_required: "Gezielte Rückfragen beantworten",
  synthesis_ready: "Prozessbild erstellen",
  review_required: "Prozessbild fachlich prüfen",
  confirmed: "Prozessbild abgeschlossen",
};
export function ProcessListPage() {
  const [records, setRecords] = useState<ProcessCaptureRecord[]>([]);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api
      .processes()
      .then(setRecords)
      .catch((e: Error) => setError(e.message));
  }, []);
  async function deleteProcess(id: string) {
    setBusy(id);
    setError("");
    try {
      await api.deleteProcess(id);
      setRecords((items) => items.filter((item) => item.id !== id));
      setConfirming(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }
  return (
    <section>
      <div className="hero compact-hero">
        <div>
          <span className="kicker">PROZESSE VERSTEHEN</span>
          <h1>Heutige Abläufe klar erfassen.</h1>
          <p>
            Ein kompakter Prozesssteckbrief und eine übersichtliche Prozesskarte
            schaffen die Grundlage für spätere KI-Use-Cases.
          </p>
        </div>
        <Link className="button" to="/processes/new">
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
          <span className="kicker">LOKAL GESPEICHERT</span>
          <h2>Prozessaufnahmen</h2>
        </div>
        <span>{records.length} Prozesse</span>
      </div>
      {!records.length ? (
        <div className="empty-state panel">
          <Workflow />
          <h2>Noch kein Prozess erfasst</h2>
          <p>Starten Sie mit einem fiktiven oder anonymisierten Prozess.</p>
        </div>
      ) : (
        <div className="process-list">
          {records.map((record) => (
            <article className="process-row" key={record.id}>
              <Link
                className="process-row-main"
                to={`/processes/${record.id}/capture`}
              >
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
                <span className={`state state-${record.state}`}>
                  {stateCopy[record.state]}
                </span>
                <ArrowRight />
              </Link>
              <div className="row-action">
                {confirming === record.id ? (
                  <div
                    className="delete-confirm"
                    role="group"
                    aria-label={`Prozess ${record.cover.processName} löschen`}
                  >
                    <button
                      className="danger-button"
                      disabled={busy === record.id}
                      onClick={() => void deleteProcess(record.id)}
                    >
                      {busy === record.id
                        ? "Wird gelöscht …"
                        : "Prozess löschen"}
                    </button>
                    <button
                      className="button secondary"
                      onClick={() => setConfirming(null)}
                    >
                      Abbrechen
                    </button>
                  </div>
                ) : (
                  <button
                    className="trash-button"
                    aria-label={`Prozess „${record.cover.processName}“ löschen`}
                    onClick={() => setConfirming(record.id)}
                  >
                    <Trash2 />
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
