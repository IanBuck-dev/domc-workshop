import type { ProcessCaptureRecord } from "../lib/process-types";
export function ProcessFollowUpCard({
  question,
  topicName,
  value,
  onChange,
}: {
  question: ProcessCaptureRecord["followUps"][number];
  topicName: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="follow-up-card">
      <small>RÜCKFRAGE · {topicName}</small>
      <b>{question.question}</b>
      <textarea
        name={`follow-up-${question.id}`}
        rows={4}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
      />
    </label>
  );
}
