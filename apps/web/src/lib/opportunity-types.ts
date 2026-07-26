export type {
  OpportunityDiscoveryPublicRecord,
  OpportunityDiscoveryState,
  OpportunityDiscoverySummary,
  OpportunityHypothesis,
  OpportunityHypothesisResult,
  OpportunityScenario,
  OpportunityScenarioResult,
  ScenarioLevel,
} from "../../../../packages/domain/src/opportunity-discovery";

import type { OpportunityDiscoveryPublicRecord } from "../../../../packages/domain/src/opportunity-discovery";

export interface OpportunityDiscoveryDetail {
  record: OpportunityDiscoveryPublicRecord;
  isStale: boolean;
}
