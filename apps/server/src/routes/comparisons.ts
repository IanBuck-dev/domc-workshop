import { Hono } from "hono";
import type { AssessmentRecord } from "../../../../packages/domain/src/assessment.ts";
import { rankAssessments } from "../../../../packages/domain/src/scoring.ts";
import type { AssessmentRepository } from "../../../../packages/storage/src/assessment-repository.ts";

function comparisonMetrics(
  assessment: AssessmentRecord,
  rankByAssessmentId: Map<string, number>,
) {
  const populated = assessment.criteria.filter(
    (item) => item.value !== null,
  ).length;
  const findingCounts = { info: 0, warning: 0, blocking: 0 };
  for (const finding of [
    ...(assessment.review?.deterministicWarnings ?? []),
    ...(assessment.review?.findings ?? []),
  ])
    findingCounts[finding.severity]++;
  return {
    assessmentId: assessment.id,
    mode: assessment.mode,
    aiCompletionCoverage:
      assessment.metrics.aiPopulatedBeforeHuman / assessment.criteria.length,
    finalCompleteness: populated / assessment.criteria.length,
    humanOverrideCount: assessment.metrics.humanOverrideCount,
    humanOverrideRate:
      populated === 0 ? 0 : assessment.metrics.humanOverrideCount / populated,
    gatewayFollowUpUsage: assessment.gateway.followUpsUsed,
    mainChatTurns: assessment.metrics.mainChatTurns,
    followUpChatTurns: assessment.metrics.followUpChatTurns,
    userElapsedMs: assessment.metrics.userElapsedMs,
    aiProcessingMs: assessment.metrics.aiProcessingMs,
    uploadCount: assessment.uploads.length,
    inputTokens: assessment.metrics.inputTokens,
    outputTokens: assessment.metrics.outputTokens,
    model: assessment.configSnapshot.ai.model,
    reviewerFindings: findingCounts,
    overallScore: assessment.calculatedResults?.overallScore ?? null,
    rank: rankByAssessmentId.get(assessment.id) ?? null,
    facilitatorRatings: assessment.metrics.facilitatorRatings,
  };
}

export function comparisonRoutes(repo: AssessmentRepository) {
  const app = new Hono();
  app.get("/:comparisonGroupId", async (c) => {
    const comparisonGroupId = c.req.param("comparisonGroupId");
    const allAssessments = await repo.list();
    const assessments = allAssessments.filter(
      (item) => item.comparisonGroupId === comparisonGroupId,
    );
    if (!assessments.length)
      return c.json({ error: "Vergleich nicht gefunden." }, 404);
    const hashes = new Set(assessments.map((item) => item.configHash));
    if (hashes.size !== 1)
      return c.json(
        {
          error:
            "Nur Bewertungen mit identischer Konfiguration sind direkt vergleichbar.",
        },
        409,
      );
    const criterionIds = assessments[0]!.configSnapshot.criteria.map(
      (item) => item.id,
    );
    const criterionDifferences = criterionIds.map((criterionId) => ({
      criterionId,
      values: assessments.map((assessment) => ({
        assessmentId: assessment.id,
        mode: assessment.mode,
        value:
          assessment.criteria.find((item) => item.criterionId === criterionId)
            ?.value ?? null,
      })),
      differs:
        new Set(
          assessments.map((assessment) =>
            JSON.stringify(
              assessment.criteria.find(
                (item) => item.criterionId === criterionId,
              )?.value ?? null,
            ),
          ),
        ).size > 1,
    }));
    const ranked = rankAssessments(
      allAssessments.filter(
        (assessment) =>
          assessment.state === "confirmed" &&
          assessment.gateway.hasClearAiSignal === true &&
          assessment.calculatedResults,
      ),
    );
    const rankByAssessmentId = new Map(
      ranked.map((assessment, index) => [assessment.id, index + 1]),
    );
    return c.json({
      assessments,
      metrics: assessments.map((assessment) =>
        comparisonMetrics(assessment, rankByAssessmentId),
      ),
      criterionDifferences,
    });
  });
  return app;
}
