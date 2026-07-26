import { SandboxRunner, type SandboxRunnerOptions } from "./sandbox-runner.ts";
import type {
  FollowUpRequest,
  ProcessAiAdapter,
  SynthesisRequest,
} from "./process-ai-contracts.ts";
import { ProcessFollowUpAdapter } from "./process-follow-up-adapter.ts";
import { ProcessSynthesisAdapter } from "./process-synthesis-adapter.ts";

export class ClaudeProcessAiAdapter implements ProcessAiAdapter {
  private readonly followUpAdapter: ProcessFollowUpAdapter;
  private readonly synthesisAdapter: ProcessSynthesisAdapter;
  constructor(options: SandboxRunnerOptions | SandboxRunner = {}) {
    const runner =
      options instanceof SandboxRunner ? options : new SandboxRunner(options);
    this.followUpAdapter = new ProcessFollowUpAdapter(runner);
    this.synthesisAdapter = new ProcessSynthesisAdapter(runner);
  }
  followUps(request: FollowUpRequest) {
    return this.followUpAdapter.run(request);
  }
  synthesize(request: SynthesisRequest) {
    return this.synthesisAdapter.run(request);
  }
}
export type * from "./process-ai-contracts.ts";
