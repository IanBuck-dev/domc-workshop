import type {
  GatewayEvaluateRequest,
  GatewayPrepareRequest,
  GatewayReevaluateRequest,
} from "./assessment-ai-contracts.ts";
import {
  gatewayElicitationResultSchema,
  gatewayResultSchema,
} from "./response-schemas.ts";
import {
  boundedJson,
  loadPrompt,
  loadResponseJsonSchema,
  systemPrompt,
} from "./assessment-ai-utils.ts";
import { SandboxRunner } from "./sandbox-runner.ts";

export class GatewayClaudeAdapter {
  constructor(private readonly runner: SandboxRunner) {}

  async prepare(request: GatewayPrepareRequest) {
    if (request.questions.length !== 4)
      throw new Error("Gateway requires exactly four questions.");
    const prompt = await loadPrompt("gateway-elicitation");
    const responseJsonSchema = await loadResponseJsonSchema(
      "gateway-elicitation",
    );
    const result = await this.runner.runStructured({
      assessmentId: request.assessmentId,
      operationName: "gateway-prepare",
      prompt: `## Prozesskontext und Prüfkriterien\n${boundedJson(
        { cover: request.cover, questions: request.questions },
        request.model.maxInputCharacters,
      )}`,
      systemPrompt: systemPrompt(prompt, request),
      responseSchema: gatewayElicitationResultSchema,
      responseJsonSchema,
      model: request.model,
      tools: request.selectedUploads?.length ? "workspace" : "none",
      selectedUploads: request.selectedUploads,
      signal: request.signal,
    });
    const expectedIds = request.questions.map((question) => question.id).sort();
    const receivedIds = result.value.questions
      .map((question) => question.questionId)
      .sort();
    if (receivedIds.join("|") !== expectedIds.join("|"))
      throw new Error(
        "Gateway elicitation does not reference exactly the configured questions.",
      );
    return result;
  }

  async evaluate(request: GatewayEvaluateRequest) {
    return this.run("gateway-evaluate", request, {
      cover: request.cover,
      questions: request.questions,
      followUpAllowed: request.followUpAllowed,
    });
  }

  async reevaluate(request: GatewayReevaluateRequest) {
    return this.run("gateway-reevaluate", request, {
      cover: request.cover,
      questions: request.questions,
      previousResult: request.previousResult,
      followUpQuestion: request.followUpQuestion,
      followUpAnswer: request.followUpAnswer,
      followUpAllowed: false,
      instruction:
        "Dies ist die einzige Neubewertung. followUpQuestion muss null sein.",
    });
  }

  private async run(
    operationName: string,
    request: GatewayEvaluateRequest,
    input: unknown,
  ) {
    if (request.questions.length !== 4)
      throw new Error("Gateway requires exactly four questions.");
    const prompt = await loadPrompt("gateway");
    const responseJsonSchema = await loadResponseJsonSchema("gateway-result");
    const result = await this.runner.runStructured({
      assessmentId: request.assessmentId,
      operationName,
      prompt: `## Bewertungsdaten\n${boundedJson(input, request.model.maxInputCharacters)}`,
      systemPrompt: systemPrompt(prompt, request),
      responseSchema: gatewayResultSchema,
      responseJsonSchema,
      model: request.model,
      tools: request.selectedUploads?.length ? "workspace" : "none",
      selectedUploads: request.selectedUploads,
      signal: request.signal,
    });
    const expectedIds = new Set(
      request.questions.map((question) => question.id),
    );
    if (
      result.value.decisions.some(
        (decision) => !expectedIds.has(decision.questionId),
      )
    )
      throw new Error("Gateway result references an unknown question.");
    const hasUnclear = result.value.decisions.some(
      (decision) => decision.decision === "unclear",
    );
    if (
      result.value.followUpQuestion &&
      (!request.followUpAllowed || !hasUnclear)
    )
      throw new Error(
        "Gateway returned a follow-up outside the configured rule.",
      );
    return result;
  }
}
