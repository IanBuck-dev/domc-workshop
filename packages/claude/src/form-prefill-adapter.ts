import type { FormPrefillRequest } from "./assessment-ai-contracts.ts";
import { criteriaProposalsResultSchema } from "./response-schemas.ts";
import {
  assertCriteriaProposals,
  boundedJson,
  loadPrompt,
  loadResponseJsonSchema,
  systemPrompt,
} from "./assessment-ai-utils.ts";
import { SandboxRunner } from "./sandbox-runner.ts";

export class FormPrefillClaudeAdapter {
  constructor(private readonly runner: SandboxRunner) {}

  async prefill(request: FormPrefillRequest) {
    const prompt = await loadPrompt("form-prefill");
    const responseJsonSchema =
      await loadResponseJsonSchema("criteria-proposals");
    const input = {
      cover: request.cover,
      gateway: request.gateway,
      criteria: request.criteria,
      instruction: "message bleibt leer und askFollowUp ist false.",
    };
    const result = await this.runner.runStructured({
      assessmentId: request.assessmentId,
      operationName: "form-prefill",
      prompt: `## Vorbefüllungsdaten\n${boundedJson(input, request.model.maxInputCharacters)}`,
      systemPrompt: systemPrompt(prompt, request),
      responseSchema: criteriaProposalsResultSchema,
      responseJsonSchema,
      model: request.model,
      tools: "none",
      selectedUploads: request.selectedUploads,
      signal: request.signal,
    });
    if (result.value.askFollowUp)
      throw new Error("Form prefill may not ask a follow-up question.");
    return assertCriteriaProposals(result, request.criteria);
  }
}
