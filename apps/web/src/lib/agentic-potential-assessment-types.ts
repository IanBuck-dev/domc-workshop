export type {
  AgenticPotentialAssessmentRecord,
  AgenticAssessmentState,
  CriterionAssessment,
  AgenticAssessmentResult,
} from "../../../../packages/domain/src/agentic-potential-assessment";
import type { AgenticPotentialAssessmentRecord } from "../../../../packages/domain/src/agentic-potential-assessment";
export interface AgenticPotentialAssessmentDetail {
  record: Pick<
    AgenticPotentialAssessmentRecord,
    | "schemaVersion"
    | "id"
    | "processId"
    | "state"
    | "sourceSnapshot"
    | "result"
    | "lastError"
    | "assessmentRevision"
    | "createdAt"
    | "updatedAt"
  >;
  isStale: boolean;
}
