import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import type { Idea, Workshop } from "../../../../packages/domain/src/schemas";
import { api } from "../lib/api-client";
import { IdeaCard } from "../components/idea-card";
export function PortfolioPage() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [workshop, setWorkshop] = useState<Workshop | null>(null);
  const [filter, setFilter] = useState("Alle");
  useEffect(() => {
    api.ideas().then(setIdeas);
    api.settings().then(setWorkshop);
  }, []);
  const shown = ideas.filter((i) => filter === "Alle" || i.state === filter);
  return (
    <>
      <section className="hero">
        <div>
          <h1>
            Die richtigen Ideen.
            <br />
            <em>Nachvollziehbar priorisiert.</em>
          </h1>
          <p>
            {workshop?.workshopSubtitle ??
              "Von der ersten Skizze bis zur belastbaren Übergabe an die IT – mit transparenten Empfehlungen und menschlicher Entscheidung."}
          </p>
        </div>
        <Link className="button hero-button" to="/neu">
          Neue Idee erfassen <ArrowUpRight />
        </Link>
        <div className="hero-stat">
          <b>{ideas.length}</b>
          <span>Ideen im Portfolio</span>
        </div>
      </section>
      <section className="section-head">
        <div>
          <span className="kicker">GEORDNET NACH PRIORITÄT</span>
          <h2>Projektportfolio</h2>
        </div>
        <div className="filters">
          {["Alle", "Bewertet", "Für Übergabe ausgewählt", "Übergeben"].map(
            (x) => (
              <button
                className={filter === x ? "active" : ""}
                onClick={() => setFilter(x)}
                key={x}
              >
                {x}
              </button>
            ),
          )}
        </div>
      </section>
      <div className="idea-list">
        {shown.map((i, n) => (
          <IdeaCard idea={i} index={n} key={i.id} />
        ))}
      </div>
    </>
  );
}
