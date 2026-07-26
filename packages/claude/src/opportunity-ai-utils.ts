export function composeOpportunitySystemPrompt(
  base: string,
  phase: string,
  instruction: string,
) {
  return `${base}\n\n${phase}\n\n## Konfigurierbare Anweisung\n${instruction}`;
}

export function boundedOpportunityJson(value: unknown, limit: number) {
  const json = JSON.stringify(value, null, 2);
  if (json.length > limit)
    throw new Error(
      "Der bestätigte Prozess überschreitet das sichere KI-Eingabelimit.",
    );
  return json;
}
