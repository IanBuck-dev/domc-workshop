import { classNames } from "./class-names";

/**
 * Reihe gefüllter und leerer Segmente. Der Beschriftungstext ist Pflicht, weil
 * die Segmente selbst für Screenreader nichts aussagen.
 */
export function Meter({
  total,
  filled,
  label,
  className,
}: {
  total: number;
  filled: number;
  label: string;
  className?: string;
}) {
  return (
    <span
      className={classNames("meter", className)}
      role="img"
      aria-label={label}
    >
      {Array.from({ length: total }, (_, index) => (
        <span key={index} className={index < filled ? "on" : undefined} />
      ))}
    </span>
  );
}
