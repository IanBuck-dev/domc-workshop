import type { Idea } from "./schemas.ts";
export function readiness(i: Idea) {
  const warnings: string[] = [];
  if (!i.brief.trim()) warnings.push("Projektsteckbrief fehlt");
  if (i.assumptions.length) warnings.push("Offene Annahmen prüfen");
  if (i.reviewFlags.length) warnings.push("Prüfstellen einbeziehen");
  return warnings;
}
export function handoverMarkdown(ideas: Idea[]) {
  return `# IT-Übergabe – KI-Ideenportfolio\n\nErstellt: ${new Date().toLocaleString("de-DE")}\n\n${ideas.map((i, n) => `## ${n + 1}. ${i.title}\n\n**Herkunft:** ${i.evidenceLevel} · **Priorität:** ${i.scores.priority}/5 · **Impact/Aufwand:** ${i.scores.impact}/${i.scores.effort}\n\n${i.brief}\n\n### Bewertung\n${i.assessment}\n\n### Prüfpunkte\n${i.reviewFlags.map((x) => `- ${x}`).join("\n") || "- Keine erfasst"}\n`).join("\n")}`;
}
