import { describe, expect, test } from "bun:test";
import { rankIdeas } from "../packages/domain/src/ranking";
import { quadrant } from "../packages/domain/src/matrix";
import { deterministicPriority } from "../packages/domain/src/priority";
import { demoIdeas } from "../packages/storage/src/seed";
import {
  discoveryTurnSchema,
  processExtractionSchema,
} from "../packages/domain/src/schemas";
import {
  interviewBudget,
  interviewQuestionCount,
} from "../packages/domain/src/discovery";
describe("portfolio domain", () => {
  test("ranks priority, impact, then low effort", () => {
    const ranked = rankIdeas(demoIdeas);
    expect(ranked[0].id).toBe("IDEA-0001");
    expect(ranked.at(-1)?.id).toBe("IDEA-0012");
  });
  test("covers all matrix quadrants", () => {
    expect(
      new Set(demoIdeas.map((i) => quadrant(i.scores.impact, i.scores.effort)))
        .size,
    ).toBe(4);
  });
  test("contains every priority", () =>
    expect(new Set(demoIdeas.map((i) => i.scores.priority))).toEqual(
      new Set([1, 2, 3, 4, 5]),
    ));
  test("maps weighted components deterministically", () =>
    expect(
      deterministicPriority(
        { businessImpact: 5, feasibility: 3 },
        { businessImpact: 2, feasibility: 1 },
      ),
    ).toBe(4));
});

describe("process discovery domain", () => {
  test("counts assistant questions and enforces the configured interview budget", () => {
    const transcript = [
      {
        role: "assistant" as const,
        text: "Was kostet viel Zeit?",
        timestamp: "1",
      },
      { role: "user" as const, text: "Kündigungen", timestamp: "2" },
      {
        role: "assistant" as const,
        text: "Wie kommt es an? Was passiert danach?",
        timestamp: "3",
      },
    ];
    expect(interviewQuestionCount(transcript)).toBe(3);
    expect(interviewBudget(transcript, 4)).toEqual({
      questionsAsked: 3,
      remainingQuestions: 1,
      phase: "final-confirmation",
    });
    expect(interviewBudget(transcript, 3).phase).toBe("complete");
  });

  test("round-trips a classified extraction and validated turn envelope", () => {
    const extraction = processExtractionSchema.parse({
      schemaVersion: 1,
      processName: "Posteingang",
      department: "Leistung",
      steps: [
        {
          id: "S1",
          description: "E-Mail lesen",
          inputs: ["E-Mail"],
          outputs: ["Zuordnung"],
          classification: "KI-erforderlich",
          reasoning: "Freitext muss verstanden werden.",
        },
      ],
    });
    expect(extraction.steps[0].classification).toBe("KI-erforderlich");
    expect(
      discoveryTurnSchema.parse({
        extractionDelta: { processName: "Posteingang" },
        criteriaCoverage: 2,
        openPoints: ["Volumen"],
        interviewComplete: false,
      }).openPoints,
    ).toEqual(["Volumen"]);
  });

  test("rejects malformed classifications and completion envelopes", () => {
    expect(() =>
      discoveryTurnSchema.parse({
        extractionDelta: {
          steps: [
            {
              id: "S1",
              description: "Prüfen",
              classification: "vollautomatisch",
              reasoning: "Unzulässig",
            },
          ],
        },
        criteriaCoverage: -1,
        openPoints: [],
        interviewComplete: true,
      }),
    ).toThrow();
  });
});
