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
import type { AgenticPotentialAssessmentDetail } from "./agentic-potential-assessment-types";
import type { PublicSiteInformation } from "./public-site-information";
import type { MemoryOverviewDetail } from "../../../../packages/domain/src/memory";
import type {
  CorpusEntry,
  CorpusLogEntry,
  CorpusReconcileReport,
  SimilarProcess,
} from "./corpus-types";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !(init.body instanceof FormData))
    headers.set("content-type", "application/json");
  const response = await fetch(`/api${path}`, { ...init, headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new ApiError(
      (body as { error?: string }).error ??
        "Die Aktion konnte nicht abgeschlossen werden.",
      response.status,
      (body as { code?: string }).code,
      body,
    );
  return body as T;
}

/**
 * Antworten des Korpus, die reinen Text liefern (Dateiinhalt, roher Diff). Der
 * Server darf den Text auch in ein JSON-Feld verpacken; beide Formen sind hier
 * erlaubt, damit die Oberfläche nicht an einer Transportentscheidung hängt.
 */
async function text(path: string): Promise<string> {
  const response = await fetch(`/api${path}`);
  const raw = await response.text();
  if (!response.ok) {
    let message = "Der Inhalt konnte nicht geladen werden.";
    try {
      message = (JSON.parse(raw) as { error?: string }).error ?? message;
    } catch {
      /* Kein JSON — die Standardmeldung bleibt. */
    }
    throw new ApiError(message, response.status);
  }
  if (!response.headers.get("content-type")?.includes("json")) return raw;
  const body: unknown = JSON.parse(raw);
  if (typeof body === "string") return body;
  const wrapped = body as { inhalt?: string; content?: string; diff?: string };
  return wrapped.inhalt ?? wrapped.content ?? wrapped.diff ?? "";
}

/**
 * Listenantworten. Der Server darf die Liste blank oder unter `eintraege` bzw.
 * `treffer` liefern.
 */
async function list<T>(path: string): Promise<T[]> {
  const body = await req<T[] | { eintraege?: T[]; treffer?: T[] }>(path);
  if (Array.isArray(body)) return body;
  return body.eintraege ?? body.treffer ?? [];
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

function downloadFilename(contentDisposition: string | null, fallback: string) {
  const extended = contentDisposition?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (extended) {
    try {
      return decodeURIComponent(extended);
    } catch {
      // The server fallback below remains safe if a proxy damages this header.
    }
  }
  return contentDisposition?.match(/filename="?([^";]+)"?/i)?.[1] ?? fallback;
}

async function exportPdd(processId: string) {
  const response = await fetch(
    `/api/processes/${encodeURIComponent(processId)}/pdd-export`,
    { method: "POST" },
  );
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(
      (body as { error?: string }).error ??
        "Die Excel-Arbeitsmappe konnte nicht erstellt werden.",
      response.status,
      (body as { code?: string }).code,
      body,
    );
  }
  return {
    blob: await response.blob(),
    filename: downloadFilename(
      response.headers.get("content-disposition"),
      "PDD.xlsx",
    ),
    sourceRevision: response.headers.get("x-pdd-source-revision"),
  };
}

async function demoSzenarioDatei(slug: string, zielname: string) {
  const response = await fetch(
    `/api/demo/szenarien/${encodeURIComponent(slug)}/dateien/${encodeURIComponent(zielname)}`,
  );
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(
      (body as { error?: string }).error ??
        "Die Datei konnte nicht geladen werden.",
    );
  }
  return response.blob();
}

export const api = {
  publicSiteInformation: () =>
    req<PublicSiteInformation>("/public/site-information"),
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
    interactionMode: "chat" | "form";
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
  exportPdd,
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
  chat: (id: string) => req<ChatView>(`/processes/${id}/chat`),
  /** Verzicht auf Unterlagen: fester Zustandswechsel, kein KI-Zug. */
  skipChatDocuments: (id: string, turnId: string) =>
    req<{ duplicate: boolean }>(`/processes/${id}/chat/skip-documents`, {
      method: "POST",
      body: JSON.stringify({ id: turnId }),
    }),
  /** Beendet den laufenden Zug serverseitig — er überlebt sonst jeden Reload. */
  stopChatTurn: (id: string) =>
    req<{ stopped: true }>(`/processes/${id}/chat/stop`, { method: "POST" }),
  confirmChat: (id: string, override: boolean) =>
    req<{
      record: ProcessCaptureRecord;
      opportunityStart: "failed" | "started";
    }>(`/processes/${id}/chat/confirm`, {
      method: "POST",
      body: JSON.stringify({ override }),
    }),
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
  agenticAssessment: (processId: string) =>
    req<AgenticPotentialAssessmentDetail>(
      `/opportunities/${processId}/agentic-assessment`,
    ),
  startAgenticAssessment: (processId: string) =>
    req<{ operationId: string; state: "queued" }>(
      `/opportunities/${processId}/agentic-assessment`,
      { method: "POST" },
    ),
  retryAgenticAssessment: (processId: string) =>
    req<{ operationId: string; state: "queued" }>(
      `/opportunities/${processId}/agentic-assessment/retry`,
      { method: "POST" },
    ),
  exportAgenticAssessment: async (processId: string) => {
    const response = await fetch(
      `/api/opportunities/${encodeURIComponent(processId)}/agentic-assessment/export`,
      { method: "POST" },
    );
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new ApiError(
        (body as { error?: string }).error ??
          "Die Excel-Arbeitsmappe konnte nicht erstellt werden.",
        response.status,
        undefined,
        body,
      );
    }
    return {
      blob: await response.blob(),
      filename: downloadFilename(
        response.headers.get("content-disposition"),
        "Agentische-Potenzialbewertung.xlsx",
      ),
      assessmentRevision: response.headers.get("x-agentic-assessment-revision"),
    };
  },
  memory: () => req<MemoryOverviewDetail>("/memory"),
  forgetMemory: () =>
    req<MemoryOverviewDetail>("/memory", { method: "DELETE" }),
  consolidateMemory: () =>
    req<{ operationId: string; state: "queued" }>("/memory/consolidate", {
      method: "POST",
    }),
  demoSzenarien: () => req<{ szenarien: DemoSzenario[] }>("/demo/szenarien"),
  demoSzenarioDatei,
  /** Ähnliche bestehende Prozessnamen — verhindert Dubletten bei der Anlage. */
  similarProcesses: (name: string) =>
    list<SimilarProcess>(`/processes/similar?name=${encodeURIComponent(name)}`),
  corpus: {
    tree: (path = "", rev = "HEAD") =>
      list<CorpusEntry>(
        `/corpus/tree?rev=${encodeURIComponent(rev)}&path=${encodeURIComponent(path)}`,
      ),
    file: (path: string, rev = "HEAD") =>
      text(
        `/corpus/file?rev=${encodeURIComponent(rev)}&path=${encodeURIComponent(path)}`,
      ),
    log: (options: { path?: string; limit?: number; skip?: number } = {}) => {
      const query = new URLSearchParams({
        limit: String(options.limit ?? 30),
        skip: String(options.skip ?? 0),
      });
      if (options.path) query.set("path", options.path);
      return list<CorpusLogEntry>(`/corpus/log?${query}`);
    },
    diff: (from: string, to: string, path?: string) => {
      const query = new URLSearchParams({ from, to });
      if (path) query.set("path", path);
      return text(`/corpus/diff?${query}`);
    },
    reconcile: () =>
      req<CorpusReconcileReport & { bericht?: CorpusReconcileReport }>(
        "/corpus/reconcile",
        { method: "POST" },
      ).then((body) => body.bericht ?? body),
    revert: (commit: string) =>
      req<unknown>(`/corpus/revert/${encodeURIComponent(commit)}`, {
        method: "POST",
      }),
  },
};

export type DemoSzenario = {
  slug: string;
  titel: string;
  cover: {
    department: string;
    participantName: string;
    participantEmail: string;
    processName: string;
  };
  interactionMode: "chat" | "form";
  dokumente: Array<{
    quelle: string;
    zielname: string;
    format: "pdf" | "csv" | "txt" | "md";
  }>;
  zuege: Array<{
    nummer: number;
    antwort: string;
    hinweis?: string;
  }>;
  formular?: {
    antworten: Record<string, string>;
    arbeitsmerkmale: Record<string, string[]>;
  };
};

type ChatView = {
  cover: ProcessCaptureRecord["cover"];
  processState: ProcessCaptureRecord["state"];
  interactionMode: "chat";
  state: import("./process-types").ChatCaptureState;
  transcript: import("./process-types").ChatTranscriptEvent[];
  uploads: UploadRecord[];
  understanding: ProcessUnderstanding | null;
  understandingStatus: "missing" | "invalid" | "valid";
  confirmationQuality: "complete" | "with_gaps" | null;
  confirmationAllowed: boolean;
  /** Läuft gerade ein Zug für diesen Prozess? Überlebt das Neuladen der Seite. */
  activeTurn: {
    turnId: string;
    action: "message" | "analyze_documents";
    kind: import("./process-types").ChatActivityKind | null;
    startedAt: string;
  } | null;
};
