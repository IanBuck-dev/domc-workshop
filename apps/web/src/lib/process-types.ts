export type {
  ProcessCaptureConfig,
  ProcessCaptureRecord,
  ProcessUnderstanding,
  TopicAnswer,
  WorkCharacteristicAnswer,
  WorkCharacteristicDefinition,
  FollowUpAnswer,
  UploadRecord,
  UnderstandingSection,
} from "../../../../packages/domain/src/process-understanding";
export interface ProcessOperationStatus {
  operationId: string;
  processId: string;
  operationName: "process-follow-ups" | "process-synthesis";
  state: "queued" | "running" | "failed";
  position: number;
  createdAt: string;
  error?: string;
}
