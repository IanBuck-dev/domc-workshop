import type { ProcessUnderstanding } from "../lib/process-types";
import { Card } from "./ui/card";

export function ProcessUnknowns({
  knowledgeGaps,
}: {
  knowledgeGaps: ProcessUnderstanding["knowledgeGaps"];
}) {
  return (
    <Card as="section" className="gap-4 p-6 sm:p-8">
      <h2 className="text-2xl font-bold tracking-tight">Noch unbekannt</h2>
      {knowledgeGaps.length ? (
        <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
          {knowledgeGaps.map((gap) => (
            <li key={gap}>{gap}</li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">
          Keine offenen Wissenslücken dokumentiert
        </p>
      )}
    </Card>
  );
}
