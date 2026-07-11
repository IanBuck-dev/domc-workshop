import type { Idea } from "../../../../packages/domain/src/schemas";
import { evidenceCopy } from "../lib/german-copy";
export function EvidenceBadge({
  level,
  explain = false,
}: {
  level: Idea["evidenceLevel"];
  explain?: boolean;
}) {
  return (
    <span
      className={`evidence ${level.toLowerCase()}`}
      title={evidenceCopy[level][1]}
    >
      {evidenceCopy[level][0]}
      {explain && <small>{evidenceCopy[level][1]}</small>}
    </span>
  );
}
