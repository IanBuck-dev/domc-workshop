import type {
  AssessmentConfig,
  CalculatedResults,
  CriterionValue,
} from "./assessment.ts";

function numberValue(values: Map<string, CriterionValue>, id: string) {
  const value = values.get(id)?.value;
  if (typeof value === "boolean") return Number(value);
  if (typeof value === "number") return value;
  throw new Error(`Für das Kriterium ${id} fehlt ein Wert.`);
}

function descendingPoints(
  value: number,
  thresholds: readonly number[],
  inclusive: boolean,
) {
  const points = [4, 3, 2, 1];
  for (let index = 0; index < thresholds.length; index++) {
    if (inclusive ? value >= thresholds[index]! : value > thresholds[index]!)
      return points[index]!;
  }
  return 0;
}

function paybackPoints(value: number | null, thresholds: readonly number[]) {
  if (value === null) return 0;
  for (let index = 0; index < thresholds.length; index++) {
    if (value <= thresholds[index]!) return 4 - index;
  }
  return 0;
}

function sectionScore(
  config: AssessmentConfig,
  values: Map<string, CriterionValue>,
  sectionId: string,
  scale: number,
) {
  const criteria = config.criteria.filter(
    (criterion) => criterion.sectionId === sectionId,
  );
  const earned = criteria.reduce((sum, criterion) => {
    const raw = numberValue(values, criterion.id);
    const favorable =
      criterion.scoringDirection === "higher_is_better"
        ? raw - criterion.minimum
        : criterion.maximum - raw;
    return sum + favorable * criterion.weight;
  }, 0);
  const maximum = criteria.reduce(
    (sum, criterion) =>
      sum + (criterion.maximum - criterion.minimum) * criterion.weight,
    0,
  );
  return {
    percent: maximum === 0 ? 0 : (earned / maximum) * scale,
    earned,
    maximum,
  };
}

export function calculateAssessmentResults(
  config: AssessmentConfig,
  criteria: CriterionValue[],
): CalculatedResults {
  const parsed = new Map(criteria.map((item) => [item.criterionId, item]));
  const ids = config.scoring.financialCriterionIds;
  const annualSavings = numberValue(parsed, ids.annualSavings);
  const oneTimeSavings = numberValue(parsed, ids.oneTimeSavings);
  const annualOperatingCosts = numberValue(parsed, ids.annualOperatingCosts);
  const oneTimeCosts = numberValue(parsed, ids.oneTimeCosts);
  const annualNetBenefit = annualSavings - annualOperatingCosts;
  const initialNetCost = Math.max(0, oneTimeCosts - oneTimeSavings);
  const paybackMonths =
    annualNetBenefit <= 0 ? null : (initialNetCost / annualNetBenefit) * 12;
  const yearOneNetReturn =
    annualSavings + oneTimeSavings - annualOperatingCosts - oneTimeCosts;
  const totalCosts = annualOperatingCosts + oneTimeCosts;
  const roi = totalCosts === 0 ? null : yearOneNetReturn / totalCosts;
  const payback = paybackPoints(
    paybackMonths,
    config.scoring.paybackMonthThresholds,
  );
  const netReturn = descendingPoints(
    yearOneNetReturn,
    config.scoring.yearOneNetReturnThresholds,
    false,
  );
  const roiPoints =
    roi === null
      ? 0
      : descendingPoints(roi, config.scoring.roiThresholds, true);
  const profitabilityPercent = ((payback + netReturn + roiPoints) / 12) * 100;
  const strategic = sectionScore(
    config,
    parsed,
    config.scoring.sectionIds.strategic,
    100,
  );
  const implementation = sectionScore(
    config,
    parsed,
    config.scoring.sectionIds.implementation,
    200,
  );
  const technical = sectionScore(
    config,
    parsed,
    config.scoring.sectionIds.technical,
    200,
  );
  const absoluteNecessity = numberValue(parsed, ids.absoluteNecessity);
  const alternativlosigkeitPoints = absoluteNecessity * 100;
  const baseValue =
    config.scoring.profitabilityWeight * profitabilityPercent +
    config.scoring.strategicWeight * strategic.percent;
  const overallScore =
    baseValue * (implementation.percent / 100) * (technical.percent / 100) +
    alternativlosigkeitPoints;
  const component = (
    value: number | null,
    points: number,
    inputs: Record<string, number>,
    thresholds: readonly number[] = [],
  ) => ({
    value,
    points,
    inputs,
    thresholds: [...thresholds],
  });
  return {
    annualNetBenefit,
    initialNetCost,
    paybackMonths,
    yearOneNetReturn,
    roi,
    profitabilityPercent,
    strategicRelevancePercent: strategic.percent,
    implementationFactorPercent: implementation.percent,
    technicalAttractivenessPercent: technical.percent,
    alternativlosigkeitPoints,
    baseValue,
    overallScore,
    components: {
      payback: component(
        paybackMonths,
        payback,
        { initialNetCost, annualNetBenefit },
        config.scoring.paybackMonthThresholds,
      ),
      yearOneNetReturn: component(
        yearOneNetReturn,
        netReturn,
        { annualSavings, oneTimeSavings, annualOperatingCosts, oneTimeCosts },
        config.scoring.yearOneNetReturnThresholds,
      ),
      roi: component(
        roi,
        roiPoints,
        { yearOneNetReturn, totalCosts },
        config.scoring.roiThresholds,
      ),
      strategic: component(strategic.percent, strategic.earned, {
        maximumWeightedPoints: strategic.maximum,
      }),
      implementation: component(implementation.percent, implementation.earned, {
        maximumWeightedPoints: implementation.maximum,
      }),
      technical: component(technical.percent, technical.earned, {
        maximumWeightedPoints: technical.maximum,
      }),
      absoluteNecessity: component(
        alternativlosigkeitPoints,
        alternativlosigkeitPoints,
        { absoluteNecessity },
      ),
    },
  };
}

export function rankAssessments<
  T extends { calculatedResults: CalculatedResults | null; createdAt: string },
>(items: T[]) {
  return [...items].sort(
    (a, b) =>
      (b.calculatedResults?.overallScore ?? -Infinity) -
        (a.calculatedResults?.overallScore ?? -Infinity) ||
      (b.calculatedResults?.strategicRelevancePercent ?? -Infinity) -
        (a.calculatedResults?.strategicRelevancePercent ?? -Infinity) ||
      (b.calculatedResults?.implementationFactorPercent ?? -Infinity) -
        (a.calculatedResults?.implementationFactorPercent ?? -Infinity) ||
      a.createdAt.localeCompare(b.createdAt),
  );
}
