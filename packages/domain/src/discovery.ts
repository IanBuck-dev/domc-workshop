import type { TranscriptTurn } from "./schemas.ts";

export type InterviewBudgetPhase =
  "discovery" | "final-confirmation" | "complete";

export interface InterviewBudget {
  questionsAsked: number;
  remainingQuestions: number;
  phase: InterviewBudgetPhase;
}

export function interviewQuestionCount(transcript: TranscriptTurn[]) {
  return transcript.reduce(
    (count, turn) =>
      count +
      (turn.role === "assistant" ? (turn.text.match(/\?/g)?.length ?? 0) : 0),
    0,
  );
}

export function interviewBudget(
  transcript: TranscriptTurn[],
  maxQuestions: number,
): InterviewBudget {
  const questionsAsked = interviewQuestionCount(transcript);
  const remainingQuestions = Math.max(0, maxQuestions - questionsAsked);
  const phase =
    remainingQuestions === 0
      ? "complete"
      : remainingQuestions === 1
        ? "final-confirmation"
        : "discovery";
  return { questionsAsked, remainingQuestions, phase };
}
