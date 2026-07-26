import { opportunityScenarioAiResultSchema } from "../../domain/src/opportunity-discovery.ts";
import { SandboxRunner } from "./sandbox-runner.ts";
import type { OpportunityScenarioRequest } from "./opportunity-ai-contracts.ts";
import {
  boundedOpportunityJson,
  composeOpportunitySystemPrompt,
} from "./opportunity-ai-utils.ts";

export class OpportunityScenarioAdapter {
  constructor(private readonly runner: SandboxRunner) {}

  run(request: OpportunityScenarioRequest) {
    return this.runner.runStructured({
      processId: request.processId,
      operationName: "opportunity-scenarios",
      prompt: `## Bestätigter Prozesssnapshot und hoch-konfidente Hypothesen\n${boundedOpportunityJson(
        {
          sourceProcess: request.sourceProcess,
          highConfidenceHypotheses: request.highConfidenceHypotheses,
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
