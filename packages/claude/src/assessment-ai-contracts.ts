import type {
  CriteriaProposalsResult,
  GatewayElicitationResult,
  GatewayResult,
  ReviewChatResult,
  ReviewResult,
} from "./response-schemas.ts";
import type {
  AiOperationMetadata,
  AssessmentConfig,
  CalculatedResults,
  CriterionValue,
  GatewayAssessment,
  GatewayUserAnswer,
  ReviewRecord,
} from "../../domain/src/assessment.ts";

export type AiEffort = "low" | "medium" | "high" | "xhigh" | "max";

export interface AiModelConfig {
  model: AssessmentConfig["ai"]["model"];
  effort: AiEffort;
  timeoutMs: AssessmentConfig["ai"]["timeoutMs"];
  maxOutputTokens: AssessmentConfig["ai"]["maxOutputTokens"];
  maxInputCharacters: AssessmentConfig["ai"]["maxInputCharacters"];
  maxBudgetUsd: AssessmentConfig["ai"]["maxBudgetUsd"];
}

export interface SelectedUpload {
  id: string;
  name: string;
  path: string;
  size: number;
  sha256: string;
}

export interface AiMessage {
  role: "user" | "assistant";
  content: string;
}

export type AiCriterionDefinition = AssessmentConfig["criteria"][number];

export interface AiExecutionContext {
  assessmentId: string;
  configHash: string;
  model: AiModelConfig;
  instructions: string;
  selectedUploads?: SelectedUpload[];
  signal?: AbortSignal;
}

export interface AiTrace extends AiOperationMetadata {
  sandboxed: boolean;
}

export interface AiOperationResult<T> {
  value: T;
  trace: AiTrace;
}

export type GatewayQuestionInput =
  AssessmentConfig["gateway"]["questions"][number] &
    Omit<GatewayUserAnswer, "questionId"> & {
      elicitedQuestion?: string;
    };

export interface GatewayQuestionDefinition {
  id: string;
  name: string;
  evaluationQuestion: string;
  userQuestion: string;
  helpText: string;
  displayOrder: number;
}

export interface GatewayPrepareRequest extends AiExecutionContext {
  cover: Record<string, string | null>;
  questions: GatewayQuestionDefinition[];
}

export interface GatewayEvaluateRequest extends AiExecutionContext {
  cover: Record<string, string | null>;
  questions: GatewayQuestionInput[];
  followUpAllowed: boolean;
}

export interface GatewayReevaluateRequest extends GatewayEvaluateRequest {
  previousResult: GatewayResult;
  followUpQuestion: string;
  followUpAnswer: string;
}

export interface FormPrefillRequest extends AiExecutionContext {
  cover: Record<string, string | null>;
  gateway: GatewayAssessment;
  criteria: AiCriterionDefinition[];
}

export interface AssessmentChatRequest extends AiExecutionContext {
  sessionId: string;
  cover: Record<string, string | null>;
  section: { id: string; name: string; mainQuestion: string };
  criteria: AiCriterionDefinition[];
  currentValues: CriterionValue[];
  transcript: AiMessage[];
  userMessage: string;
  questionsRemaining: number;
}

export interface CriterionDiscussionRequest extends AssessmentChatRequest {
  criterionId: string;
}

export interface ReviewRequest extends AiExecutionContext {
  cover: Record<string, string | null>;
  configSnapshot: AssessmentConfig;
  gateway: GatewayAssessment;
  criterionDefinitions: AiCriterionDefinition[];
  criteria: CriterionValue[];
  calculatedResults: CalculatedResults;
  conversationEvidence: AiMessage[];
  plausibilityWarningEuro: number;
}

export interface ReviewChatRequest extends AiExecutionContext {
  sessionId: string;
  review: ReviewRecord | ReviewResult;
  assessmentSummary: {
    gateway: GatewayAssessment;
    criteria: CriterionValue[];
    calculatedResults: CalculatedResults;
  };
  transcript: AiMessage[];
  userMessage: string;
  messagesRemaining: number;
}

export interface AssessmentAiAdapter {
  prepareGateway?(
    request: GatewayPrepareRequest,
  ): Promise<AiOperationResult<GatewayElicitationResult>>;
  evaluateGateway(
    request: GatewayEvaluateRequest,
  ): Promise<AiOperationResult<GatewayResult>>;
  reevaluateGateway(
    request: GatewayReevaluateRequest,
  ): Promise<AiOperationResult<GatewayResult>>;
  prefillForm(
    request: FormPrefillRequest,
  ): Promise<AiOperationResult<CriteriaProposalsResult>>;
  chatTurn(
    request: AssessmentChatRequest,
  ): Promise<AiOperationResult<CriteriaProposalsResult>>;
  discussCriterion(
    request: CriterionDiscussionRequest,
  ): Promise<AiOperationResult<CriteriaProposalsResult>>;
  review(request: ReviewRequest): Promise<AiOperationResult<ReviewResult>>;
  reviewChat(
    request: ReviewChatRequest,
  ): Promise<AiOperationResult<ReviewChatResult>>;
}
