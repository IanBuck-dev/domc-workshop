import { appendFile, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import {
  applyMemoryOperations,
  emptyMemoryTopics,
  memoryOperationListSchema,
  memoryConsolidationSummarySchema,
  memoryTopicDefinitions,
  memoryTopicNames,
  memoryTopicSchema,
  parseMemoryTopic,
  renderMemoryTopic,
  type MemoryOperationList,
  type MemoryConsolidationSummary,
  type MemoryTopic,
  type MemoryTopics,
} from "../../domain/src/memory.ts";
import { atomicWrite } from "./atomic-write.ts";

const historyEntrySchema = z
  .object({
    trigger: z.string().trim().min(1).max(500),
    at: z.string().datetime(),
    previous: z
      .record(z.string(), z.string().max(200_000))
      .superRefine((value, ctx) => {
        for (const topic of Object.keys(value))
          if (!memoryTopicSchema.safeParse(topic).success)
            ctx.addIssue({
              code: "custom",
              path: [topic],
              message: "Unbekannte Gedächtnisdatei.",
            });
      }),
    event: z.literal("memory-consolidated").optional(),
    summary: memoryConsolidationSummarySchema.optional(),
  })
  .strict();

export type MemoryHistoryEntry = z.infer<typeof historyEntrySchema>;

function renderMemoryIndex(topics: MemoryTopics) {
  const lines = [
    "# Unternehmensgedächtnis",
    "",
    "Dieser Index wird aus den Themen-Dateien erzeugt.",
    "",
  ];
  for (const topic of memoryTopicNames) {
    const count = topics[topic].length;
    lines.push(
      `- \`memory/${topic}\` — ${memoryTopicDefinitions[topic].description} (${count} ${count === 1 ? "Eintrag" : "Einträge"})`,
    );
  }
  return `${lines.join("\n")}\n`;
}

export class MemoryRepository {
  private writeTail: Promise<void> = Promise.resolve();

  constructor(private readonly root: string) {}

  private dir() {
    return join(this.root, "memory");
  }
  private topicPath(topic: MemoryTopic) {
    return join(this.dir(), topic);
  }
  private indexPath() {
    return join(this.dir(), "MEMORY.md");
  }
  private historyPath() {
    return join(this.dir(), "memory-history.jsonl");
  }

  private async locked<T>(work: () => Promise<T>) {
    const previous = this.writeTail;
    let release!: () => void;
    this.writeTail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous.catch(() => undefined);
    try {
      return await work();
    } finally {
      release();
    }
  }

  async ensure() {
    return this.locked(() => this.ensureUnlocked());
  }

  private async ensureUnlocked() {
    await mkdir(this.dir(), { recursive: true });
    const empty = emptyMemoryTopics();
    for (const topic of memoryTopicNames) {
      try {
        parseMemoryTopic(topic, await readFile(this.topicPath(topic), "utf8"));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        await atomicWrite(
          this.topicPath(topic),
          renderMemoryTopic(topic, empty[topic]),
        );
      }
    }
    const topics = await this.readTopicsUnlocked();
    await atomicWrite(this.indexPath(), renderMemoryIndex(topics));
  }

  async topics(): Promise<MemoryTopics> {
    return this.locked(async () => {
      await this.ensureUnlocked();
      return this.readTopicsUnlocked();
    });
  }

  private async readTopicsUnlocked(): Promise<MemoryTopics> {
    const result = emptyMemoryTopics();
    for (const topic of memoryTopicNames)
      result[topic] = parseMemoryTopic(
        topic,
        await readFile(this.topicPath(topic), "utf8"),
      );
    return result;
  }

  async topicContents(): Promise<Record<MemoryTopic, string>> {
    return this.locked(async () => {
      await this.ensureUnlocked();
      const result = {} as Record<MemoryTopic, string>;
      for (const topic of memoryTopicNames) {
        const content = await readFile(this.topicPath(topic), "utf8");
        parseMemoryTopic(topic, content);
        result[topic] = content;
      }
      return result;
    });
  }

  async history(): Promise<MemoryHistoryEntry[]> {
    await this.ensure();
    try {
      const content = await readFile(this.historyPath(), "utf8");
      return content
        .split("\n")
        .filter(Boolean)
        .map((line) => historyEntrySchema.parse(JSON.parse(line)));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }

  async applyOperations(
    trigger: string,
    operations: MemoryOperationList,
    confirmation: { processId: string; confirmedAt: string },
  ) {
    return this.locked(async () => {
      await this.ensureUnlocked();
      const validated = memoryOperationListSchema.parse(operations);
      const beforeContents = {} as Record<MemoryTopic, string>;
      const current = emptyMemoryTopics();
      for (const topic of memoryTopicNames) {
        const content = await readFile(this.topicPath(topic), "utf8");
        beforeContents[topic] = content;
        current[topic] = parseMemoryTopic(topic, content);
      }
      const next = applyMemoryOperations(current, validated, confirmation);
      const changes = memoryTopicNames.filter(
        (topic) =>
          renderMemoryTopic(topic, current[topic]) !==
          renderMemoryTopic(topic, next[topic]),
      );
      if (changes.length) {
        const previous = Object.fromEntries(
          changes.map((topic) => [topic, beforeContents[topic]]),
        ) as Record<MemoryTopic, string>;
        const history = historyEntrySchema.parse({
          trigger: z.string().trim().min(1).max(500).parse(trigger),
          at: new Date().toISOString(),
          previous,
        });
        await appendFile(
          this.historyPath(),
          `${JSON.stringify(history)}\n`,
          "utf8",
        );
        await Promise.all(
          changes.map((topic) =>
            atomicWrite(
              this.topicPath(topic),
              renderMemoryTopic(topic, next[topic]),
            ),
          ),
        );
      }
      await atomicWrite(this.indexPath(), renderMemoryIndex(next));
      return { topics: next, changedTopics: changes };
    });
  }

  /**
   * Vollständiger Reset: erst wandert der aktuelle Stand als Snapshot in die
   * Historie, danach werden die Themen-Dateien geleert und der Index neu
   * erzeugt. Ohne den Snapshot gäbe es keinen Rücksprung.
   */
  async resetAll(trigger: string) {
    return this.locked(async () => {
      await this.ensureUnlocked();
      const before = {} as Record<MemoryTopic, string>;
      for (const topic of memoryTopicNames) {
        before[topic] = await readFile(this.topicPath(topic), "utf8");
        parseMemoryTopic(topic, before[topic]);
      }
      const history = historyEntrySchema.parse({
        trigger: z.string().trim().min(1).max(500).parse(trigger),
        at: new Date().toISOString(),
        previous: before,
      });
      await appendFile(
        this.historyPath(),
        `${JSON.stringify(history)}\n`,
        "utf8",
      );
      const next = emptyMemoryTopics();
      await Promise.all(
        memoryTopicNames.map((topic) =>
          atomicWrite(this.topicPath(topic), renderMemoryTopic(topic, [])),
        ),
      );
      await atomicWrite(this.indexPath(), renderMemoryIndex(next));
      return { topics: next };
    });
  }

  async replaceAllForConsolidation(
    contents: Record<MemoryTopic, string>,
    summary: MemoryConsolidationSummary,
  ) {
    return this.locked(async () => {
      await this.ensureUnlocked();
      const before = {} as Record<MemoryTopic, string>;
      const next = emptyMemoryTopics();
      for (const topic of memoryTopicNames) {
        before[topic] = await readFile(this.topicPath(topic), "utf8");
        parseMemoryTopic(topic, before[topic]);
        next[topic] = parseMemoryTopic(topic, contents[topic]);
      }
      const history = historyEntrySchema.parse({
        trigger: "consolidation",
        at: new Date().toISOString(),
        event: "memory-consolidated",
        summary: memoryConsolidationSummarySchema.parse(summary),
        previous: before,
      });
      await appendFile(
        this.historyPath(),
        `${JSON.stringify(history)}\n`,
        "utf8",
      );
      await Promise.all(
        memoryTopicNames.map((topic) =>
          atomicWrite(this.topicPath(topic), contents[topic]),
        ),
      );
      await atomicWrite(this.indexPath(), renderMemoryIndex(next));
      return { topics: next, summary: history.summary! };
    });
  }
}
