import { access, cp, mkdir, readFile, rm, readdir } from "node:fs/promises";
import { join } from "node:path";
import { zipSync, strToU8 } from "fflate";
import { load, dump } from "js-yaml";
import { workshopSchema, type Workshop } from "../../domain/src/schemas.ts";
import { atomicWrite } from "./atomic-write.ts";
import { demoIdeas } from "./seed.ts";
import { MarkdownIdeaRepository } from "./markdown-idea-repository.ts";
export class WorkspaceRepository {
  constructor(
    public root: string,
    public defaults = join(process.cwd(), "defaults"),
  ) {}
  async ensure() {
    await mkdir(this.root, { recursive: true });
    try {
      await access(join(this.root, "workshop.yaml"));
    } catch {
      await cp(join(this.defaults, "CLAUDE.md"), join(this.root, "CLAUDE.md"));
      await cp(
        join(this.defaults, "workshop.yaml"),
        join(this.root, "workshop.yaml"),
      );
      await cp(join(this.defaults, "templates"), join(this.root, "templates"), {
        recursive: true,
      });
      await cp(this.defaults, join(this.root, "defaults"), { recursive: true });
      const repo = new MarkdownIdeaRepository(this.root);
      for (const i of demoIdeas) await repo.save(i, "seed");
      await cp(
        join(this.root, "ideas"),
        join(this.root, "defaults", "demo-ideas"),
        { recursive: true },
      );
      await mkdir(join(this.root, "exports"), { recursive: true });
      await mkdir(join(this.root, "backups"), { recursive: true });
    }
    await mkdir(join(this.root, "processes"), { recursive: true });
    for (const [source, target] of [
      ["CLAUDE-discovery.md", "CLAUDE-discovery.md"],
      [join("templates", "pdd.md"), join("templates", "pdd.md")],
    ]) {
      try {
        await access(join(this.root, target));
      } catch {
        await mkdir(join(this.root, "templates"), { recursive: true });
        await cp(join(this.defaults, source), join(this.root, target));
      }
    }
  }
  async settings() {
    const [stored, defaults] = await Promise.all([
      readFile(join(this.root, "workshop.yaml"), "utf8"),
      readFile(join(this.defaults, "workshop.yaml"), "utf8"),
    ]);
    const storedValue = load(stored) as Record<string, unknown>;
    const defaultValue = workshopSchema.parse(load(defaults));
    const migrated = workshopSchema.parse({
      ...defaultValue,
      ...storedValue,
      weights: {
        ...defaultValue.weights,
        ...((storedValue.weights as Record<string, number> | undefined) ?? {}),
      },
      discovery: {
        ...defaultValue.discovery,
        ...((storedValue.discovery as Record<string, unknown> | undefined) ??
          {}),
      },
    });
    if (
      storedValue.scoringGuidance === undefined ||
      storedValue.weights === undefined ||
      storedValue.discovery === undefined
    ) {
      await this.saveSettings(migrated);
    }
    return migrated;
  }
  async saveSettings(v: Workshop) {
    await atomicWrite(
      join(this.root, "workshop.yaml"),
      dump(workshopSchema.parse(v), { lineWidth: 120 }),
    );
  }
  async reset() {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backup = join(this.root, "backups", `workspace-${stamp}.zip`);
    const files: Record<string, Uint8Array> = {};
    const collect = async (dir: string, prefix: string) => {
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        const name = `${prefix}${entry.name}`;
        if (entry.isDirectory()) await collect(path, `${name}/`);
        else files[name] = strToU8(await readFile(path, "utf8"));
      }
    };
    await collect(join(this.root, "ideas"), "ideas/");
    files["workshop.yaml"] = strToU8(
      await readFile(join(this.root, "workshop.yaml"), "utf8"),
    );
    files["CLAUDE.md"] = strToU8(
      await readFile(join(this.root, "CLAUDE.md"), "utf8"),
    );
    await atomicWrite(backup, zipSync(files));
    await rm(join(this.root, "ideas"), { recursive: true, force: true });
    await cp(join(this.defaults, "CLAUDE.md"), join(this.root, "CLAUDE.md"));
    await cp(
      join(this.defaults, "workshop.yaml"),
      join(this.root, "workshop.yaml"),
    );
    const repo = new MarkdownIdeaRepository(this.root);
    for (const i of demoIdeas) await repo.save(i, "reset");
    return backup;
  }
}
