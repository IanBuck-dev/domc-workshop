import type {
  ProcessCaptureConfig,
  ProcessCaptureRecord,
  ProcessUnderstanding,
  TopicAnswer,
  WorkCharacteristicAnswer,
  UnderstandingSection,
  UploadRecord,
} from "./process-types";
import type {
  OpportunityDiscoveryDetail,
  OpportunityDiscoveryPublicRecord,
  OpportunityDiscoverySummary,
} from "./opportunity-types";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !(init.body instanceof FormData))
    headers.set("content-type", "application/json");
  const response = await fetch(`/api${path}`, { ...init, headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(
      (body as { error?: string }).error ??
        "Die Aktion konnte nicht abgeschlossen werden.",
    );
  return body as T;
}

async function uploadBlob(processId: string, uploadId: string) {
  const response = await fetch(
    `/api/processes/${encodeURIComponent(processId)}/uploads/${encodeURIComponent(uploadId)}`,
  );
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(
      (body as { error?: string }).error ??
        "Die Datei konnte nicht geöffnet werden.",
    );
  }
  return response.blob();
}

export const api = {
  session: () =>
    req<{ authenticated: boolean; username?: string }>("/auth/session"),
  login: (username: string, password: string) =>
    req<{ authenticated: boolean }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  logout: () => req<{ ok: true }>("/auth/logout", { method: "POST" }),
  configDefaults: () => req<ProcessCaptureConfig>("/config/defaults"),
  instructionPreview: (instructions: ProcessCaptureConfig["instructions"]) =>
    req<{ base: string; followUps: string; synthesis: string }>(
      "/config/instruction-preview",
      {
        method: "POST",
        body: JSON.stringify({ instructions }),
      },
    ),
  processes: () => req<ProcessCaptureRecord[]>("/processes"),
  process: (id: string) => req<ProcessCaptureRecord>(`/processes/${id}`),
  createProcess: (value: {
    cover: ProcessCaptureRecord["cover"];
    config: ProcessCaptureConfig;
    demoDataConfirmed: true;
  }) =>
    req<ProcessCaptureRecord>("/processes", {
      method: "POST",
      body: JSON.stringify(value),
    }),
  saveAnswers: (
    id: string,
    answers: TopicAnswer[],
    workCharacteristicAnswers: WorkCharacteristicAnswer[],
    selectedUploadIds: string[],
  ) =>
    req<ProcessCaptureRecord>(`/processes/${id}/answers`, {
      method: "PUT",
      body: JSON.stringify({
        answers,
        workCharacteristicAnswers,
        selectedUploadIds,
      }),
    }),
  upload: async (id: string, file: File) => {
    const body = new FormData();
    body.set("file", file);
    return req<UploadRecord>(`/processes/${id}/uploads`, {
      method: "POST",
      body,
    });
  },
  removeUpload: (id: string, uploadId: string) =>
    req<{ removed: true }>(`/processes/${id}/uploads/${uploadId}`, {
      method: "DELETE",
    }),
  uploadBlob,
  uploadDownloadUrl: (id: string, uploadId: string) =>
    `/api/processes/${encodeURIComponent(id)}/uploads/${encodeURIComponent(uploadId)}?download=1`,
  analyze: (id: string) =>
    req<{ operationId: string; state: "queued" }>(`/processes/${id}/analyze`, {
      method: "POST",
    }),
  synthesize: (id: string) =>
    req<{ operationId: string; state: "queued" }>(
      `/processes/${id}/synthesize`,
      { method: "POST" },
    ),
  correct: (
    id: string,
    section: UnderstandingSection,
    understanding: ProcessUnderstanding,
    note: string,
  ) =>
    req<ProcessCaptureRecord>(`/processes/${id}/understanding/${section}`, {
      method: "PATCH",
      body: JSON.stringify({ understanding, note }),
    }),
  correctWorkCharacteristics: (
    id: string,
    answers: WorkCharacteristicAnswer[],
    reason: string,
  ) =>
    req<ProcessCaptureRecord>(`/processes/${id}/work-characteristics`, {
      method: "PATCH",
      body: JSON.stringify({ answers, reason }),
    }),
  confirm: (id: string) =>
    req<ProcessCaptureRecord>(`/processes/${id}/confirm`, { method: "POST" }),
  deleteProcess: (id: string) =>
    req<{ id: string; deleted: true }>(`/processes/${id}`, {
      method: "DELETE",
    }),
  cancelOperation: (id: string) =>
    req<{ cancelled: true }>(`/ai-operations/${id}`, { method: "DELETE" }),
  history: (id: string) =>
    req<Array<{ at: string; event: string; detail: unknown }>>(
      `/processes/${id}/history`,
    ),
  opportunitySummaries: () =>
    req<OpportunityDiscoverySummary[]>("/opportunities"),
  opportunity: (processId: string) =>
    req<OpportunityDiscoveryDetail>(`/opportunities/${processId}`),
  startOpportunity: (processId: string) =>
    req<{
      record: OpportunityDiscoveryPublicRecord;
      operationId: string;
      state: "queued";
    }>(`/opportunities/${processId}`, { method: "POST" }),
  retryOpportunity: (processId: string) =>
    req<{ operationId: string; state: "queued" }>(
      `/opportunities/${processId}/retry`,
      { method: "POST" },
    ),
};
