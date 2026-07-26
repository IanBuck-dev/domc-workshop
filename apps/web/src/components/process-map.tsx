import type { ProcessUnderstanding } from "../lib/process-types";
export function ProcessMap({
  understanding,
}: {
  understanding: ProcessUnderstanding;
}) {
  return (
    <section
      className="process-map-section"
      aria-labelledby="process-map-title"
    >
      <h2 id="process-map-title">Prozesskarte</h2>
      <div className="process-map" aria-hidden="true">
        {understanding.steps.map((step, index) => (
          <div className="map-node-wrap" key={step.id}>
            <article className="map-node">
              <small>SCHRITT {step.order}</small>
              <b>{step.name}</b>
              {step.responsibleRoles.length ? (
                <span>{step.responsibleRoles.join(", ")}</span>
              ) : null}
              {step.systems.length ? <em>{step.systems.join(", ")}</em> : null}
            </article>
            {index < understanding.steps.length - 1 && (
              <span className="map-arrow">→</span>
            )}
          </div>
        ))}
      </div>
      <ol className="process-map-list">
        {understanding.steps.map((step) => (
          <li key={step.id}>
            <b>{step.name}</b>
            {step.activity ? ` — ${step.activity}` : ""}
          </li>
        ))}
      </ol>
    </section>
  );
}
