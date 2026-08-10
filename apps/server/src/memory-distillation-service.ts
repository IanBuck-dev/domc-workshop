import type { MemoryDistillationAiAdapter } from "../../../packages/claude/src/memory-distillation-contracts.ts";
import { ChatCaptureRepository } from "../../../packages/storage/src/chat-capture-repository.ts";
import type { MemoryRepository } from "../../../packages/storage/src/memory-repository.ts";
import type { ProcessCaptureRepository } from "../../../packages/storage/src/process-capture-repository.ts";
import { loadMemoryDistillationDefaults } from "./memory-distillation-defaults.ts";
import { enqueueProcessOperation } from "./process-operation-manager.ts";

export class MemoryDistillationService {
  constructor(
    readonly processes: ProcessCaptureRepository,
    readonly memory: MemoryRepository,
    private readonly ai: MemoryDistillationAiAdapter,
    private readonly defaultsRoot?: string,
  ) {}

  enqueue(processId: string) {
    return enqueueProcessOperation(
      processId,
      "memory-distillation",
      async (signal) => {
        try {
          const result = await this.distill(processId, signal);
          await this.processes.appendHistory(processId, "memory-distilled", {
            changedTopics: result.changedTopics,
            trace: result.trace,
          });
        } catch (error) {
          await this.processes.appendHistory(
            processId,
            "memory-distillation-failed",
            {
              message:
                error instanceof Error
                  ? error.message
                  : "Destillation fehlgeschlagen",
            },
          );
        }
      },
      async () => {
        await this.processes.appendHistory(
          processId,
          "memory-distillation-failed",
          {
            message: "Destillation vor dem Start abgebrochen",
          },
        );
      },
      { allowSameProcessFollowup: true },
    );
  }

  async distill(processId: string, signal?: AbortSignal) {
    const record = await this.processes.required(processId);
    if (
      record.state !== "confirmed" ||
      !record.confirmedAt ||
      !record.understanding ||
      record.interactionMode !== "chat"
    )
      throw new Error(
        "Nur ein bestätigter Chat-Prozess kann destilliert werden.",
      );
    const [contracts, transcript, topicFiles] = await Promise.all([
      loadMemoryDistillationDefaults(this.defaultsRoot),
      new ChatCaptureRepository(this.processes.root).transcript(processId),
      this.memory.topicContents(),
    ]);
    const model = {
      model: "claude-opus-4-8",
      effort: "medium",
      timeoutMs: record.configSnapshot.ai.timeoutMs,
      maxOutputTokens: record.configSnapshot.ai.maxOutputTokens,
      maxInputCharacters: record.configSnapshot.ai.maxInputCharacters,
      maxBudgetUsd: record.configSnapshot.ai.maxBudgetUsd,
    } as const;
    const result = await this.ai.distill({
      processId,
      transcript,
      understanding: record.understanding,
      topicFiles,
      contracts,
      model,
      signal,
    });
    const applied = await this.memory.applyOperations(
      `distillation:${processId}`,
      result.value,
      { processId, confirmedAt: record.confirmedAt.slice(0, 10) },
    );
    return { ...applied, trace: result.trace };
  }
}
