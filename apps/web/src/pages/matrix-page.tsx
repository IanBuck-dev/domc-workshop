import { useEffect, useState } from "react";
import type { Idea } from "../../../../packages/domain/src/schemas";
import { api } from "../lib/api-client";
import { ImpactEffortMatrix } from "../components/impact-effort-matrix";
import { PriorityBadge } from "../components/priority-badge";
export function MatrixPage() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  useEffect(() => {
    api.ideas().then(setIdeas);
  }, []);
  return (
    <>
      <section className="page-title">
        <span className="kicker">ZWEITE ENTSCHEIDUNGSSICHT</span>
        <h1>Impact und Aufwand</h1>
        <p>
          Oben liegt der größere erwartete Nutzen, rechts der höhere
          Umsetzungsaufwand. Die Position verändert die Priorität nicht
          automatisch.
        </p>
      </section>
      <div className="matrix-layout">
        <ImpactEffortMatrix ideas={ideas} />
        <ol className="matrix-legend">
          {ideas.map((i, n) => (
            <li key={i.id}>
              <span>{n + 1}</span>
              <div>
                <b>{i.title}</b>
                <small>
                  Impact {i.scores.impact} · Aufwand {i.scores.effort}
                </small>
              </div>
              <PriorityBadge value={i.scores.priority} />
            </li>
          ))}
        </ol>
      </div>
    </>
  );
}
