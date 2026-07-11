import type { Idea, Workshop } from "../../domain/src/schemas.ts";
export function buildPrompt(
  operation: string,
  idea: Idea,
  instructions: string,
  settings: Workshop,
) {
  return `${instructions}\n\n## Operation\n${operation}\n\n## Bewertungsrahmen\nPriorität 1 (niedrig) bis 5 (kritisch), Impact und Aufwand je 1 bis 10. Workshop: ${settings.workshopTitle}.\n\n## Aktuelle Idee\nTitel: ${idea.title}\nOriginal (unveränderlich):\n${idea.raw}\n\nAktueller Steckbrief:\n${idea.brief}\n\nAntworten:\n${JSON.stringify(idea.clarificationAnswers)}\n`;
}
export function claudeArgs(model: string, effort: string, schema: unknown) {
  return [
    "-p",
    "--model",
    model,
    "--effort",
    effort,
    "--tools",
    "",
    "--strict-mcp-config",
    "--output-format",
    "json",
    "--json-schema",
    JSON.stringify(schema),
  ];
}
