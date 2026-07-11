import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, X } from "lucide-react";
import type { Idea } from "../../../../packages/domain/src/schemas";
import { quadrant } from "../../../../packages/domain/src/matrix";
export function ImpactEffortMatrix({ ideas }: { ideas: Idea[] }) {
  const nav = useNavigate();
  const [hovered, setHovered] = useState<Idea | null>(null);
  const [selected, setSelected] = useState<Idea | null>(null);
  const active = hovered ?? selected;
  return (
    <div className="matrix-wrap">
      <div className="axis y">Impact steigt</div>
      <div className="matrix" aria-label="Impact-Aufwand-Matrix">
        <div className="quad q1">Strategische Vorhaben</div>
        <div className="quad q2">Schnelle Erfolge</div>
        <div className="quad q3">Später prüfen</div>
        <div className="quad q4">Lückenfüller</div>
        {ideas.map((i, n) => (
          <button
            key={i.id}
            style={{
              left: `${(i.scores.effort - 0.5) * 10}%`,
              bottom: `${(i.scores.impact - 0.5) * 10}%`,
            }}
            className={`point p${i.scores.priority}`}
            title={`${i.title}: ${quadrant(i.scores.impact, i.scores.effort)}`}
            aria-pressed={selected?.id === i.id}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            onFocus={() => setHovered(i)}
            onBlur={() => setHovered(null)}
            onClick={() => setSelected(i)}
          >
            {n + 1}
          </button>
        ))}
        {active && (
          <aside
            className={`matrix-preview ${active.scores.impact >= 4 ? "anchor-below" : "anchor-above"}`}
            style={
              {
                "--anchor-x": `${(active.scores.effort - 0.5) * 10}%`,
                "--anchor-y": `${(10.5 - active.scores.impact) * 10}%`,
              } as React.CSSProperties
            }
            aria-live="polite"
          >
            <div>
              <small>
                {active.id} · Impact {active.scores.impact} · Aufwand{" "}
                {active.scores.effort}
              </small>
              <b>{active.title}</b>
              <p>{active.description}</p>
            </div>
            {selected && (
              <button
                className="preview-close"
                aria-label="Projektvorschau schließen"
                onClick={() => setSelected(null)}
              >
                <X />
              </button>
            )}
            <button
              className="preview-action"
              onClick={() => nav(`/ideas/${active.id}`)}
            >
              Details öffnen <ArrowRight />
            </button>
          </aside>
        )}
      </div>
      <div className="axis x">Aufwand steigt</div>
    </div>
  );
}
