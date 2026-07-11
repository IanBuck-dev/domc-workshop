import type { Idea, Workshop } from "../../../../packages/domain/src/schemas";
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
    req<{ available: boolean; version: string; authenticated: string }>(
      "/settings/environment",
    ),
  reset: (confirmation: string) =>
    req<{ backup: string }>("/settings/reset", {
      method: "POST",
      body: JSON.stringify({ confirmation }),
    }),
  export: () =>
    req<{ markdown: string; csv: string; count: number }>("/exports", {
      method: "POST",
    }),
};
