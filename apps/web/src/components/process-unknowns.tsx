import type { ProcessUnderstanding } from "../lib/process-types";

export function ProcessUnknowns({
  knowledgeGaps,
}: {
  knowledgeGaps: ProcessUnderstanding["knowledgeGaps"];
}) {
  return (
    <section className="brief-section process-unknowns">
      <h2>Noch unbekannt</h2>
      {knowledgeGaps.length ? (
        <ul>
          {knowledgeGaps.map((gap) => (
            <li key={gap}>{gap}</li>
          ))}
        </ul>
      ) : (
        <p>Keine offenen Wissenslücken dokumentiert</p>
      )}
    </section>
  );
}
