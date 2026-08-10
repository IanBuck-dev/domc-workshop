import { z } from "zod";

export const memoryTopicNames = [
  "glossar.md",
  "systeme.md",
  "zustaendigkeiten.md",
  "muster.md",
  "offene-fragen.md",
] as const;

export const memoryTopicSchema = z.enum(memoryTopicNames);
export type MemoryTopic = z.infer<typeof memoryTopicSchema>;

export const memoryTopicDefinitions: Record<
  MemoryTopic,
  { title: string; description: string }
> = {
  "glossar.md": {
    title: "Glossar",
    description: "Fachbegriffe, Abkürzungen und interne Namen.",
  },
  "systeme.md": {
    title: "Systeme",
    description: "Anwendungen, Schnittstellen und Systemrollen.",
  },
  "zustaendigkeiten.md": {
    title: "Zuständigkeiten",
    description: "Stabile Rollen, Freigaben und Verantwortlichkeiten.",
  },
  "muster.md": {
    title: "Muster",
    description: "Wiederkehrende Prozessmuster und Medienbrüche.",
  },
  "offene-fragen.md": {
    title: "Offene Fragen",
    description: "Firmenweite offene Punkte und Widersprüche.",
  },
};

const processIdSchema = z.string().regex(/^PROC-\d{4}$/);
const dateSchema = z.iso.date();
const directivePattern =
  /(?:ignore\s+(?:all\s+)?(?:previous|prior)\s+instructions?|system\s+prompt|developer\s+message|verhalte\s+dich\s+als|ignoriere\s+(?:alle\s+)?(?:vorherigen?|bisherigen?)\s+(?:anweisungen|instruktionen))/iu;

export function normalizeMemoryFact(value: string) {
  return value.replace(/\s+/gu, " ").trim();
}

export const memoryFactSchema = z
  .string()
  .trim()
  .min(1)
  .max(1_000)
  .superRefine((value, ctx) => {
    if (/\S+@\S+\.\S+/u.test(value))
      ctx.addIssue({
        code: "custom",
        message: "E-Mail-Adressen sind nicht erlaubt.",
      });
    if (/\d{8,}/u.test(value))
      ctx.addIssue({
        code: "custom",
        message: "Lange Ziffernfolgen sind nicht erlaubt.",
      });
    if (directivePattern.test(value))
      ctx.addIssue({
        code: "custom",
        message: "Direktive Anweisungen sind nicht erlaubt.",
      });
    if (/\(Quelle:/u.test(value))
      ctx.addIssue({
        code: "custom",
        message: "Fakttexte dürfen keinen Quellen-Tag enthalten.",
      });
  })
  .transform(normalizeMemoryFact);

export const memorySourceSchema = z
  .object({
    processIds: z.array(processIdSchema).min(1).max(1_000),
    confirmedAt: dateSchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    if (new Set(value.processIds).size !== value.processIds.length)
      ctx.addIssue({
        code: "custom",
        path: ["processIds"],
        message: "Process IDs must be unique.",
      });
  });

export const memoryEntrySchema = z
  .object({ fact: memoryFactSchema, source: memorySourceSchema })
  .strict();
export type MemoryEntry = z.infer<typeof memoryEntrySchema>;

export type MemoryTopics = Record<MemoryTopic, MemoryEntry[]>;

const addOperationSchema = z
  .object({
    action: z.literal("add"),
    topic: memoryTopicSchema,
    fact: memoryFactSchema,
  })
  .strict();
const confirmOperationSchema = z
  .object({
    action: z.literal("confirm"),
    topic: memoryTopicSchema,
    existingFact: memoryFactSchema,
  })
  .strict();
const updateOperationSchema = z
  .object({
    action: z.literal("update"),
    topic: memoryTopicSchema,
    existingFact: memoryFactSchema,
    fact: memoryFactSchema,
  })
  .strict();

export const memoryOperationSchema = z.discriminatedUnion("action", [
  addOperationSchema,
  confirmOperationSchema,
  updateOperationSchema,
]);
export const memoryOperationListSchema = z
  .object({ operations: z.array(memoryOperationSchema).max(100) })
  .strict();
export type MemoryOperation = z.infer<typeof memoryOperationSchema>;
export type MemoryOperationList = z.infer<typeof memoryOperationListSchema>;

const memoryTopicContentsSchema = z
  .object({
    "glossar.md": z.string().max(200_000),
    "systeme.md": z.string().max(200_000),
    "zustaendigkeiten.md": z.string().max(200_000),
    "muster.md": z.string().max(200_000),
    "offene-fragen.md": z.string().max(200_000),
  })
  .strict()
  .superRefine((contents, ctx) => {
    for (const topic of memoryTopicNames)
      try {
        parseMemoryTopic(topic, contents[topic]);
      } catch (error) {
        ctx.addIssue({
          code: "custom",
          path: [topic],
          message:
            error instanceof Error
              ? error.message
              : "Ungültige Gedächtnisdatei.",
        });
      }
  });

export const memoryConsolidationSummarySchema = z
  .object({
    mergedCount: z.number().int().nonnegative(),
    deletedCount: z.number().int().nonnegative(),
    movedCount: z.number().int().nonnegative(),
    deletions: z
      .array(
        z
          .object({
            fact: memoryFactSchema,
            reason: z.string().trim().min(1).max(500),
          })
          .strict(),
      )
      .max(10_000),
  })
  .strict()
  .superRefine((summary, ctx) => {
    if (summary.deletions.length !== summary.deletedCount)
      ctx.addIssue({
        code: "custom",
        path: ["deletions"],
        message: "Jede gezählte Löschung braucht genau einen Grund.",
      });
    const facts = summary.deletions.map((item) =>
      normalizeMemoryFact(item.fact),
    );
    if (new Set(facts).size !== facts.length)
      ctx.addIssue({
        code: "custom",
        path: ["deletions"],
        message: "Ein gelöschter Fakt darf nur einmal genannt werden.",
      });
  });

export const memoryConsolidationResultSchema = z
  .object({
    topicFiles: memoryTopicContentsSchema,
    summary: memoryConsolidationSummarySchema,
  })
  .strict();
export type MemoryConsolidationSummary = z.infer<
  typeof memoryConsolidationSummarySchema
>;
export type MemoryConsolidationResult = z.infer<
  typeof memoryConsolidationResultSchema
>;

/**
 * Fachliche Kennung eines Themas ohne Dateiendung. Die Oberfläche bekommt nie
 * einen Dateinamen oder Pfad zu sehen.
 */
export function memoryTopicId(topic: MemoryTopic) {
  return topic.replace(/\.md$/u, "");
}

export const memoryOverviewSchema = z
  .object({
    topics: z
      .array(
        z
          .object({
            id: z.string().trim().min(1).max(60),
            title: z.string().trim().min(1).max(120),
            description: z.string().trim().min(1).max(300),
            entryCount: z.number().int().nonnegative(),
            lastLearnedAt: dateSchema.nullable(),
            entries: z
              .array(
                z
                  .object({ fact: memoryFactSchema, learnedAt: dateSchema })
                  .strict(),
              )
              .max(10_000),
          })
          .strict(),
      )
      .length(memoryTopicNames.length),
    entryCount: z.number().int().nonnegative(),
    lastLearnedAt: dateSchema.nullable(),
    isEmpty: z.boolean(),
  })
  .strict();
export type MemoryOverview = z.infer<typeof memoryOverviewSchema>;
export type MemoryTopicOverview = MemoryOverview["topics"][number];

/** Leseansicht der fünf Themen für die Einstellungen — ohne Dateinamen. */
export function buildMemoryOverview(topics: MemoryTopics): MemoryOverview {
  const view = memoryTopicNames.map((topic) => {
    const entries = topics[topic].map((entry) => ({
      fact: entry.fact,
      learnedAt: entry.source.confirmedAt,
    }));
    const definition = memoryTopicDefinitions[topic];
    return {
      id: memoryTopicId(topic),
      title: definition.title,
      description: definition.description,
      entryCount: entries.length,
      lastLearnedAt:
        entries
          .map((entry) => entry.learnedAt)
          .sort()
          .at(-1) ?? null,
      entries,
    };
  });
  return memoryOverviewSchema.parse({
    topics: view,
    entryCount: view.reduce((total, topic) => total + topic.entryCount, 0),
    lastLearnedAt:
      view
        .map((topic) => topic.lastLearnedAt)
        .filter((value): value is string => Boolean(value))
        .sort()
        .at(-1) ?? null,
    isEmpty: isMemoryEmpty(topics),
  });
}

export function emptyMemoryTopics(): MemoryTopics {
  return memoryTopicNames.reduce((topics, topic) => {
    topics[topic] = [];
    return topics;
  }, {} as MemoryTopics);
}

export function isMemoryEmpty(topics: MemoryTopics) {
  return memoryTopicNames.every((topic) => topics[topic].length === 0);
}

export function memorySourceTag(source: MemoryEntry["source"]) {
  return `(Quelle: ${source.processIds.join(", ")}, bestätigt ${source.confirmedAt})`;
}

export function renderMemoryTopic(topic: MemoryTopic, entries: MemoryEntry[]) {
  const definition = memoryTopicDefinitions[topic];
  const lines = [`## ${definition.title}`, ""];
  for (const entry of entries)
    lines.push(`- ${entry.fact} ${memorySourceTag(entry.source)}`);
  return `${lines.join("\n")}\n`;
}

export function parseMemoryTopic(
  topic: MemoryTopic,
  content: string,
): MemoryEntry[] {
  if (content.length > 200_000)
    throw new Error(`Gedächtnisdatei ist zu groß: ${topic}`);
  const lines = content.replace(/\r\n?/gu, "\n").split("\n");
  const definition = memoryTopicDefinitions[topic];
  if (lines[0] !== `## ${definition.title}`)
    throw new Error(`Ungültiger Titel in Gedächtnisdatei: ${topic}`);
  const entries: MemoryEntry[] = [];
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const match =
      /^-\s+(.+?)\s+\(Quelle:\s+(PROC-\d{4}(?:,\s+PROC-\d{4})*),\s+bestätigt\s+(\d{4}-\d{2}-\d{2})\)$/u.exec(
        line,
      );
    if (!match)
      throw new Error(`Ungültiger Eintrag in Gedächtnisdatei: ${topic}`);
    entries.push(
      memoryEntrySchema.parse({
        fact: match[1],
        source: { processIds: match[2].split(", "), confirmedAt: match[3] },
      }),
    );
  }
  const keys = entries.map((entry) => normalizeMemoryFact(entry.fact));
  if (new Set(keys).size !== keys.length)
    throw new Error(`Doppelte Einträge in Gedächtnisdatei: ${topic}`);
  return entries;
}

export function parseMemoryTopicContents(
  contents: Record<MemoryTopic, string>,
): MemoryTopics {
  const validated = memoryTopicContentsSchema.parse(contents);
  const topics = emptyMemoryTopics();
  for (const topic of memoryTopicNames)
    topics[topic] = parseMemoryTopic(topic, validated[topic]);
  return topics;
}

/**
 * Validates a complete consolidation before any repository write. New facts may
 * be reformulated, but their sources and confirmation dates must come entirely
 * from the previous snapshot.
 */
export function validateMemoryConsolidation(
  before: MemoryTopics,
  result: unknown,
): MemoryConsolidationResult {
  const validated = memoryConsolidationResultSchema.parse(result);
  const after = parseMemoryTopicContents(validated.topicFiles);
  const previousEntries = memoryTopicNames.flatMap((topic) => before[topic]);
  const nextEntries = memoryTopicNames.flatMap((topic) => after[topic]);
  const previousFacts = new Set(
    previousEntries.map((entry) => normalizeMemoryFact(entry.fact)),
  );
  const nextFacts = new Set(
    nextEntries.map((entry) => normalizeMemoryFact(entry.fact)),
  );
  const knownSourceDates = new Map<string, Set<string>>();
  const previousSourceTags = new Set<string>();
  for (const entry of previousEntries) {
    previousSourceTags.add(
      JSON.stringify({
        processIds: [...entry.source.processIds].sort(),
        confirmedAt: entry.source.confirmedAt,
      }),
    );
    for (const processId of entry.source.processIds) {
      const dates = knownSourceDates.get(processId) ?? new Set<string>();
      dates.add(entry.source.confirmedAt);
      knownSourceDates.set(processId, dates);
    }
  }

  for (const entry of nextEntries) {
    if (
      entry.source.processIds.some(
        (processId) => !knownSourceDates.has(processId),
      )
    )
      throw new Error("Die Konsolidierung enthält eine unbekannte Quellen-ID.");
    const sourceDates = entry.source.processIds.flatMap((processId) => [
      ...(knownSourceDates.get(processId) ?? []),
    ]);
    if (!sourceDates.includes(entry.source.confirmedAt))
      throw new Error(
        "Die Konsolidierung enthält ein unbekanntes Bestätigungsdatum.",
      );
    const existingTag = previousSourceTags.has(
      JSON.stringify({
        processIds: [...entry.source.processIds].sort(),
        confirmedAt: entry.source.confirmedAt,
      }),
    );
    const newest = sourceDates.sort().at(-1);
    if (!existingTag && entry.source.confirmedAt !== newest)
      throw new Error(
        "Zusammengeführte Quellen müssen das jüngste vorhandene Bestätigungsdatum verwenden.",
      );
  }

  const totalLoss = previousEntries.length - nextEntries.length;
  if (
    totalLoss !==
    validated.summary.mergedCount + validated.summary.deletedCount
  )
    throw new Error(
      "Der Eintragsverlust entspricht nicht der Konsolidierungszusammenfassung.",
    );
  for (const deletion of validated.summary.deletions) {
    const fact = normalizeMemoryFact(deletion.fact);
    if (!previousFacts.has(fact) || nextFacts.has(fact))
      throw new Error(
        "Ein gelöschter Fakt muss im vorherigen Stand vorkommen und danach fehlen.",
      );
  }
  const nextSourceIds = new Set(
    nextEntries.flatMap((entry) => entry.source.processIds),
  );
  const deletionFacts = new Set(
    validated.summary.deletions.map((item) => normalizeMemoryFact(item.fact)),
  );
  for (const processId of knownSourceDates.keys()) {
    if (nextSourceIds.has(processId)) continue;
    const sourceFacts = previousEntries
      .filter((entry) => entry.source.processIds.includes(processId))
      .map((entry) => normalizeMemoryFact(entry.fact));
    if (sourceFacts.some((fact) => !deletionFacts.has(fact)))
      throw new Error(
        "Die Konsolidierung darf Quellen nur bei begründeten Löschungen entfernen.",
      );
  }
  return validated;
}

function matchEntry(entries: MemoryEntry[], reference: string) {
  const normalized = normalizeMemoryFact(reference);
  return entries.findIndex(
    (entry) => normalizeMemoryFact(entry.fact) === normalized,
  );
}

export function applyMemoryOperations(
  topics: MemoryTopics,
  operations: MemoryOperationList | MemoryOperation[],
  confirmation: { processId: string; confirmedAt: string },
): MemoryTopics {
  const parsed = Array.isArray(operations)
    ? z.array(memoryOperationSchema).max(100).parse(operations)
    : memoryOperationListSchema.parse(operations).operations;
  const processId = processIdSchema.parse(confirmation.processId);
  const confirmedAt = dateSchema.parse(confirmation.confirmedAt);
  const next = structuredClone(topics) as MemoryTopics;
  for (const topic of memoryTopicNames)
    next[topic] = parseMemoryTopic(
      topic,
      renderMemoryTopic(topic, next[topic]),
    );

  // Validate every reference first so a stale model response cannot partially change memory.
  for (const operation of parsed) {
    if (operation.action === "add") continue;
    if (matchEntry(next[operation.topic], operation.existingFact) < 0)
      throw new Error(
        `Unbekannter Gedächtniseintrag: ${operation.existingFact}`,
      );
  }
  for (const operation of parsed) {
    const entries = next[operation.topic];
    if (operation.action === "add") {
      if (matchEntry(entries, operation.fact) >= 0)
        throw new Error(`Doppelter Gedächtniseintrag: ${operation.fact}`);
      entries.push({
        fact: operation.fact,
        source: { processIds: [processId], confirmedAt },
      });
      continue;
    }
    const index = matchEntry(entries, operation.existingFact);
    if (index < 0)
      throw new Error(
        `Unbekannter Gedächtniseintrag: ${operation.existingFact}`,
      );
    const entry = entries[index]!;
    if (operation.action === "confirm") {
      entry.source.processIds = [
        ...new Set([...entry.source.processIds, processId]),
      ];
      entry.source.confirmedAt = confirmedAt;
    } else {
      if (
        matchEntry(entries, operation.fact) >= 0 &&
        normalizeMemoryFact(entry.fact) !== normalizeMemoryFact(operation.fact)
      )
        throw new Error(`Doppelter Gedächtniseintrag: ${operation.fact}`);
      entry.fact = operation.fact;
      entry.source.processIds = [
        ...new Set([...entry.source.processIds, processId]),
      ];
      entry.source.confirmedAt = confirmedAt;
    }
  }
  return next;
}
