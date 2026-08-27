import { opportunityHypothesisAiResultSchema } from "../../domain/src/opportunity-discovery.ts";
import type { AiRuntimeProvider } from "../../ai-runtime/src/contracts.ts";
import type { OpportunityHypothesisRequest } from "./opportunity-ai-contracts.ts";
import {
  boundedOpportunityJson,
  composeOpportunitySystemPrompt,
} from "./opportunity-ai-utils.ts";

export class OpportunityHypothesisAdapter {
  constructor(private readonly runner: AiRuntimeProvider) {}

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
