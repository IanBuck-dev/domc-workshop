import type {
  Idea,
  ProcessRecord,
  Workshop,
} from "../../../../packages/domain/src/schemas";
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
  if (!r.ok) throw new Error(data.error ?? "Die Aktion ist fehlgeschlagen.");
  return data;
}
export const api = {
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
