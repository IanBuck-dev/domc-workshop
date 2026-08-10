import type { MemoryConsolidationAiAdapter } from "../../../packages/claude/src/memory-consolidation-contracts.ts";
import {
  isMemoryEmpty,
  parseMemoryTopicContents,
  validateMemoryConsolidation,
  type MemoryConsolidationSummary,
} from "../../../packages/domain/src/memory.ts";
import type { MemoryRepository } from "../../../packages/storage/src/memory-repository.ts";
import { loadMemoryConsolidationDefaults } from "./memory-consolidation-defaults.ts";
import { enqueueMemoryConsolidation } from "./process-operation-manager.ts";

export interface RunMemoryConsolidationOptions {
  memory: MemoryRepository;
  ai: MemoryConsolidationAiAdapter;
  defaultsRoot?: string;
  signal?: AbortSignal;
}

export interface MemoryConsolidationRunResult {
  skipped: boolean;
  summary: MemoryConsolidationSummary;
  trace?: unknown;
}

export async function runMemoryConsolidation({
  memory,
  ai,
  defaultsRoot,
  signal,
}: RunMemoryConsolidationOptions): Promise<MemoryConsolidationRunResult> {
  const topicFiles = await memory.topicContents();
  const before = parseMemoryTopicContents(topicFiles);
  if (isMemoryEmpty(before))
    return {
      skipped: true,
      summary: {
        mergedCount: 0,
        deletedCount: 0,
        movedCount: 0,
        deletions: [],
      },
    };
  const { contracts, model } =
    await loadMemoryConsolidationDefaults(defaultsRoot);
  const result = await ai.consolidate({ topicFiles, contracts, model, signal });
  const validated = validateMemoryConsolidation(before, result.value);
  const applied = await memory.replaceAllForConsolidation(
    validated.topicFiles,
    validated.summary,
  );
  return { skipped: false, summary: applied.summary, trace: result.trace };
}

export class MemoryConsolidationService {
  constructor(
    readonly memory: MemoryRepository,
    private readonly ai: MemoryConsolidationAiAdapter,
    private readonly defaultsRoot?: string,
  ) {}

  start() {
    return enqueueMemoryConsolidation(async (signal) => {
      const result = await runMemoryConsolidation({
        memory: this.memory,
        ai: this.ai,
        defaultsRoot: this.defaultsRoot,
        signal,
      });
      return result.summary;
    });
  }
}
