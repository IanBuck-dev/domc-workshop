import type {
  AssessmentConfig,
  AssessmentRecord as DomainAssessmentRecord,
  AssessmentState,
  CriterionValue,
  GatewayUserAnswer,
  InteractionMode,
  ReviewFinding,
  ReviewRecord,
} from "../../../../packages/domain/src/assessment";

export type {
  AssessmentConfig,
  AssessmentState,
  CriterionValue,
  GatewayUserAnswer,
  InteractionMode,
  ReviewFinding,
  ReviewRecord,
};
export type CoverData = DomainAssessmentRecord["cover"];
export type CriterionDefinition = AssessmentConfig["criteria"][number];
export type SectionDefinition = AssessmentConfig["chat"]["sections"][number];
export type GatewayQuestion = AssessmentConfig["gateway"]["questions"][number];

/** Presentation extension until persisted chat messages are exposed in the domain record. */
export type AssessmentRecord = DomainAssessmentRecord & {
  chat?: {
    currentSectionId?: string;
    messages: Array<{
      id?: string;
      role: "user" | "assistant";
      content: string;
      at?: string;
      askFollowUp?: boolean;
      sectionId?: string;
      criterionDiscussion?: boolean;
    }>;
    completedSectionIds?: string[];
  };
};

export interface RankingEntry {
  assessment: AssessmentRecord;
  rank: number;
  overallScore: number;
  strategicRelevancePercent?: number;
  implementationFactorPercent?: number;
  technicalAttractivenessPercent?: number;
}

export interface ComparisonResult {
  comparisonGroupId: string;
  assessments: AssessmentRecord[];
  criterionDifferences?: Array<{
    criterionId: string;
    values: Array<{
      assessmentId: string;
      mode: InteractionMode;
      value: number | boolean | null;
    }>;
    differs: boolean;
  }>;
  metrics?: Array<Record<string, unknown>>;
}
