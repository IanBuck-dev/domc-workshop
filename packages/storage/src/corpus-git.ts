import { mkdir, readFile, realpath, rm, stat } from "node:fs/promises";
import { basename, join, normalize, relative, resolve } from "node:path";
import { atomicWrite } from "./atomic-write.ts";

export type CorpusTreeEntry = {
  name: string;
  path: string;
  type: "blob" | "tree";
  size: number;
};
export type CorpusLogEntry = {
  sha: string;
  autor: string;
  datum: string;
  anlass: "bestaetigung" | "reconciliation" | "ruecknahme" | null;
  prozessId: string | null;
  zusammenfassung: string;
  dateien: Array<{ status: string; path: string }>;
};

// Die Viewer-API akzeptiert absichtlich keine verkürzten Git-Referenzen. Das
// verhindert mehrdeutige Auflösung und hält die Parameterverträge stabil.
const fullSha = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
const revision = /^(?:HEAD|[a-f0-9]{40}|[a-f0-9]{64})$/;
const commit = fullSha;
const paths = new Map<string, Promise<void>>();

export function validRevision(value: string) {
  return revision.test(value);
}
export function validCommit(value: string) {
  return commit.test(value);
}
export function corpusPath(value: string) {
  if (!value || value === ".") return "";
  if (value.includes("\0") || value.startsWith("/") || value.includes("\\"))
    throw new Error("Ungültiger Dokumentationspfad.");
  const normalized = normalize(value).replace(/^\.\//, "");
  if (
    normalized === ".." ||
    normalized.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) ||
    normalized
      .split(/[\\/]/)
      .some((part) => !part || part === "." || part === "..")
  )
    throw new Error("Ungültiger Dokumentationspfad.");
  return normalized.replace(/\\/g, "/");
}

export function withCorpusMutex<T>(root: string, action: () => Promise<T>) {
  const key = resolve(root);
  const previous = paths.get(key) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = previous.then(() => current);
  paths.set(key, tail);
  return previous.then(action).finally(() => {
    release();
    if (paths.get(key) === tail) paths.delete(key);
  });
}

export class CorpusGit {
  constructor(
    public root: string,
    private readonly executable = "git",
  ) {}

  private environment() {
    const environment = { ...process.env } as Record<
      string,
      string | undefined
    >;
    delete environment.GIT_DIR;
    delete environment.GIT_WORK_TREE;
    delete environment.GIT_INDEX_FILE;
    return {
      ...environment,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_GLOBAL: "/dev/null",
    };
  }
  private async run(args: string[], input?: string) {
    try {
      const child = Bun.spawn({
        cmd: [
          this.executable,
          "-c",
          "user.name=Prozessdokumentation",
          "-c",
          "user.email=app@lifecorp.example",
          "-c",
          "commit.gpgsign=false",
          ...args,
        ],
        cwd: this.root,
        env: this.environment(),
        stdin: input ? new TextEncoder().encode(input) : undefined,
        stdout: "pipe",
        stderr: "pipe",
      });
      const [stdout, stderr, exitCode] = await Promise.all([
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
        child.exited,
      ]);
      if (exitCode !== 0)
        throw new CorpusGitCommandError(exitCode, stderr.trim());
      return stdout;
    } catch (error) {
      if (error instanceof Error && /ENOENT|not found/i.test(error.message))
        throw new Error("Git ist auf diesem System nicht verfügbar.");
      if (error instanceof CorpusGitCommandError) throw error;
      throw new Error("Git konnte die Dokumentation nicht verarbeiten.");
    }
  }
  async ensureRepo() {
    await mkdir(this.root, { recursive: true });
    const hasOwnRepository = await stat(join(this.root, ".git"))
      .then((entry) => entry.isDirectory() || entry.isFile())
      .catch(() => false);
    if (!hasOwnRepository) {
      await this.run(["init", "-b", "main"]);
      return;
    }
    const topLevel = (await this.run(["rev-parse", "--show-toplevel"])).trim();
    const [actualRoot, actualTopLevel] = await Promise.all([
      realpath(this.root),
      realpath(topLevel),
    ]);
    if (actualTopLevel !== actualRoot)
      throw new Error("Das Dokumentationsarchiv ist beschädigt.");
  }
  async hasHead() {
    try {
      await this.run(["rev-parse", "--verify", "HEAD"]);
      return true;
    } catch {
      return false;
    }
  }
  async tree(rev = "HEAD", path = ""): Promise<CorpusTreeEntry[]> {
    if (!validRevision(rev)) throw new Error("Ungültige Revision.");
    const safePath = corpusPath(path);
    if (!(await this.hasHead())) return [];
    const output = await this.run([
      "ls-tree",
      "-z",
      "-l",
      rev,
      "--",
      ...(safePath ? [`${safePath}/`] : []),
    ]);
    return output
      .split("\0")
      .filter(Boolean)
      .map((row) => {
        const match = /^(\d+) (blob|tree) [a-f0-9]+\s+(\d+|-)[\t ](.+)$/.exec(
          row,
        );
        if (!match)
          throw new Error("Git lieferte einen ungültigen Verzeichniseintrag.");
        const itemPath = match[4]!;
        return {
          name: basename(itemPath),
          path: itemPath,
          type: match[2]! as "blob" | "tree",
          size: match[3] === "-" ? 0 : Number(match[3]),
        };
      });
  }
  async files(rev = "HEAD", path = "") {
    if (!validRevision(rev)) throw new Error("Ungültige Revision.");
    const safePath = corpusPath(path);
    if (!(await this.hasHead())) return [];
    const output = await this.run([
      "ls-tree",
      "-r",
      "-z",
      "--name-only",
      rev,
      "--",
      ...(safePath ? [safePath] : []),
    ]);
    return output.split("\0").filter(Boolean).map(corpusPath);
  }
  async show(rev: string, path: string) {
    if (!validRevision(rev)) throw new Error("Ungültige Revision.");
    const safePath = corpusPath(path);
    if (!safePath) throw new Error("Ein Dokumentationspfad ist erforderlich.");
    if (!(await this.hasHead()))
      throw new Error("Die Dokumentation enthält noch keine Dateien.");
    return this.run(["show", `${rev}:${safePath}`, "--"]);
  }
  async diff(from: string, to: string, path?: string) {
    if (!validCommit(from) || !validCommit(to))
      throw new Error("Ungültige Revision.");
    const safePath = path === undefined ? undefined : corpusPath(path);
    if (!(await this.hasHead())) return "";
    return this.run([
      "diff",
      "--no-color",
      from,
      to,
      ...(safePath ? ["--", safePath] : []),
    ]);
  }
  async log(
    limit: number,
    skip: number,
    path?: string,
    rev = "HEAD",
  ): Promise<CorpusLogEntry[]> {
    if (!validRevision(rev)) throw new Error("Ungültige Revision.");
    if (!(await this.hasHead())) return [];
    const safePath = path === undefined ? undefined : corpusPath(path);
    const output = await this.run([
      "log",
      "-z",
      `--max-count=${limit}`,
      `--skip=${skip}`,
      "--pretty=format:%x1e%H%x00%an%x00%aI%x00%s%x00%b%x00",
      "--name-status",
      ...(safePath ? ["--follow", rev, "--", safePath] : [rev]),
    ]);
    const entries: CorpusLogEntry[] = [];
    for (const record of output.split("\x1e").filter(Boolean)) {
      const parts = record.replace(/^\n+/, "").split("\0");
      const sha = parts.shift() ?? "";
      const autor = parts.shift() ?? "";
      const datum = parts.shift() ?? "";
      const zusammenfassung = parts.shift() ?? "";
      const body = parts.shift() ?? "";
      const dateien: Array<{ status: string; path: string }> = [];
      let index = 0;
      while (index < parts.length) {
        const status = (parts[index++] ?? "").trim();
        const path = parts[index++];
        if (!status || !path) continue;
        if (/^[RC]/.test(status)) {
          const renamedPath = parts[index++];
          dateien.push({ status, path: renamedPath || path });
        } else dateien.push({ status, path });
      }
      const trailer = (name: string) =>
        new RegExp(`^${name}:\\s*(.+)$`, "mi").exec(body)?.[1]?.trim() ?? null;
      const anlass = trailer("Anlass");
      entries.push({
        sha,
        autor,
        datum,
        anlass:
          anlass === "bestaetigung" ||
          anlass === "reconciliation" ||
          anlass === "ruecknahme"
            ? anlass
            : null,
        prozessId: trailer("Prozess"),
        zusammenfassung,
        dateien,
      });
    }
    return entries;
  }
  async commit(
    pathsToAdd: string[],
    message: string,
    author = "Prozessdokumentation <app@lifecorp.example>",
  ) {
    const files = [...new Set(pathsToAdd.map(corpusPath))].filter(Boolean);
    if (!files.length) return null;
    await this.run(["add", "-A", "--", ...files]);
    const staged = await this.run([
      "diff",
      "--cached",
      "--name-only",
      "--",
      ...files,
    ]);
    if (!staged.trim()) return null;
    await this.run(
      ["commit", "--author", author, "-F", "-", "--", ...files],
      message,
    );
    return (await this.run(["rev-parse", "HEAD"])).trim();
  }
  async stageRemoval(path: string) {
    const safePath = corpusPath(path);
    if (!safePath) return;
    await rm(resolve(this.root, safePath), { force: true });
  }
  async write(path: string, content: string) {
    const safePath = corpusPath(path);
    const target = resolve(this.root, safePath);
    if (relative(this.root, target).startsWith(".."))
      throw new Error("Ungültiger Dokumentationspfad.");
    await atomicWrite(target, content);
  }
  async workingFile(path: string) {
    const safePath = corpusPath(path);
    if (!safePath) throw new Error("Ein Dokumentationspfad ist erforderlich.");
    try {
      return await readFile(resolve(this.root, safePath), "utf8");
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT")
        return null;
      throw error;
    }
  }
  async commitMessage(sha: string) {
    if (!validCommit(sha)) throw new Error("Ungültige Änderungsreferenz.");
    return this.run(["show", "-s", "--format=%B", sha, "--"]);
  }
  async revert(sha: string, message: string) {
    if (!validCommit(sha)) throw new Error("Ungültige Änderungsreferenz.");
    try {
      await this.run(["revert", "--no-commit", sha]);
      await this.run(
        [
          "commit",
          "--author",
          "Prozessdokumentation <app@lifecorp.example>",
          "-F",
          "-",
        ],
        message,
      );
    } catch (error) {
      await this.run(["revert", "--abort"]).catch(() => undefined);
      throw error;
    }
    return (await this.run(["rev-parse", "HEAD"])).trim();
  }
}

export class CorpusGitCommandError extends Error {
  constructor(
    readonly exitCode: number,
    readonly diagnostic: string,
  ) {
    super("Git konnte die Dokumentation nicht verarbeiten.");
    this.name = "CorpusGitCommandError";
  }
}

/** Git verwendet mehrere Fehltexte für nicht vorhandene Revisionsobjekte. */
export function isMissingCorpusObject(error: unknown) {
  return (
    error instanceof CorpusGitCommandError &&
    /unknown revision|bad revision|bad object|does not exist in|invalid object name|path .* does not exist/i.test(
      error.diagnostic,
    )
  );
}

/** Revert-Konflikte bleiben intern; die API liefert nur einen stabilen Fachfehler. */
export function isCorpusRevertConflict(error: unknown) {
  return (
    error instanceof CorpusGitCommandError &&
    /conflict|could not revert|would be overwritten/i.test(error.diagnostic)
  );
}
