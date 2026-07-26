import { SandboxRunner, type SandboxRunnerOptions } from "./sandbox-runner.ts";
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

  constructor(options: SandboxRunnerOptions | SandboxRunner = {}) {
    const runner =
      options instanceof SandboxRunner ? options : new SandboxRunner(options);
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
