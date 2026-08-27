import type { AiRuntimeProvider } from "../../ai-runtime/src/contracts.ts";
import type { SandboxRunnerOptions } from "./sandbox-runner.ts";
import { providerRuntime } from "./provider-runtime.ts";
import type {
  OpportunityAiAdapter,
  OpportunityHypothesisRequest,
  OpportunityScenarioRequest,
} from "./opportunity-ai-contracts.ts";
import { OpportunityHypothesisAdapter } from "./opportunity-hypothesis-adapter.ts";
import { OpportunityScenarioAdapter } from "./opportunity-scenario-adapter.ts";

export class ClaudeOpportunityAiAdapter implements OpportunityAiAdapter {
  private readonly hypotheses: OpportunityHypothesisAdapter;
  private readonly scenarios: OpportunityScenarioAdapter;

  constructor(options: AiRuntimeProvider | SandboxRunnerOptions = {}) {
    const runner = providerRuntime(options);
    this.hypotheses = new OpportunityHypothesisAdapter(runner);
    this.scenarios = new OpportunityScenarioAdapter(runner);
  }

  discoverHypotheses(request: OpportunityHypothesisRequest) {
    return this.hypotheses.run(request);
  }

  createScenarios(request: OpportunityScenarioRequest) {
    return this.scenarios.run(request);
  }
}

export type * from "./opportunity-ai-contracts.ts";
