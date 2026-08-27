import { ClaudeAgenticPotentialAssessmentAdapter } from "../../claude/src/agentic-potential-assessment-adapter.ts";
import { ClaudeMemoryConsolidationAdapter } from "../../claude/src/memory-consolidation-adapter.ts";
import { ClaudeMemoryDistillationAdapter } from "../../claude/src/memory-distillation-adapter.ts";
import { ClaudeOpportunityAiAdapter } from "../../claude/src/opportunity-ai-adapter.ts";
import { ClaudeProcessAiAdapter } from "../../claude/src/process-ai-adapter.ts";
import type { AiRuntimeProvider } from "./contracts.ts";

/** Provider-neutral feature names used by server wiring. Claude exports remain aliases for compatibility. */
export class ProcessAiRuntimeAdapter extends ClaudeProcessAiAdapter {
  constructor(provider: AiRuntimeProvider) {
    super(provider);
  }
}
export class OpportunityAiRuntimeAdapter extends ClaudeOpportunityAiAdapter {
  constructor(provider: AiRuntimeProvider) {
    super(provider);
  }
}
export class MemoryDistillationRuntimeAdapter extends ClaudeMemoryDistillationAdapter {
  constructor(provider: AiRuntimeProvider) {
    super(provider);
  }
}
export class MemoryConsolidationRuntimeAdapter extends ClaudeMemoryConsolidationAdapter {
  constructor(provider: AiRuntimeProvider) {
    super(provider);
  }
}
export class AgenticPotentialAssessmentRuntimeAdapter extends ClaudeAgenticPotentialAssessmentAdapter {
  constructor(provider: AiRuntimeProvider) {
    super(provider);
  }
}
