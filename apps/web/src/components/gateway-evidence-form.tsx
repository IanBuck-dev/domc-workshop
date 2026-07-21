import { FormEvent, useState } from "react";
import { ArrowRight, Check, CircleHelp, CircleOff } from "lucide-react";
import {
  gatewayHelpText,
  gatewayResponseKindFor,
  gatewayUserQuestion,
  type GatewayUserAnswer,
} from "../../../../packages/domain/src/assessment";
import type { AssessmentRecord } from "../lib/assessment-types";

interface GatewayEvidenceFormProps {
  assessment: AssessmentRecord;
  busy: boolean;
  mode: "form" | "chat";
  onSubmit: (answers: GatewayUserAnswer[]) => Promise<void>;
}

type DraftAnswer = Pick<GatewayUserAnswer, "response" | "responseKind">;

export function GatewayEvidenceForm({
  assessment,
  busy,
  mode,
  onSubmit,
}: GatewayEvidenceFormProps) {
  const [answers, setAnswers] = useState<Record<string, DraftAnswer>>({});
  const [formError, setFormError] = useState("");
  const questions = [...assessment.configSnapshot.gateway.questions].sort(
    (left, right) => left.displayOrder - right.displayOrder,
  );
  const adaptiveById = new Map(
    assessment.gateway.elicitation?.questions.map((question) => [
      question.questionId,
      question,
    ]) ?? [],
  );

  function setAnswer(questionId: string, answer: DraftAnswer) {
    setAnswers((current) => ({ ...current, [questionId]: answer }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (questions.some((question) => !answers[question.id]?.response.trim())) {
      setFormError(
        "Bitte beantworten Sie alle vier Fragen oder wählen Sie „Weiß ich nicht“ beziehungsweise „Trifft nicht zu“.",
      );
      return;
    }
    setFormError("");
    await onSubmit(
      questions.map((question) => ({
        questionId: question.id,
        response: answers[question.id]?.response.trim() ?? "",
        responseKind:
          answers[question.id]?.responseKind ?? ("description" as const),
      })),
    );
  }

  return (
    <form
      onSubmit={submit}
      className={mode === "form" ? "gateway-list" : "gateway-chat-evidence"}
    >
      {mode === "chat" && (
        <article className="chat-message assistant gateway-chat-intro">
          {assessment.gateway.elicitation?.assistantMessage ?? (
            <>
              <b>
                Damit ich „{assessment.cover.processName}“ richtig verstehe:
              </b>
              <span>
                Beschreiben Sie die folgenden Punkte bitte aus Ihrem
                Arbeitsalltag. Sie müssen keine technischen Schnittstellen oder
                Datenmodelle kennen.
              </span>
            </>
          )}
        </article>
      )}
      {questions.map((question, index) => {
        const current = answers[question.id];
        const adaptive = adaptiveById.get(question.id);
        return (
          <fieldset
            className={`panel gateway-question ${mode === "chat" ? "gateway-chat-card" : ""}`}
            key={question.id}
          >
            <legend>
              <span>{index + 1}</span>
              {question.name}
            </legend>
            <label>
              {mode === "chat" && adaptive
                ? adaptive.question
                : gatewayUserQuestion(question)}
              <textarea
                name={`gateway-${question.id}`}
                rows={mode === "chat" ? 4 : 5}
                value={current?.response ?? ""}
                onChange={(event) =>
                  setAnswer(question.id, {
                    response: event.target.value,
                    responseKind: gatewayResponseKindFor(event.target.value),
                  })
                }
                required
              />
            </label>
            <p className="gateway-help">{gatewayHelpText(question)}</p>
            {mode === "chat" && !!adaptive?.recognitionAids.length && (
              <div className="gateway-hypotheses">
                <small>
                  Möglicherweise relevant – nur auswählen, wenn es wirklich
                  zutrifft:
                </small>
                <div>
                  {adaptive.recognitionAids.map((aid) => {
                    const lines = (current?.response ?? "")
                      .split("\n")
                      .filter(Boolean);
                    const markers = {
                      confirmed: `Trifft zu: ${aid}`,
                      rejected: `Trifft nicht zu: ${aid}`,
                      unknown: `Unbekannt: ${aid}`,
                    };
                    const state = Object.entries(markers).find(([, marker]) =>
                      lines.includes(marker),
                    )?.[0];
                    const choose = (next: keyof typeof markers) => {
                      const withoutAid = lines.filter(
                        (line) => !Object.values(markers).includes(line),
                      );
                      setAnswer(question.id, {
                        response:
                          state === next
                            ? withoutAid.join("\n")
                            : [...withoutAid, markers[next]].join("\n"),
                        responseKind: "description",
                      });
                    };
                    return (
                      <div className="gateway-hypothesis-card" key={aid}>
                        <span>{aid}</span>
                        <div>
                          <button
                            type="button"
                            className={state === "confirmed" ? "selected" : ""}
                            onClick={() => choose("confirmed")}
                            aria-label={`${aid}: Trifft zu`}
                          >
                            <Check /> Trifft zu
                          </button>
                          <button
                            type="button"
                            className={state === "rejected" ? "selected" : ""}
                            onClick={() => choose("rejected")}
                            aria-label={`${aid}: Trifft nicht zu`}
                          >
                            <CircleOff /> Trifft nicht zu
                          </button>
                          <button
                            type="button"
                            className={state === "unknown" ? "selected" : ""}
                            onClick={() => choose("unknown")}
                            aria-label={`${aid}: Weiß ich nicht`}
                          >
                            <CircleHelp /> Weiß ich nicht
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="gateway-answer-actions">
              <button
                type="button"
                className={
                  current?.responseKind === "unknown"
                    ? "text-button selected"
                    : "text-button"
                }
                onClick={() =>
                  setAnswer(question.id, {
                    response: "Weiß ich nicht",
                    responseKind: "unknown",
                  })
                }
              >
                <CircleHelp /> Weiß ich nicht
              </button>
              <button
                type="button"
                className={
                  current?.responseKind === "not_applicable"
                    ? "text-button selected"
                    : "text-button"
                }
                onClick={() =>
                  setAnswer(question.id, {
                    response: "Trifft in diesem Prozess nicht zu",
                    responseKind: "not_applicable",
                  })
                }
              >
                <CircleOff /> Trifft nicht zu
              </button>
            </div>
          </fieldset>
        );
      })}
      {formError && <p className="notice error">{formError}</p>}
      <button className="button gateway-submit" disabled={busy}>
        {busy ? "Angaben werden geprüft …" : "Angaben prüfen"}
        <ArrowRight />
      </button>
    </form>
  );
}
