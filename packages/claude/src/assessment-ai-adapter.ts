import type {
  AssessmentAiAdapter,
  AssessmentChatRequest,
  CriterionDiscussionRequest,
  FormPrefillRequest,
  GatewayEvaluateRequest,
  GatewayPrepareRequest,
  GatewayReevaluateRequest,
  ReviewChatRequest,
  ReviewRequest,
} from "./assessment-ai-contracts.ts";
import { AssessmentChatClaudeAdapter } from "./assessment-chat-adapter.ts";
import { FormPrefillClaudeAdapter } from "./form-prefill-adapter.ts";
import { GatewayClaudeAdapter } from "./gateway-adapter.ts";
import { ReviewClaudeAdapter } from "./review-adapter.ts";
import { SandboxRunner, type SandboxRunnerOptions } from "./sandbox-runner.ts";

export class ClaudeAssessmentAiAdapter implements AssessmentAiAdapter {
  private readonly gateway: GatewayClaudeAdapter;
  private readonly form: FormPrefillClaudeAdapter;
  private readonly chat: AssessmentChatClaudeAdapter;
  private readonly reviewer: ReviewClaudeAdapter;

  constructor(options: SandboxRunnerOptions | SandboxRunner = {}) {
    const runner =
      options instanceof SandboxRunner ? options : new SandboxRunner(options);
    this.gateway = new GatewayClaudeAdapter(runner);
    this.form = new FormPrefillClaudeAdapter(runner);
    this.chat = new AssessmentChatClaudeAdapter(runner);
    this.reviewer = new ReviewClaudeAdapter(runner);
  }

  evaluateGateway(request: GatewayEvaluateRequest) {
    return this.gateway.evaluate(request);
  }

  prepareGateway(request: GatewayPrepareRequest) {
    return this.gateway.prepare(request);
  }

  reevaluateGateway(request: GatewayReevaluateRequest) {
    return this.gateway.reevaluate(request);
  }

  prefillForm(request: FormPrefillRequest) {
    return this.form.prefill(request);
  }

  chatTurn(request: AssessmentChatRequest) {
    return this.chat.turn(request);
  }

  discussCriterion(request: CriterionDiscussionRequest) {
    return this.chat.discuss(request);
  }

  review(request: ReviewRequest) {
    return this.reviewer.review(request);
  }

  reviewChat(request: ReviewChatRequest) {
    return this.reviewer.chat(request);
  }
}

export type * from "./assessment-ai-contracts.ts";
