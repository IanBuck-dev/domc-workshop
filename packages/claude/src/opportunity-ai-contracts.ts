import type {
  OpportunityHypothesisAiResult,
  OpportunityHypothesis,
  OpportunityContractSnapshot,
  OpportunityProcessSnapshot,
  OpportunityScenarioResult,
} from "../../domain/src/opportunity-discovery.ts";
import type {
  AiRuntimeModelConfig,
  AiStructuredResult,
} from "./ai-runtime-contracts.ts";

interface OpportunityAiContext {
  processId: string;
  configHash: string;
  model: AiRuntimeModelConfig;
  sourceProcess: OpportunityProcessSnapshot;
  contracts: OpportunityContractSnapshot;
  signal?: AbortSignal;
}

export interface OpportunityHypothesisRequest extends OpportunityAiContext {
  instructions: string;
}

export interface OpportunityScenarioRequest extends OpportunityAiContext {
  instructions: string;
  highConfidenceHypotheses: OpportunityHypothesis[];
}

export interface OpportunityAiAdapter {
  discoverHypotheses(
    request: OpportunityHypothesisRequest,
  ): Promise<AiStructuredResult<OpportunityHypothesisAiResult>>;
  createScenarios(
    request: OpportunityScenarioRequest,
  ): Promise<AiStructuredResult<OpportunityScenarioResult>>;
}
