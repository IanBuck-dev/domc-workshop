import { useOutletContext } from "react-router-dom";
import type { AgenticPotentialAssessmentDetail } from "./agentic-potential-assessment-types";
import type { OpportunityDiscoveryDetail } from "./opportunity-types";
import type { ProcessCaptureRecord } from "./process-types";

export interface OpportunityWorkspaceContext {
  process: ProcessCaptureRecord;
  opportunity: OpportunityDiscoveryDetail;
  assessment: AgenticPotentialAssessmentDetail | null;
  reload: () => Promise<void>;
}

export function useOpportunityWorkspace() {
  return useOutletContext<OpportunityWorkspaceContext>();
}
