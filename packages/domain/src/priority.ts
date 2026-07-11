export const priorityMeta = {
  1: { label: "Niedrig", color: "slate" },
  2: { label: "Beobachten", color: "blue" },
  3: { label: "Relevant", color: "amber" },
  4: { label: "Hoch", color: "orange" },
  5: { label: "Kritisch", color: "red" },
} as const;
export function deterministicPriority(
  components: Record<string, number>,
  weights: Record<string, number>,
) {
  const entries = Object.entries(components);
  const totalWeight = entries.reduce(
    (sum, [key]) => sum + (weights[key] ?? 1),
    0,
  );
  const weighted = entries.reduce(
    (sum, [key, value]) => sum + value * (weights[key] ?? 1),
    0,
  );
  return Math.max(1, Math.min(5, Math.round(weighted / totalWeight)));
}
