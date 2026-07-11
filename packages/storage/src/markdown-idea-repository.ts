import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { dump, load } from "js-yaml";
import { ideaSchema, type Idea } from "../../domain/src/schemas.ts";
import { atomicWrite } from "./atomic-write.ts";
import { audit } from "./audit-log.ts";
export class MarkdownIdeaRepository {
  constructor(private root: string) {}
  private dir(id: string) {
    return join(this.root, "ideas", id);
  }
  async list() {
    let names: string[] = [];
    try {
      names = await readdir(join(this.root, "ideas"));
    } catch {
      return [];
    }
    return (
      await Promise.all(
        names.filter((x) => /^IDEA-\d{4}$/.test(x)).map((x) => this.get(x)),
      )
    ).filter(Boolean) as Idea[];
  }
  async get(id: string) {
    try {
      const d = this.dir(id);
      const meta = load(
        await readFile(join(d, "metadata.yaml"), "utf8"),
      ) as any;
      const [raw, brief, assessment] = await Promise.all(
        ["raw.md", "brief.md", "assessment.md"].map((f) =>
          readFile(join(d, f), "utf8"),
        ),
      );
      return ideaSchema.parse({ ...meta, raw, brief, assessment });
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw e;
    }
  }
  async save(i: Idea, event = "manual-update") {
    const idea = ideaSchema.parse(i),
      d = this.dir(i.id);
    const { raw, brief, assessment, ...meta } = idea;
    await Promise.all([
      atomicWrite(join(d, "raw.md"), raw),
      atomicWrite(join(d, "brief.md"), brief),
      atomicWrite(join(d, "assessment.md"), assessment),
      atomicWrite(
        join(d, "metadata.yaml"),
        dump(meta, { lineWidth: 140, noRefs: true }),
      ),
    ]);
    await audit(join(d, "history.jsonl"), event, {
      state: i.state,
      scores: i.scores,
    });
    return idea;
  }
  async create(title: string, raw: string) {
    const all = await this.list();
    const num = Math.max(0, ...all.map((x) => Number(x.id.slice(5)))) + 1,
      now = new Date().toISOString();
    const idea: Idea = {
      schemaVersion: 1,
      id: `IDEA-${String(num).padStart(4, "0")}`,
      title,
      description: raw,
      raw,
      brief: "",
      assessment: "",
      evidenceLevel: "FICTIONAL",
      sources: [],
      state: "Entwurf",
      aiRelevance: "Möglich",
      relevanceRationale: "Noch nicht bewertet",
      conventionalAlternative: "Im Assessment prüfen",
      scores: { priority: 3, impact: 5, effort: 5, confidence: 0 },
      scoreComponents: {},
      assumptions: [],
      risks: [],
      reviewFlags: [],
      clarificationQuestions: [],
      clarificationAnswers: {},
      override: null,
      handoverReady: false,
      createdAt: now,
      updatedAt: now,
    };
    return this.save(idea, "created");
  }
  async history(id: string) {
    try {
      return (await readFile(join(this.dir(id), "history.jsonl"), "utf8"))
        .trim()
        .split("\n")
        .filter(Boolean)
        .map(
          (line) =>
            JSON.parse(line) as { at: string; event: string; detail: unknown },
        )
        .reverse();
    } catch {
      return [];
    }
  }
}
