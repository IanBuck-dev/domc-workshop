import { FormEvent, useState } from "react";
import { CheckCircle2, RefreshCw, SearchCheck, Send } from "lucide-react";
import type { AssessmentRecord } from "../lib/assessment-types";
import { ReviewFindings } from "./review-findings";

export function ReviewPanel({
  assessment,
  busy,
  onReview,
  onAcknowledge,
  onApplyCorrection,
  onReviewMessage,
  onConfirm,
}: {
  assessment: AssessmentRecord;
  busy: boolean;
  onReview: () => void;
  onAcknowledge: (id: string) => void;
  onApplyCorrection: (criterionId: string, value: number | boolean) => void;
  onReviewMessage: (message: string) => Promise<string>;
  onConfirm: () => void;
}) {
  const [message, setMessage] = useState("");
  const [answers, setAnswers] = useState<
    Array<{ question: string; answer: string }>
  >([]);
  const [chatError, setChatError] = useState("");
  const review = assessment.review;
  const stale = review?.status === "stale";
  const findings = review
    ? [...review.deterministicWarnings, ...review.findings]
    : [];
  const unresolvedBlocking =
    findings.some((f) => f.severity === "blocking" && !f.acknowledgedAt) ??
    false;
  const unresolvedWarnings =
    findings.some((f) => f.severity === "warning" && !f.acknowledgedAt) ??
    false;
  const canConfirm =
    !!review &&
    !stale &&
    !unresolvedBlocking &&
    !unresolvedWarnings &&
    assessment.state !== "confirmed";
  return (
    <section className="panel review-panel">
      <div className="review-head">
        <div>
          <span className="kicker">UNABHÄNGIGE PLAUSIBILITÄTSPRÜFUNG</span>
          <h2>Ergebnis prüfen und abschließen</h2>
          <p>
            Die Prüfung verändert keine Eingaben. Auffälligkeiten entscheiden
            Sie selbst.
          </p>
        </div>
        <button className="button secondary" onClick={onReview} disabled={busy}>
          {stale ? <RefreshCw /> : <SearchCheck />}
          {stale ? "Ergebnis erneut prüfen" : "Ergebnis prüfen"}
        </button>
      </div>
      {stale && (
        <p className="notice warning">
          Seit der letzten Prüfung wurden Werte geändert. Bitte prüfen Sie das
          Ergebnis erneut.
        </p>
      )}
      {review && !stale && (
        <ReviewFindings
          review={review}
          onAcknowledge={onAcknowledge}
          onApplyCorrection={onApplyCorrection}
        />
      )}
      {review &&
        !stale &&
        review.chatMessagesUsed + answers.length <
          assessment.configSnapshot.ai.reviewerChatLimit && (
          <details className="review-chat">
            <summary>Prüfhinweis besprechen</summary>
            {answers.map((entry, index) => (
              <div className="review-chat-answer" key={index}>
                <p>
                  <b>Ihre Frage:</b> {entry.question}
                </p>
                <p>{entry.answer}</p>
              </div>
            ))}
            <form
              onSubmit={async (event: FormEvent) => {
                event.preventDefault();
                if (!message.trim()) return;
                const question = message;
                setMessage("");
                setChatError("");
                try {
                  const answer = await onReviewMessage(question);
                  setAnswers([...answers, { question, answer }]);
                } catch (error) {
                  setChatError((error as Error).message);
                }
              }}
            >
              <input
                name="review-message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Was möchten Sie zur Prüfung klären?"
              />
              <button
                className="small-button"
                disabled={!message.trim() || busy}
              >
                <Send />
                Senden
              </button>
            </form>
            <small>
              Höchstens {assessment.configSnapshot.ai.reviewerChatLimit}{" "}
              Rückfragen je Prüfung.
            </small>
            {chatError && <p className="notice error">{chatError}</p>}
          </details>
        )}
      {assessment.state === "confirmed" ? (
        <div className="review-ok">
          <CheckCircle2 />
          <b>Bewertung wurde verbindlich bestätigt.</b>
        </div>
      ) : (
        <button
          className="button confirm-assessment"
          disabled={!canConfirm || busy}
          onClick={onConfirm}
        >
          {assessment.mode === "chat"
            ? "Gesamte Bewertung bestätigen"
            : "Bewertung verbindlich einreichen"}
        </button>
      )}
    </section>
  );
}
