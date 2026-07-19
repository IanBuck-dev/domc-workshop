import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Download,
  FileText,
  Pencil,
  Save,
  Sparkles,
  X,
} from "lucide-react";
import Markdown from "react-markdown";
import type { ProcessRecord } from "../../../../packages/domain/src/schemas";
import { api } from "../lib/api-client";

type Section = { heading: string; content: string };
function parseSections(markdown: string) {
  const sections: Section[] = [];
  let current: Section = { heading: "Dokument", content: "" };
  for (const line of markdown.split("\n")) {
    const heading = line.match(/^#{1,6}\s+(.+)$/);
    if (heading) {
      if (current.content.trim() || current.heading !== "Dokument")
        sections.push({ ...current, content: current.content.trim() });
      current = { heading: heading[1], content: "" };
    } else current.content += `${line}\n`;
  }
  if (current.content.trim() || current.heading !== "Dokument")
    sections.push({ ...current, content: current.content.trim() });
  return sections;
}
function serialize(sections: Section[]) {
  return sections
    .map(
      (section, index) =>
        `${index === 0 ? "#" : "##"} ${section.heading}\n\n${section.content.trim()}`,
    )
    .join("\n\n");
}

export function ProcessDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [record, setRecord] = useState<ProcessRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Section[]>([]);
  const [changeNote, setChangeNote] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (id)
      api
        .process(id)
        .then(setRecord)
        .catch((value: Error) => setMessage(value.message));
  }, [id]);
  const counts = useMemo(
    () =>
      record?.extraction.steps.reduce(
        (all, step) => ({
          ...all,
          [step.classification]: (all[step.classification] ?? 0) + 1,
        }),
        {} as Record<string, number>,
      ) ?? {},
    [record],
  );
  if (!record)
    return (
      <p className={message ? "notice error" : ""}>{message || "Lädt …"}</p>
    );
  const current = record;

  async function generate() {
    setBusy(true);
    setMessage("");
    try {
      setRecord(await api.generatePdd(current.metadata.id));
      setMessage("Das PDD wurde erstellt und lokal gespeichert.");
    } catch (value) {
      setMessage((value as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    const updated = await api.savePdd(
      current.metadata.id,
      serialize(draft),
      changeNote,
    );
    setRecord(updated);
    setEditing(false);
    setChangeNote("");
    setMessage("Prüfung und Änderungen wurden gespeichert.");
  }

  return (
    <section className="process-detail-page">
      <button className="back" onClick={() => navigate("/processes")}>
        <ArrowLeft /> Zur Prozess-Übersicht
      </button>
      <div className="process-detail-head">
        <div>
          <div className="card-labels">
            <span className="state">{record.metadata.state}</span>
            <span>{record.metadata.id}</span>
          </div>
          <h1>{record.extraction.processName}</h1>
          <p>
            {record.extraction.department} · {record.extraction.steps.length}{" "}
            Prozessschritte
          </p>
        </div>
        {!record.pdd && (
          <button
            className="button"
            disabled={
              busy || record.metadata.state !== "Interview abgeschlossen"
            }
            onClick={generate}
          >
            <Sparkles /> {busy ? "PDD wird erstellt …" : "PDD erstellen"}
          </button>
        )}
      </div>
      {message && <p className="notice">{message}</p>}
      <div className="process-detail-grid">
        <div className="detail-main">
          <section className="panel process-flow">
            <span className="kicker">STRUKTURIERTER IST-ABLAUF</span>
            <h2>Erfasste Prozessschritte</h2>
            {record.extraction.steps.map((step, index) => (
              <article key={step.id}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <b>{step.description}</b>
                  <p>{step.reasoning}</p>
                </div>
                <em className={`class-${step.classification}`}>
                  {step.classification}
                </em>
              </article>
            ))}
          </section>
          {record.pdd ? (
            <section className="panel pdd-panel">
              <div className="panel-title">
                <div>
                  <span className="kicker">PROCESS DEFINITION DOCUMENT</span>
                  <h2>Prüfbares PDD</h2>
                </div>
                <div className="brief-actions">
                  {editing && (
                    <button
                      className="icon-button"
                      aria-label="Bearbeitung abbrechen"
                      onClick={() => setEditing(false)}
                    >
                      <X />
                    </button>
                  )}
                  <button
                    className="icon-button"
                    aria-label={editing ? "PDD speichern" : "PDD bearbeiten"}
                    onClick={() => {
                      if (editing) void save();
                      else {
                        setDraft(parseSections(record.pdd));
                        setEditing(true);
                      }
                    }}
                    disabled={
                      editing &&
                      (!changeNote.trim() || changeNote.trim().length < 3)
                    }
                  >
                    {editing ? <Save /> : <Pencil />}
                  </button>
                </div>
              </div>
              {editing ? (
                <div className="brief-editor">
                  {draft.map((section, index) => (
                    <label key={`${section.heading}-${index}`}>
                      {section.heading}
                      <textarea
                        rows={Math.max(
                          4,
                          section.content.split("\n").length + 1,
                        )}
                        value={section.content}
                        onChange={(event) =>
                          setDraft((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, content: event.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                    </label>
                  ))}
                  <label>
                    Grund der Änderung
                    <input
                      value={changeNote}
                      onChange={(event) => setChangeNote(event.target.value)}
                      placeholder="Pflichtfeld für die Historie"
                    />
                  </label>
                </div>
              ) : (
                <div className="pdd-document">
                  <Markdown>{record.pdd}</Markdown>
                </div>
              )}
              <a
                className="button secondary"
                href={`/api/processes/${record.metadata.id}/export`}
              >
                <Download /> Markdown exportieren
              </a>
            </section>
          ) : (
            <section className="empty">
              <FileText />
              <p>
                Nach Abschluss des Interviews kann hier das PDD erstellt werden.
              </p>
            </section>
          )}
          <details className="panel transcript">
            <summary>Gesprächsverlauf anzeigen</summary>
            {record.transcript.map((turn, index) => (
              <div key={index}>
                <b>
                  {turn.role === "user" ? "Mitarbeitende" : "Prozessbegleitung"}
                </b>
                <p>{turn.text}</p>
              </div>
            ))}
          </details>
        </div>
        <aside className="process-assessment">
          <span className="kicker">INTERNE EINORDNUNG</span>
          <h2>Potenzial im Überblick</h2>
          <div className="classification-totals">
            <span>
              <b>{counts.deterministisch ?? 0}</b> regelbasiert
            </span>
            <span>
              <b>{counts["KI-erforderlich"] ?? 0}</b> Text & Interpretation
            </span>
            <span>
              <b>{counts.hybrid ?? 0}</b> kombiniert
            </span>
            <span>
              <b>{counts["nur-menschlich"] ?? 0}</b> bleibt menschlich
            </span>
          </div>
          <hr />
          <h3>Workshop-Kriterien</h3>
          {record.extraction.criteriaAssessment.map((criterion) => (
            <article className="criterion" key={criterion.criterionId}>
              <div>
                <span className={`answer ${criterion.answer}`}>
                  {criterion.answer}
                </span>
                <b>{criterion.confidence}% sicher</b>
              </div>
              <p>{criterion.question}</p>
              {criterion.evidence.map((evidence) => (
                <small key={evidence}>„{evidence}“</small>
              ))}
            </article>
          ))}
          <hr />
          <h3>Dateien</h3>
          {record.uploads.length ? (
            <ul>
              {record.uploads.map((file) => (
                <li key={file.name}>{file.name}</li>
              ))}
            </ul>
          ) : (
            <p>Keine Dateien hinterlegt.</p>
          )}
        </aside>
      </div>
    </section>
  );
}
