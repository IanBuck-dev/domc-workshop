import { useEffect, useState } from "react";
import { FileDown, CheckCircle2, AlertCircle, Circle, X } from "lucide-react";
import type { Idea } from "../../../../packages/domain/src/schemas";
import { readiness } from "../../../../packages/domain/src/handover";
import { api } from "../lib/api-client";
import { PriorityBadge } from "../components/priority-badge";

function briefExcerpt(brief: string) {
  return brief
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
}

export function HandoverPage() {
  const [ideas, setIdeas] = useState<Idea[]>([]),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    api.ideas().then((x) => setIdeas(x.filter((i) => i.state !== "Entwurf")));
  }, []);
  const isSelected = (i: Idea) =>
    i.state === "Für Übergabe ausgewählt" || i.state === "Übergeben";
  const selected = ideas.filter(isSelected);
  async function toggle(idea: Idea) {
    setBusy(true);
    try {
      const saved = await api.save({
        ...idea,
        state: isSelected(idea) ? "Bewertet" : "Für Übergabe ausgewählt",
      });
      setIdeas((current) =>
        current.map((i) => (i.id === saved.id ? saved : i)),
      );
      setMessage("");
    } finally {
      setBusy(false);
    }
  }
  async function clearSelection() {
    setBusy(true);
    try {
      const updates = await Promise.all(
        selected.map((idea) => api.save({ ...idea, state: "Bewertet" })),
      );
      const byId = new Map(updates.map((idea) => [idea.id, idea]));
      setIdeas((current) => current.map((idea) => byId.get(idea.id) ?? idea));
      setMessage("");
    } finally {
      setBusy(false);
    }
  }
  async function exp() {
    try {
      const r = await api.export();
      setMessage(`${r.count} Projekte exportiert: ${r.markdown} und ${r.csv}`);
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  return (
    <>
      <section className="page-title">
        <span className="kicker">VOM WORKSHOP ZUR UMSETZUNG</span>
        <h1>IT-Übergabe</h1>
        <p>
          Wählen Sie die Vorhaben für die IT-Übergabe aus. Bestehende Auswahlen
          sind bereits markiert; offene Annahmen und Prüfpunkte bleiben
          sichtbar.
        </p>
        <div className="handover-actions">
          <button
            className="button"
            onClick={exp}
            disabled={!selected.length || busy}
          >
            <FileDown />
            Markdown & CSV erstellen ({selected.length})
          </button>
          <button
            className="button secondary"
            onClick={clearSelection}
            disabled={!selected.length || busy}
          >
            <X />
            Auswahl aufheben
          </button>
        </div>
        {message && <p className="notice">{message}</p>}
      </section>
      <div className="handover-selection-head">
        <b>
          {selected.length} von {ideas.length} Projekten ausgewählt
        </b>
        <span>Klicken Sie auf ein Projekt, um die Auswahl zu ändern.</span>
      </div>
      <div className="handover-list selectable">
        {ideas.map((i, n) => {
          const warnings = readiness(i);
          const active = isSelected(i);
          return (
            <article
              key={i.id}
              className={active ? "selected" : ""}
              onClick={() => !busy && toggle(i)}
            >
              <span className="handover-number">{n + 1}</span>
              <div>
                <div className="card-labels">
                  <PriorityBadge value={i.scores.priority} />
                  <span>{i.id}</span>
                </div>
                <h2>{i.title}</h2>
                <p>{briefExcerpt(i.brief)}</p>
                {warnings.map((w) => (
                  <span className="warning-chip" key={w}>
                    <AlertCircle />
                    {w}
                  </span>
                ))}
              </div>
              <button
                className="selection-toggle"
                aria-label={`${i.title} ${active ? "abwählen" : "auswählen"}`}
                aria-pressed={active}
                disabled={busy}
                onClick={(event) => {
                  event.stopPropagation();
                  void toggle(i);
                }}
              >
                {active ? <CheckCircle2 /> : <Circle />}
              </button>
            </article>
          );
        })}
      </div>
    </>
  );
}
