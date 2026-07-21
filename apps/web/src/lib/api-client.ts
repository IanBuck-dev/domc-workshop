import type {
  Idea,
  ProcessRecord,
  Workshop,
} from "../../../../packages/domain/src/schemas";
import type {
  AssessmentConfig,
  AssessmentRecord,
  ComparisonResult,
  CoverData,
  GatewayUserAnswer,
  InteractionMode,
  RankingEntry,
} from "./assessment-types";
import { parseJsonEventStream, uiMessageChunkSchema } from "ai";
async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const text = await r.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    data = { error: "Der lokale Dienst hat keine gültige Antwort geliefert." };
  }
  if (r.status === 401 && !path.startsWith("/auth/")) {
    window.location.reload();
    throw new Error(
      "Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.",
    );
  }
  if (!r.ok) throw new Error(data.error ?? "Die Aktion ist fehlgeschlagen.");
  return data;
}

async function streamReq<T>(
  path: string,
  init: RequestInit,
  dataPart: string | null,
  onTextDelta?: (delta: string) => void,
): Promise<{ message: string; data: T | null }> {
  const response = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (response.status === 401 && !path.startsWith("/auth/")) {
    window.location.reload();
    throw new Error(
      "Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.",
    );
  }
  if (!response.ok || !response.body) {
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(body.error ?? "Die Aktion ist fehlgeschlagen.");
  }
  const reader = parseJsonEventStream({
    stream: response.body,
    schema: uiMessageChunkSchema,
  }).getReader();
  let message = "";
  let data: T | null = null;
  while (true) {
    const item = await reader.read();
    if (item.done) break;
    if (!item.value.success) throw item.value.error;
    const chunk = item.value.value;
    if (chunk.type === "text-delta") {
      message += chunk.delta;
      onTextDelta?.(chunk.delta);
    } else if (chunk.type === "error") {
      throw new Error(chunk.errorText);
    } else if (dataPart && chunk.type === dataPart && "data" in chunk) {
      data = chunk.data as T;
      await reader.cancel();
      return { message, data };
    }
  }
  return { message, data };
}
export const api = {
  session: () =>
    req<{ authenticated: boolean; username?: string }>("/auth/session"),
  login: (username: string, password: string) =>
    req<{ authenticated: boolean; username?: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  logout: () => req<{ ok: boolean }>("/auth/logout", { method: "POST" }),
  configDefaults: () => req<AssessmentConfig>("/config/defaults"),
  aiOperations: () =>
    req<
      Array<{
        operationId: string;
        assessmentId: string;
        operationName: string;
        state: "queued" | "running";
        position: number;
      }>
    >("/ai-operations"),
  cancelAiOperation: (operationId: string) =>
    req<{ cancelled: true }>(`/ai-operations/${operationId}`, {
      method: "DELETE",
    }),
  assessments: () => req<AssessmentRecord[]>("/assessments"),
  assessment: (id: string) => req<AssessmentRecord>(`/assessments/${id}`),
  assessmentChatHistory: (id: string) =>
    req<
      Array<{
        role: "user" | "assistant";
        content: string;
        at?: string;
        askFollowUp?: boolean;
        sectionId?: string;
        criterionDiscussion?: boolean;
      }>
    >(`/assessments/${id}/chat-history`),
  createAssessment: (value: {
    cover: CoverData;
    mode: InteractionMode;
    config: AssessmentConfig;
    demoDataConfirmed: boolean;
  }) =>
    req<AssessmentRecord>("/assessments", {
      method: "POST",
      body: JSON.stringify(value),
    }),
  duplicateAssessment: (id: string) =>
    req<AssessmentRecord>(`/assessments/${id}/duplicate-for-comparison`, {
      method: "POST",
    }),
  prepareGateway: (id: string, selectedUploadIds: string[] = []) =>
    req<AssessmentRecord>(`/assessments/${id}/gateway/prepare`, {
      method: "POST",
      body: JSON.stringify({ selectedUploadIds }),
    }),
  evaluateGateway: (
    id: string,
    answers: GatewayUserAnswer[],
    selectedUploadIds: string[] = [],
  ) =>
    req<AssessmentRecord>(`/assessments/${id}/gateway/evaluate`, {
      method: "POST",
      body: JSON.stringify({ answers, selectedUploadIds }),
    }),
  gatewayFollowUp: (id: string, answer: string) =>
    req<AssessmentRecord>(`/assessments/${id}/gateway/follow-up`, {
      method: "POST",
      body: JSON.stringify({ answer }),
    }),
  prefillForm: (id: string) =>
    req<AssessmentRecord>(`/assessments/${id}/form/prefill`, {
      method: "POST",
    }),
  updateCriterion: (
    id: string,
    criterionId: string,
    value: number | boolean | null,
  ) =>
    req<AssessmentRecord>(`/assessments/${id}/criteria/${criterionId}`, {
      method: "PATCH",
      body: JSON.stringify({ value }),
    }),
  confirmCriterion: (id: string, criterionId: string) =>
    req<AssessmentRecord>(
      `/assessments/${id}/criteria/${criterionId}/confirm`,
      {
        method: "POST",
      },
    ),
  chat: (
    id: string,
    message: string,
    criterionId?: string,
    selectedUploadIds: string[] = [],
    followUp = false,
    onTextDelta?: (delta: string) => void,
  ) =>
    streamReq<{
      assessment: AssessmentRecord;
      askFollowUp: boolean;
    }>(
      `/assessments/${id}/chat`,
      {
        method: "POST",
        body: JSON.stringify({
          message,
          criterionId,
          selectedUploadIds,
          followUp,
        }),
      },
      "data-assessment",
      onTextDelta,
    ).then(({ message: assistantMessage, data }) => {
      if (!data) throw new Error("Die KI-Antwort war unvollständig.");
      return {
        ...data.assessment,
        assistantMessage,
        askFollowUp: data.askFollowUp,
      };
    }),
  uploadAssessmentFile: async (id: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    const response = await fetch(`/api/assessments/${id}/uploads`, {
      method: "POST",
      body: form,
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) throw new Error(data.error ?? "Upload fehlgeschlagen.");
    return req<AssessmentRecord>(`/assessments/${id}`);
  },
  reviewAssessment: (id: string, selectedUploadIds: string[] = []) =>
    streamReq<AssessmentRecord>(
      `/assessments/${id}/review`,
      {
        method: "POST",
        body: JSON.stringify({ selectedUploadIds }),
      },
      "data-assessment",
    ).then(({ data }) => {
      if (!data) throw new Error("Die KI-Prüfung war unvollständig.");
      return data;
    }),
  reviewChat: (id: string, message: string, selectedUploadIds: string[] = []) =>
    streamReq<never>(
      `/assessments/${id}/review/chat`,
      {
        method: "POST",
        body: JSON.stringify({ message, selectedUploadIds }),
      },
      null,
    ).then((result) => ({ message: result.message })),
  acknowledgeFinding: (id: string, findingId: string) =>
    req<AssessmentRecord>(`/assessments/${id}/review/acknowledge`, {
      method: "POST",
      body: JSON.stringify({ findingId }),
    }),
  confirmAssessment: (id: string) =>
    req<AssessmentRecord>(`/assessments/${id}/confirm`, { method: "POST" }),
  saveFacilitatorRatings: (
    id: string,
    ratings: {
      completeness: number;
      plausibility: number;
      traceability: number;
      userEffort: number;
    },
  ) =>
    req<AssessmentRecord>(`/assessments/${id}/facilitator-ratings`, {
      method: "PATCH",
      body: JSON.stringify(ratings),
    }),
  ranking: () => req<RankingEntry[]>("/ranking"),
  comparison: (id: string) => req<ComparisonResult>(`/comparisons/${id}`),
  ideas: () => req<Idea[]>("/ideas"),
  idea: (id: string) => req<Idea>(`/ideas/${id}`),
  history: (id: string) =>
    req<Array<{ at: string; event: string; detail: unknown }>>(
      `/ideas/${id}/history`,
    ),
  create: (v: { title: string; raw: string }) =>
    req<Idea>("/ideas", { method: "POST", body: JSON.stringify(v) }),
  save: (i: Idea) =>
    req<Idea>(`/ideas/${i.id}`, { method: "PUT", body: JSON.stringify(i) }),
  claude: (id: string, op: string) =>
    req<Idea>(`/claude/${id}/${op}`, { method: "POST" }),
  settings: () => req<Workshop>("/settings"),
  saveSettings: (v: Workshop) =>
    req<Workshop>("/settings", { method: "PUT", body: JSON.stringify(v) }),
  environment: () =>
    req<{
      available: boolean;
      version: string;
      authenticated: string;
      pythonAvailable: boolean;
      pythonVersion: string;
    }>("/settings/environment"),
  reset: (confirmation: string) =>
    req<{ backup: string }>("/settings/reset", {
      method: "POST",
      body: JSON.stringify({ confirmation }),
    }),
  export: () =>
    req<{ markdown: string; csv: string; count: number }>("/exports", {
      method: "POST",
    }),
  processes: () => req<ProcessRecord[]>("/processes"),
  process: (id: string) => req<ProcessRecord>(`/processes/${id}`),
  updateProcessDepartment: (id: string, department: string) =>
    req<ProcessRecord>(`/processes/${id}/department`, {
      method: "PATCH",
      body: JSON.stringify({ department }),
    }),
  createProcess: (department = "") =>
    req<ProcessRecord>("/processes", {
      method: "POST",
      body: JSON.stringify({ department }),
    }),
  finishProcess: (id: string) =>
    req<ProcessRecord>(`/processes/${id}/finish`, { method: "POST" }),
  generatePdd: (id: string) =>
    req<ProcessRecord>(`/processes/${id}/pdd`, { method: "POST" }),
  savePdd: (id: string, pdd: string, changeNote: string) =>
    req<ProcessRecord>(`/processes/${id}/pdd`, {
      method: "PUT",
      body: JSON.stringify({ pdd, changeNote }),
    }),
  uploadProcessFile: async (id: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    const response = await fetch(`/api/processes/${id}/upload`, {
      method: "POST",
      body: form,
    });
    const data = (await response.json()) as { name?: string; error?: string };
    if (!response.ok || !data.name)
      throw new Error(
        data.error ?? "Die Datei konnte nicht hochgeladen werden.",
      );
    return data.name;
  },
};
