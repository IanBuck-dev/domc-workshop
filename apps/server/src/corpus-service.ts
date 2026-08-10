import { join } from "node:path";
import {
  buildCatalog,
  catalogSchema,
  computeSourceRevision,
  corpusIndexSchema,
  parseCorpusMarkdown,
  renderIndex,
  renderProcess,
  slug,
  type CorpusSource,
} from "../../../packages/corpus/src/index.ts";
import type { ProcessCaptureRepository } from "../../../packages/storage/src/process-capture-repository.ts";
import {
  CorpusGit,
  isMissingCorpusObject,
  withCorpusMutex,
} from "../../../packages/storage/src/corpus-git.ts";
import { normalizedProcessName } from "../../../packages/corpus/src/index.ts";
import { publishProcessChanged } from "./process-events.ts";

export type DocumentationSyncResult =
  | { result: "updated"; commit: string }
  | { result: "noop"; commit: null }
  | { result: "error"; commit: null; error: string };
export type CorpusReconcileReport = {
  aktualisiert: number;
  entfernt: number;
  unveraendert: number;
  fehler: number;
};

function sourceFrom(
  record: Awaited<ReturnType<ProcessCaptureRepository["required"]>>,
) {
  if (
    record.state !== "confirmed" ||
    !record.understanding ||
    !record.confirmedAt ||
    !record.confirmationQuality
  )
    throw new Error(
      "Der Prozess ist noch nicht vollständig für die Dokumentation bestätigt.",
    );
  return {
    id: record.id,
    cover: {
      processName: record.cover.processName,
      department: record.cover.department,
    },
    understanding: record.understanding,
    confirmedAt: record.confirmedAt,
    confirmationQuality: record.confirmationQuality,
  } satisfies CorpusSource;
}
function documentationMessage(
  title: string,
  anlass: "bestaetigung" | "reconciliation" | "ruecknahme",
  processId?: string,
  revision?: string,
) {
  return `Dokumentation aktualisiert: ${title}\n\nAnlass: ${anlass}\n${processId ? `Prozess: ${processId}\n` : ""}${revision ? `Quell-Revision: ${revision}\n` : ""}`;
}

export class CorpusService {
  readonly docsRoot: string;
  readonly git: CorpusGit;

  constructor(
    readonly processes: ProcessCaptureRepository,
    workspaceRoot: string,
  ) {
    this.docsRoot = join(workspaceRoot, "docs");
    this.git = new CorpusGit(this.docsRoot);
  }

  async initialize() {
    return withCorpusMutex(this.docsRoot, () => this.git.ensureRepo());
  }

  private async sources() {
    const { records, errors } = await this.processes.listSettled();
    const sources: CorpusSource[] = [];
    for (const record of records)
      if (record.state === "confirmed")
        try {
          sources.push(sourceFrom(record));
        } catch (error) {
          errors.push(
            error instanceof Error
              ? error
              : new Error("Die Prozessquelle konnte nicht gelesen werden."),
          );
        }
    return {
      sources: sources.sort((a, b) => a.id.localeCompare(b.id)),
      errors,
    };
  }
  private async existing(path: string) {
    if (!(await this.git.hasHead())) return null;
    try {
      const content = await this.git.show("HEAD", path);
      this.validateFile(path, content);
      return content;
    } catch (error) {
      if (isMissingCorpusObject(error)) return null;
      throw error;
    }
  }
  private validateFile(path: string, content: string) {
    if (path === "katalog.json") catalogSchema.parse(JSON.parse(content));
    else if (path === "index.md") corpusIndexSchema.parse(content);
    else if (path.endsWith(".md")) parseCorpusMarkdown(content);
  }
  private async existingCatalog() {
    const text = await this.existing("katalog.json");
    if (!text) return [];
    return catalogSchema.parse(JSON.parse(text));
  }
  private async writeIfChanged(path: string, content: string) {
    const committed = await this.existing(path);
    const working = await this.git.workingFile(path);
    if (working !== null) this.validateFile(path, working);
    if (committed === content && working === content) return false;
    await this.git.write(path, content);
    return true;
  }
  private async synchronize(
    source: CorpusSource,
    sources: CorpusSource[],
    anlass: "bestaetigung" | "reconciliation",
  ) {
    await this.git.ensureRepo();
    const catalog = buildCatalog(sources);
    const currentCatalog = await this.existingCatalog();
    const changed: string[] = [];
    const rendered = renderProcess(source, sources);
    const trackedProcessFiles = new Set(
      await this.git.files("HEAD", "prozesse"),
    );
    for (const previous of currentCatalog) {
      const oldPath = `prozesse/${previous.slug}.md`;
      if (previous.id === source.id && rendered.path !== oldPath) {
        await this.git.stageRemoval(oldPath);
        if (trackedProcessFiles.has(oldPath)) changed.push(oldPath);
      }
    }
    if (await this.writeIfChanged(rendered.path, rendered.markdown))
      changed.push(rendered.path);
    const catalogText = `${JSON.stringify(catalog, null, 2)}\n`;
    if (await this.writeIfChanged("katalog.json", catalogText))
      changed.push("katalog.json");
    const index = renderIndex(catalog);
    if (await this.writeIfChanged("index.md", index)) changed.push("index.md");
    if (!changed.length) return { changed, commit: null };
    const commit = await this.git.commit(
      changed,
      documentationMessage(
        source.cover.processName,
        anlass,
        source.id,
        computeSourceRevision(source),
      ),
    );
    return { changed, commit };
  }

  async syncProcess(id: string): Promise<DocumentationSyncResult> {
    return withCorpusMutex(this.docsRoot, async () => {
      try {
        const { sources } = await this.sources();
        const source = sources.find((item) => item.id === id);
        if (!source)
          throw new Error(
            "Der Prozess ist nicht als Dokumentationsquelle verfügbar.",
          );
        const outcome = await this.synchronize(source, sources, "bestaetigung");
        const result: DocumentationSyncResult = outcome.commit
          ? { result: "updated", commit: outcome.commit }
          : { result: "noop", commit: null };
        await this.processes.appendHistory(id, "documentation-synced", result);
        publishProcessChanged(id);
        return result;
      } catch (error) {
        const result: DocumentationSyncResult = {
          result: "error",
          commit: null,
          error:
            error instanceof Error
              ? error.message
              : "Die Dokumentation konnte nicht aktualisiert werden.",
        };
        await this.processes
          .appendHistory(id, "documentation-synced", result)
          .catch(() => undefined);
        publishProcessChanged(id);
        return result;
      }
    });
  }

  async reconcileCorpus(): Promise<CorpusReconcileReport> {
    return withCorpusMutex(this.docsRoot, async () => {
      const report: CorpusReconcileReport = {
        aktualisiert: 0,
        entfernt: 0,
        unveraendert: 0,
        fehler: 0,
      };
      try {
        await this.git.ensureRepo();
        const { sources, errors } = await this.sources();
        report.fehler += errors.length;
        const catalog = buildCatalog(sources);
        const expected = new Map(
          sources.map((source) => {
            const rendered = renderProcess(source, sources);
            return [rendered.path, rendered.markdown] as const;
          }),
        );
        const changed: string[] = [];
        const updated = new Set<string>();
        for (const [path, markdown] of expected) {
          if (await this.writeIfChanged(path, markdown)) {
            changed.push(path);
            report.aktualisiert += 1;
            const source = sources.find(
              (item) => renderProcess(item, sources).path === path,
            );
            if (source) updated.add(source.id);
          } else report.unveraendert += 1;
        }
        const existingProcessFiles = await this.git.files("HEAD", "prozesse");
        for (const oldPath of existingProcessFiles)
          if (oldPath.endsWith(".md") && !expected.has(oldPath)) {
            await this.git.stageRemoval(oldPath);
            changed.push(oldPath);
            report.entfernt += 1;
          }
        const catalogText = `${JSON.stringify(catalog, null, 2)}\n`;
        if (await this.writeIfChanged("katalog.json", catalogText))
          changed.push("katalog.json");
        if (await this.writeIfChanged("index.md", renderIndex(catalog)))
          changed.push("index.md");
        let commit: string | null = null;
        if (changed.length) {
          commit = await this.git.commit(
            changed,
            documentationMessage("Korpus", "reconciliation"),
          );
        }
        for (const source of sources)
          await this.processes.appendHistory(
            source.id,
            "documentation-synced",
            {
              result: updated.has(source.id) ? "updated" : "noop",
              commit: updated.has(source.id) ? commit : null,
            },
          );
      } catch {
        report.fehler += 1;
      }
      for (const source of (await this.sources().catch(() => ({ sources: [] })))
        .sources)
        publishProcessChanged(source.id);
      return report;
    });
  }

  async revert(commit: string) {
    return withCorpusMutex(this.docsRoot, async () => {
      await this.git.ensureRepo();
      const target = await this.git
        .log(1, 0, undefined, commit)
        .then((entries) => entries[0] ?? null);
      if (!target) throw new Error("Die Änderung wurde nicht gefunden.");
      const sourceMessage = await this.git.commitMessage(commit);
      const revision =
        /^Quell-Revision:\s*(.+)$/im.exec(sourceMessage)?.[1]?.trim() ??
        undefined;
      const title =
        target.zusammenfassung.replace(/^Dokumentation aktualisiert:\s*/, "") ||
        "Korpus";
      const processId = target.prozessId;
      const result = await this.git.revert(
        commit,
        documentationMessage(
          title,
          "ruecknahme",
          processId ?? undefined,
          revision,
        ),
      );
      if (processId && /^PROC-\d{4}$/.test(processId)) {
        await this.processes.appendHistory(processId, "documentation-synced", {
          result: "updated",
          commit: result,
          anlass: "ruecknahme",
        });
        publishProcessChanged(processId);
      }
      return { commit: result };
    });
  }

  async similarProcesses(name: string) {
    const query = slug(name).split("-").filter(Boolean);
    if (!query.length) return [];
    const queryTokens = new Set(query);
    const records = await this.processes.list();
    const candidates = new Map(
      records.map((record) => [
        record.id,
        {
          id: record.id,
          processName: record.cover.processName,
          department: record.cover.department,
        },
      ]),
    );
    try {
      await this.initialize();
      for (const entry of await this.existingCatalog())
        candidates.set(entry.id, {
          id: entry.id,
          processName: entry.titel,
          department: entry.fachbereich,
        });
    } catch {
      // Die Ähnlichkeitssuche bleibt ohne Korpus verfügbar.
    }
    return [...candidates.values()]
      .map((candidate) => {
        const tokens = new Set(
          slug(candidate.processName).split("-").filter(Boolean),
        );
        const score = [...queryTokens].filter((token) =>
          tokens.has(token),
        ).length;
        return { candidate, score };
      })
      .filter((item) => item.score > 0)
      .sort(
        (left, right) =>
          right.score - left.score ||
          normalizedProcessName(left.candidate.processName).localeCompare(
            normalizedProcessName(right.candidate.processName),
          ) ||
          left.candidate.id.localeCompare(right.candidate.id),
      )
      .slice(0, 5)
      .map(({ candidate }) => candidate);
  }
}
