import type { Idea } from "./schemas.ts";
export const rankIdeas = (ideas: Idea[]) =>
  [...ideas].sort(
    (a, b) =>
      b.scores.priority - a.scores.priority ||
      b.scores.impact - a.scores.impact ||
      a.scores.effort - b.scores.effort ||
      a.createdAt.localeCompare(b.createdAt),
  );
