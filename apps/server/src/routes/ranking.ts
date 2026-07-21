import { Hono } from "hono";
import { rankAssessments } from "../../../../packages/domain/src/scoring.ts";
import type { AssessmentRepository } from "../../../../packages/storage/src/assessment-repository.ts";

export function rankingRoutes(repo: AssessmentRepository) {
  const app = new Hono();
  app.get("/", async (c) => {
    const eligible = (await repo.list()).filter(
      (item) =>
        item.state === "confirmed" &&
        item.gateway.hasClearAiSignal === true &&
        item.calculatedResults,
    );
    return c.json(
      rankAssessments(eligible).map((assessment, index) => ({
        assessment,
        rank: index + 1,
        overallScore: assessment.calculatedResults!.overallScore,
        profitabilityPercent:
          assessment.calculatedResults!.profitabilityPercent,
        strategicRelevancePercent:
          assessment.calculatedResults!.strategicRelevancePercent,
        implementationFactorPercent:
          assessment.calculatedResults!.implementationFactorPercent,
        technicalAttractivenessPercent:
          assessment.calculatedResults!.technicalAttractivenessPercent,
      })),
    );
  });
  return app;
}
