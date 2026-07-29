import type { ProcessUnderstanding } from "../lib/process-types";

export function ProcessMap({
  understanding,
}: {
  understanding: ProcessUnderstanding;
}) {
  const steps = [...understanding.steps].sort((a, b) => a.order - b.order);
  return (
    <section
      className="process-map-section"
      aria-labelledby="process-map-title"
    >
      <h2 id="process-map-title">Diagramm</h2>
      <ol className="process-map">
        {steps.map((step) => (
          <li className="map-node" key={step.id}>
            <small>Schritt {step.order}</small>
            <strong>{step.name}</strong>
          </li>
        ))}
      </ol>
    </section>
  );
}
