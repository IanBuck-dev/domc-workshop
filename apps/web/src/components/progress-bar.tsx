export function ProgressBar({
  value,
  max,
  label,
}: {
  value: number;
  max: number;
  label: string;
}) {
  const percent = max ? Math.round((value / max) * 100) : 0;
  return (
    <div className="progress-wrap" aria-label={`${label}: ${value} von ${max}`}>
      <div className="progress-label">
        <span>{label}</span>
        <b>
          {value} von {max}
        </b>
      </div>
      <div className="progress-track">
        <span style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
