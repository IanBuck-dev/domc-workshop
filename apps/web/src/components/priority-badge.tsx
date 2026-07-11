import { priorityMeta } from "../../../../packages/domain/src/priority";
export function PriorityBadge({ value }: { value: number }) {
  const m = priorityMeta[value as keyof typeof priorityMeta];
  return (
    <span className={`badge priority p${value}`}>
      <b>{value}</b> · {m.label}
    </span>
  );
}
