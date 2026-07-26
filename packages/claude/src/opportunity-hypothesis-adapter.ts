import { opportunityHypothesisAiResultSchema } from "../../domain/src/opportunity-discovery.ts";
import { SandboxRunner } from "./sandbox-runner.ts";
import type { OpportunityHypothesisRequest } from "./opportunity-ai-contracts.ts";
import {
  boundedOpportunityJson,
  composeOpportunitySystemPrompt,
} from "./opportunity-ai-utils.ts";

export class OpportunityHypothesisAdapter {
  constructor(private readonly runner: SandboxRunner) {}

  run(request: OpportunityHypothesisRequest) {
    return this.runner.runStructured({
      processId: request.processId,
      operationName: "opportunity-hypotheses",
      prompt: `## Bestätigter Prozesssnapshot\n${boundedOpportunityJson(request.sourceProcess, request.model.maxInputCharacters)}`,
      systemPrompt: composeOpportunitySystemPrompt(
        request.contracts.basePrompt,
        request.contracts.hypothesesPrompt,
        request.instructions,
      ),
      responseSchema: opportunityHypothesisAiResultSchema,
      responseJsonSchema: request.contracts.hypothesesSchema,
      model: request.model,
      tools: "none",
      signal: request.signal,
    });
  }
}
