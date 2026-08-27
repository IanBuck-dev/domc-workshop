import { opportunityScenarioAiResultSchema } from "../../domain/src/opportunity-discovery.ts";
import type { AiRuntimeProvider } from "../../ai-runtime/src/contracts.ts";
import type { OpportunityScenarioRequest } from "./opportunity-ai-contracts.ts";
import {
  boundedOpportunityJson,
  composeOpportunitySystemPrompt,
} from "./opportunity-ai-utils.ts";

export class OpportunityScenarioAdapter {
  constructor(private readonly runner: AiRuntimeProvider) {}

  run(request: OpportunityScenarioRequest) {
    return this.runner.runStructured({
      processId: request.processId,
      operationName: "opportunity-scenarios",
      prompt: `## Bestätigter Prozesssnapshot und ausgewählte Szenariohypothesen\n${boundedOpportunityJson(
        {
          sourceProcess: request.sourceProcess,
          scenarioBasis: request.scenarioBasis,
          scenarioHypotheses: request.scenarioHypotheses,
        },
        request.model.maxInputCharacters,
      )}`,
      systemPrompt: composeOpportunitySystemPrompt(
        request.contracts.basePrompt,
        request.contracts.scenariosPrompt,
        request.instructions,
      ),
      responseSchema: opportunityScenarioAiResultSchema,
      responseJsonSchema: request.contracts.scenariosSchema,
      structuredOutput: "prompted",
      model: request.model,
      tools: "none",
      signal: request.signal,
    });
  }
}
