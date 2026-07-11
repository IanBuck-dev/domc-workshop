import { Link } from "react-router-dom";
import { ArrowRight, BrainCircuit, Gauge, Timer } from "lucide-react";
import type { Idea } from "../../../../packages/domain/src/schemas";
import { PriorityBadge } from "./priority-badge";
import { EvidenceBadge } from "./evidence-badge";
import { nextAction } from "../../../../packages/domain/src/states";
export function IdeaCard({ idea, index }: { idea: Idea; index: number }) {
  return (
    <article className="idea-card">
      <div className="card-rank">{String(index + 1).padStart(2, "0")}</div>
      <div className="card-main">
        <div className="card-labels">
          <PriorityBadge value={idea.scores.priority} />
          <EvidenceBadge level={idea.evidenceLevel} />
          <span className="state">{idea.state}</span>
        </div>
        <h3>
          <Link to={`/ideas/${idea.id}`}>{idea.title}</Link>
        </h3>
        <p>{idea.description}</p>
        <div className="metrics">
          <span>
            <Gauge />
            Impact <b>{idea.scores.impact}/10</b>
          </span>
          <span>
            <Timer />
            Aufwand <b>{idea.scores.effort}/10</b>
          </span>
          <span>
            <BrainCircuit />
            KI-Relevanz <b>{idea.aiRelevance}</b>
          </span>
          <span>
            Konfidenz <b>{idea.scores.confidence}%</b>
          </span>
        </div>
      </div>
      <Link className="next" to={`/ideas/${idea.id}`}>
        <small>Nächster Schritt</small>
        {nextAction(idea)}
        <ArrowRight />
      </Link>
    </article>
  );
}
