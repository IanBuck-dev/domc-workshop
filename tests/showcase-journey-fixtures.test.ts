import { describe, expect, test } from "bun:test";
import { access } from "node:fs/promises";
import { resolve } from "node:path";
import {
  agenticPotentialScore,
  assessableCriterionIds,
  excludedCriterionIds,
} from "../packages/domain/src/agentic-potential-assessment.ts";
import { listDocumentationFixtures } from "../scripts/documentation-fixtures.ts";
import { listShowcaseJourneyFixtures } from "../scripts/showcase-journey-fixtures.ts";

describe("LifeCorp showcase journeys", () => {
  test("define exactly the six selected completed cases", async () => {
    const journeys = await listShowcaseJourneyFixtures();
    expect(journeys.map((item) => [item.slug, item.expectedScore])).toEqual([
      ["beitragsanpassung-wohngebaeude", 79],
      ["leitungswasserschaden-wohngebaeude", 72],
      ["mahnverfahren-direktinkasso-leben", 28],
      ["sap-api-zahlungsabgleich", 46],
      ["vermittler-onboarding", 58],
      ["zahlungseingaenge-klaeren", 85],
    ]);
  });

  test("use every conversation fact once and reference existing documents", async () => {
    const journeys = await listShowcaseJourneyFixtures();
    const documentation = new Map(
      (await listDocumentationFixtures()).map((item) => [item.slug, item]),
    );
    for (const journey of journeys) {
      const fixture = documentation.get(journey.slug)!;
      expect(
        journey.conversation.map((turn) => turn.userEvidenceId).sort(),
      ).toEqual(fixture.belege.map((item) => item.id).sort());
      for (const document of journey.documents)
        await access(resolve(process.cwd(), document.source));
    }
  });

  test("derive every advertised score from criterion rows", async () => {
    const journeys = await listShowcaseJourneyFixtures();
    for (const journey of journeys) {
      const scored = new Map(
        journey.assessment.map((item) => [item.criterionId, item]),
      );
      const result = {
        schemaVersion: 1 as const,
        criteria: [
          ...assessableCriterionIds.map((criterionId) => {
            const criterion = scored.get(criterionId);
            return criterion
              ? {
                  status: "scored" as const,
                  criterionId,
                  score: criterion.score,
                  confidenceLevel: "high" as const,
                  rationale: criterion.rationale,
                  evidenceIds: ["ev-b1"],
                  hypothesisIds: ["HYP-001"],
                  assumptions: [],
                  openQuestions: [],
                }
              : {
                  status: "insufficient_evidence" as const,
                  criterionId,
                  score: null,
                  confidenceLevel: "medium" as const,
                  rationale:
                    "Für eine hohe Konfidenz fehlen bestätigte Informationen.",
                  evidenceIds: ["ev-b1"],
                  hypothesisIds: ["HYP-001"],
                  assumptions: ["Technische Ausgestaltung ist noch offen."],
                  openQuestions: [
                    "Welche Zielgröße wird verbindlich gemessen?",
                  ],
                };
          }),
          ...excludedCriterionIds.map((criterionId) => ({
            status: "policy_excluded" as const,
            criterionId,
            score: null,
            confidenceLevel: null,
            rationale: "Dieses Kriterium ist in Version 1 ausgeschlossen.",
            evidenceIds: [],
            hypothesisIds: [],
            assumptions: [],
            openQuestions: [],
          })),
        ],
      };
      expect(agenticPotentialScore(result)?.value).toBe(journey.expectedScore);
    }
  });
});
