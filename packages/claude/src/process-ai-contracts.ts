import type {
  Cover,
  FollowUpAnswer,
  FollowUpQuestion,
  ProcessCaptureConfig,
  ProcessUnderstanding,
  TopicAnswer,
  WorkCharacteristicAnswer,
} from "../../domain/src/process-understanding.ts";
import type {
  AiRuntimeModelConfig,
  AiStructuredResult,
} from "./ai-runtime-contracts.ts";

export type ProcessAiModelConfig = AiRuntimeModelConfig;
export interface ProcessSelectedUpload {
  id: string;
  name: string;
  path: string;
  size: number;
  sha256: string;
}
export interface ProcessAiContext {
  processId: string;
  configHash: string;
  model: ProcessAiModelConfig;
  instructions: string;
  selectedUploads: ProcessSelectedUpload[];
  signal?: AbortSignal;
}
export interface FollowUpRequest extends ProcessAiContext {
  cover: Cover;
  topics: ProcessCaptureConfig["topics"];
  mainAnswers: TopicAnswer[];
  workCharacteristicDefinitions: Array<
    Extract<
      ProcessCaptureConfig,
      { profile: { version: 2 } }
    >["workCharacteristics"][number]
  >;
  workCharacteristicAnswers: WorkCharacteristicAnswer[];
}
export interface SynthesisRequest extends FollowUpRequest {
  followUps: FollowUpQuestion[];
  followUpAnswers: FollowUpAnswer[];
}
export type ProcessAiResult<T> = AiStructuredResult<T>;
export interface FollowUpResult {
  followUps: FollowUpQuestion[];
}
export interface ProcessAiAdapter {
  followUps(request: FollowUpRequest): Promise<ProcessAiResult<FollowUpResult>>;
  synthesize(
    request: SynthesisRequest,
  ): Promise<ProcessAiResult<ProcessUnderstanding>>;
}
