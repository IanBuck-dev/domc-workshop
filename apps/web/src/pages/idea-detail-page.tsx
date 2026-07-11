import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BrainCircuit,
  Check,
  Pencil,
  RefreshCw,
  Save,
  Send,
  X,
} from "lucide-react";
import type { Idea } from "../../../../packages/domain/src/schemas";
import { api } from "../lib/api-client";
import { PriorityBadge } from "../components/priority-badge";
import { EvidenceBadge } from "../components/evidence-badge";
import { ReviewFlags } from "../components/review-flags";

type BriefSection = { heading: string; content: string };

function parseBrief(brief: string): BriefSection[] {
  const sections: BriefSection[] = [];
  let current: BriefSection = { heading: "Projektsteckbrief", content: "" };
  for (const line of brief.split("\n")) {
    const heading = line.match(/^#{1,6}\s+(.+)$/);
    if (heading) {
      if (current.content.trim() || current.heading !== "Projektsteckbrief") {
        sections.push({ ...current, content: current.content.trim() });
      }
      current = { heading: heading[1], content: "" };
    } else {
      current.content += `${line}\n`;
    }
  }
  if (current.content.trim() || current.heading !== "Projektsteckbrief") {
    sections.push({ ...current, content: current.content.trim() });
  }
  return sections;
}

function serializeBrief(sections: BriefSection[]) {
  return sections
    .map(({ heading, content }) => `## ${heading.trim()}\n${content.trim()}`)
    .join("\n\n");
}

export function IdeaDetailPage() {
  const { id } = useParams(),
    nav = useNavigate(),
    [i, setI] = useState<Idea | null>(null),
    [busy, setBusy] = useState(""),
    [msg, setMsg] = useState(""),
    [reason, setReason] = useState(""),
    [editingBrief, setEditingBrief] = useState(false);
  const [history, setHistory] = useState<Array<{ at: string; event: string }>>(
    [],
  );
  useEffect(() => {
    if (id) {
      api.idea(id).then(setI);
      api.history(id).then(setHistory);
    }
  }, [id]);
  if (!i) return <p>Lädt …</p>;
  const current = i;
  async function save(next: Idea = current) {
    setI(await api.save(next));
    setHistory(await api.history(current.id));
    setMsg("Änderungen gespeichert.");
  }
  async function analyze(op: string) {
    setBusy(op);
    setMsg("");
    try {
      setI(await api.claude(current.id, op));
      setMsg("Claude-Empfehlung wurde geprüft und gespeichert.");
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function override() {
    if (!reason.trim()) return;
    await save({
      ...current,
      override: {
        previous: current.scores.priority,
        reason,
        at: new Date().toISOString(),
      },
    });
    setReason("");
  }
  async function select() {
    await save({
      ...current,
      state:
        current.state === "Für Übergabe ausgewählt"
          ? "Bewertet"
          : "Für Übergabe ausgewählt",
    });
  }
  return (
    <>
      <button className="back" onClick={() => nav(-1)}>
        <ArrowLeft />
        Zurück zum Portfolio
      </button>
      <section className="detail-head">
        <div>
          <div className="card-labels">
            <EvidenceBadge level={i.evidenceLevel} />
            <span className="state">{i.state}</span>
            <span>{i.id}</span>
          </div>
          <h1>{i.title}</h1>
          <p>{i.description}</p>
        </div>
        <div className="detail-priority">
          <small>EMPFOHLENE PRIORITÄT</small>
          <PriorityBadge value={i.scores.priority} />
        </div>
      </section>
      <div className="detail-actions">
        <button
          className="button"
          onClick={() =>
            analyze(i.state === "Entwurf" ? "structure" : "refresh")
          }
          disabled={!!busy}
        >
          <BrainCircuit />
          {busy
            ? "Claude arbeitet …"
            : i.state === "Entwurf"
              ? "Idee strukturieren"
              : "Bewertung aktualisieren"}
        </button>
        {i.state === "Klärung nötig" && (
          <button
            className="button secondary"
            onClick={() => analyze("assess")}
          >
            <Check />
            Antworten bewerten
          </button>
        )}
        <button className="button secondary" onClick={select}>
          <Send />
          {i.state === "Für Übergabe ausgewählt"
            ? "Aus Übergabe entfernen"
            : "Für IT-Übergabe auswählen"}
        </button>
        <label className="state-select">
          Status
          <select
            name="idea-state"
            value={i.state}
            onChange={(e) =>
              save({ ...i, state: e.target.value as Idea["state"] })
            }
          >
            {[
              "Entwurf",
              "Klärung nötig",
              "Bewertungsbereit",
              "Bewertet",
              "Für Übergabe ausgewählt",
              "Übergeben",
              "Archiviert",
            ].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
      </div>
      {msg && <p className="notice">{msg}</p>}
      <div className="detail-grid">
        <div className="detail-main">
          <section className="panel">
            <span className="kicker">UNVERÄNDERTES ORIGINAL</span>
            <p className="raw">{i.raw}</p>
          </section>
          {i.clarificationQuestions.length > 0 && (
            <section className="panel questions">
              <h2>Was noch zu klären ist</h2>
              {i.clarificationQuestions.map((q) => (
                <label key={q}>
                  {q}
                  <input
                    name={`clarification-${i.clarificationQuestions.indexOf(q)}`}
                    value={i.clarificationAnswers[q] ?? ""}
                    placeholder="Antwort oder „unbekannt“"
                    onChange={(e) =>
                      setI({
                        ...i,
                        clarificationAnswers: {
                          ...i.clarificationAnswers,
                          [q]: e.target.value,
                        },
                      })
                    }
                  />
                </label>
              ))}
              <button className="button secondary" onClick={() => save()}>
                <Save />
                Antworten speichern
              </button>
            </section>
          )}
          <section className="panel">
            <div className="panel-title">
              <div>
                <span className="kicker">EDITIERBARER PROJEKTSTECKBRIEF</span>
                <h2>Zielbild und Discovery</h2>
              </div>
              <div className="brief-actions">
                {editingBrief && (
                  <button
                    className="icon-button"
                    onClick={() => {
                      setEditingBrief(false);
                      void api.idea(current.id).then(setI);
                    }}
                    aria-label="Bearbeitung abbrechen"
                  >
                    <X />
                  </button>
                )}
                <button
                  className="icon-button"
                  onClick={() => {
                    if (editingBrief)
                      void save().then(() => setEditingBrief(false));
                    else setEditingBrief(true);
                  }}
                  aria-label={
                    editingBrief
                      ? "Steckbrief speichern"
                      : "Steckbrief bearbeiten"
                  }
                >
                  {editingBrief ? <Save /> : <Pencil />}
                </button>
              </div>
            </div>
            {editingBrief ? (
              <div className="brief-editor">
                {parseBrief(i.brief).map((section, index, sections) => (
                  <label key={`${section.heading}-${index}`}>
                    {section.heading}
                    <textarea
                      name={`brief-section-${index}`}
                      value={section.content}
                      rows={Math.max(3, section.content.split("\n").length + 1)}
                      onChange={(event) => {
                        const next = sections.map((value, sectionIndex) =>
                          sectionIndex === index
                            ? { ...value, content: event.target.value }
                            : value,
                        );
                        setI({ ...i, brief: serializeBrief(next) });
                      }}
                    />
                  </label>
                ))}
              </div>
            ) : (
              <div className="brief-document">
                {parseBrief(i.brief).map((section, index) => (
                  <section key={`${section.heading}-${index}`}>
                    <h3>{section.heading}</h3>
                    {section.content
                      .split(/\n{2,}/)
                      .map((paragraph, paragraphIndex) => (
                        <p key={paragraphIndex}>{paragraph}</p>
                      ))}
                  </section>
                ))}
              </div>
            )}
          </section>
          <section className="panel">
            <span className="kicker">CLAUDE-EMPFEHLUNG</span>
            <h2>Warum diese Einordnung?</h2>
            <p className="assessment">
              {i.assessment || "Noch keine Bewertung vorhanden."}
            </p>
            <div className="reasoning">
              <div>
                <b>KI-Relevanz: {i.aiRelevance}</b>
                <p>{i.relevanceRationale}</p>
              </div>
              <div>
                <b>Konventionelle Alternative</b>
                <p>{i.conventionalAlternative}</p>
              </div>
            </div>
            <h3>Annahmen</h3>
            <ul>
              {i.assumptions.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
            <h3>Risiken</h3>
            <ul>
              {i.risks.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </section>
          <ReviewFlags flags={i.reviewFlags} />
          <section className="panel history">
            <span className="kicker">ÄNDERUNGSPROTOKOLL</span>
            <h2>Nachvollziehbare Historie</h2>
            {history.map((h, n) => (
              <div key={`${h.at}-${n}`}>
                <b>{h.event.replaceAll("-", " ")}</b>
                <time>{new Date(h.at).toLocaleString("de-DE")}</time>
              </div>
            ))}
          </section>
        </div>
        <aside className="score-panel">
          <span className="kicker">BEWERTUNG</span>
          <h2>Wirkung und Machbarkeit</h2>
          <div className="score-components">
            {Object.entries(i.scoreComponents).map(([name, value]) => (
              <span key={name}>
                {name}
                <b>{value}</b>
              </span>
            ))}
          </div>
          {(["priority", "impact", "effort"] as const).map((k) => (
            <label key={k}>
              <span>
                {k === "priority"
                  ? "Priorität"
                  : k === "impact"
                    ? "Impact"
                    : "Aufwand"}{" "}
                <b>
                  {i.scores[k]}/{k === "priority" ? 5 : 10}
                </b>
              </span>
              <input
                name={`score-${k}`}
                type="range"
                min="1"
                max={k === "priority" ? 5 : 10}
                value={i.scores[k]}
                onChange={(e) =>
                  setI({
                    ...i,
                    scores: { ...i.scores, [k]: Number(e.target.value) },
                  })
                }
              />
            </label>
          ))}
          <div className="confidence">
            <span>Konfidenz</span>
            <b>{i.scores.confidence}%</b>
            <small>
              Wie belastbar die Empfehlung auf Basis der bekannten Fakten ist.
            </small>
          </div>
          <label>
            Grund für manuelle Änderung
            <textarea
              name="override-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Pflichtfeld für einen nachvollziehbaren Override"
            />
          </label>
          <button
            className="button secondary full"
            onClick={override}
            disabled={!reason.trim()}
          >
            <Save />
            Bewertung mit Grund speichern
          </button>
          {i.override && (
            <div className="override">
              <RefreshCw />
              <span>
                <b>Manuell angepasst</b>
                <small>
                  Vorher: {i.override.previous} · {i.override.reason}
                </small>
              </span>
            </div>
          )}
          <hr />
          <EvidenceBadge level={i.evidenceLevel} explain />
          {i.sources.map((s) => (
            <a
              className="source"
              href={s.url}
              target="_blank"
              rel="noreferrer"
              key={s.url}
            >
              {s.publisher}: {s.title}
            </a>
          ))}
        </aside>
      </div>
    </>
  );
}
