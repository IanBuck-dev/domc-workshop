import type { AiRuntimeProvider } from "../../ai-runtime/src/contracts.ts";
import { SandboxRunner, type SandboxRunnerOptions } from "./sandbox-runner.ts";

export function providerRuntime(
  value: AiRuntimeProvider | SandboxRunnerOptions = {},
): AiRuntimeProvider {
  return "runStructured" in value ? value : new SandboxRunner(value);
}
