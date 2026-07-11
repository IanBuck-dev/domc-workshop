import type { Idea } from "./schemas.ts";
export const lifecycle: Idea["state"][] = [
  "Entwurf",
  "Klärung nötig",
  "Bewertungsbereit",
  "Bewertet",
  "Für Übergabe ausgewählt",
  "Übergeben",
];
export function nextAction(i: Idea) {
  if (i.state === "Klärung nötig") return "Rückfragen beantworten";
  if (i.state === "Bewertungsbereit" || i.state === "Entwurf")
    return "Mit Claude bewerten";
  if (i.state === "Bewertet") return "Für IT-Übergabe auswählen";
  if (i.state === "Für Übergabe ausgewählt") return "Übergabe vorbereiten";
  if (i.state === "Übergeben") return "Übergabe abgeschlossen";
  return "Idee wiederherstellen";
}
