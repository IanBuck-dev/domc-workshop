import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { dump, load } from "js-yaml";
import { z } from "zod";
import {
  processUnderstandingSchema,
  type ProcessUnderstanding,
} from "../../domain/src/process-understanding.ts";
import { chatTranscriptEventSchema } from "../../domain/src/chat-capture.ts";
import { atomicWrite } from "./atomic-write.ts";
import { audit } from "./audit-log.ts";

const identifierSchema = z.string().trim().min(1).max(120);
const factBase = {
  provenance: z.enum([
    "user_stated",
    "file_evidence",
    "ai_structured",
    "ai_inferred",
    "user_confirmed",
    "unknown",
  ]),
  evidenceIds: z.array(identifierSchema).max(50),
  confidence: z.number().int().min(0).max(100).nullable(),
  assumptions: z.array(z.string().trim().min(1).max(1_000)).max(20),
  confirmed: z.boolean(),
};
const stringFactSchema = z
  .object({
    value: z.string().trim().min(1).max(12_000).nullable(),
    ...factBase,
  })
  .strict();
const listFactSchema = z
  .object({
    value: z.array(z.string().trim().min(1).max(2_000)).max(100).nullable(),
    ...factBase,
  })
  .strict();
const evidenceSchema = z
  .object({
    id: identifierSchema,
    kind: z.enum([
      "main_answer",
      "follow_up_answer",
      "upload",
      "human_correction",
      "chat_message",
    ]),
    sourceId: identifierSchema,
    excerpt: z.string().trim().min(1).max(2_000),
  })
  .strict();
const informationSchema = z
  .object({
    id: identifierSchema,
    name: z.string().trim().min(1).max(1_000),
    source: z.string().trim().min(1).max(1_000).nullable(),
    type: z.enum([
      "system_field",
      "email",
      "spreadsheet",
      "document",
      "image_or_scan",
      "free_text",
      "database_or_report",
      "other",
      "unknown",
    ]),
    typeDetail: z.string().trim().min(1).max(200).nullable(),
  })
  .strict();
const decisionOptionV2Schema = z
  .object({
    id: identifierSchema,
    label: z.string().trim().min(1).max(1_000),
    determination: z.string().trim().min(1).max(2_000).nullable(),
    consequence: z.string().trim().min(1).max(2_000).nullable(),
    nextStepId: identifierSchema.nullable(),
  })
  .strict();
const decisionV2Schema = z
  .object({
    id: identifierSchema,
    question: z.string().trim().min(1).max(2_000),
    mode: z.enum(["rule_based", "professional_judgement", "mixed", "unknown"]),
    options: z.array(decisionOptionV2Schema).max(20),
  })
  .strict();
const stepV2Schema = z
  .object({
    id: identifierSchema,
    order: z.number().int().min(1).max(8),
    name: z.string().trim().min(1).max(500),
    activity: z.string().trim().min(1).max(1_000),
    inputs: z.array(z.string().trim().min(1).max(1_000)).max(30),
    outputs: z.array(z.string().trim().min(1).max(1_000)).max(30),
    informationItems: z.array(informationSchema).max(40),
    decisions: z.array(decisionV2Schema).max(20),
    miscellaneous: z.string().trim().min(1).max(4_000).nullable(),
    ...factBase,
  })
  .strict();
const understandingV2Schema = z
  .object({
    schemaVersion: z.literal(2),
    purpose: stringFactSchema,
    trigger: stringFactSchema,
    outcome: stringFactSchema,
    boundaries: stringFactSchema,
    participants: listFactSchema,
    informationSources: listFactSchema,
    systems: listFactSchema,
    decisions: listFactSchema,
    controls: listFactSchema,
    handoffs: listFactSchema,
    volumeAndTime: listFactSchema,
    painPoints: listFactSchema,
    improvementGoals: listFactSchema,
    steps: z.array(stepV2Schema).min(1).max(8),
    evidence: z.array(evidenceSchema).max(250),
    documentCoverage: z.array(z.unknown()).max(5),
    knowledgeGaps: z.array(z.string().trim().min(1).max(2_000)).max(50),
    conflicts: z.array(z.string().trim().min(1).max(2_000)).max(50),
  })
  .strict();

// Die Altdecoder sind absichtlich nur hier: Nach dem Start bleibt der Laufzeitvertrag V3-only.
const legacyStepSchema = z
  .object({
    id: identifierSchema,
    order: z.number().int().min(1).max(8),
    name: z.string().trim().min(1).max(500),
    trigger: z.string().trim().min(1).max(2_000).nullable(),
    responsibleRoles: z.array(z.string().trim().min(1).max(500)).max(20),
    activity: z.string().trim().min(1).max(4_000),
    information: z.array(z.string().trim().min(1).max(1_000)).max(30),
    output: z.string().trim().min(1).max(2_000).nullable(),
    systems: z.array(z.string().trim().min(1).max(500)).max(20),
    decision: z.string().trim().min(1).max(2_000).nullable(),
    ruleOrJudgement: z.string().trim().min(1).max(2_000).nullable(),
    handover: z.string().trim().min(1).max(2_000).nullable(),
    controls: z.array(z.string().trim().min(1).max(1_000)).max(30),
    painPoints: z.array(z.string().trim().min(1).max(1_000)).max(30),
    ...factBase,
  })
  .strict();
const legacyUnderstandingSchema = understandingV2Schema
  .omit({ schemaVersion: true, steps: true })
  .extend({ steps: z.array(legacyStepSchema).min(5).max(8) })
  .strict();

const transcriptMentionV1Schema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("step"),
      stepId: identifierSchema,
      label: z.string().trim().min(1).max(500),
      nameSnapshot: z.string().trim().min(1).max(240).nullable().default(null),
      understandingRevision: z
        .string()
        .regex(/^[a-f0-9]{64}$/)
        .nullable()
        .default(null),
    })
    .strict(),
  z
    .object({
      kind: z.literal("transition"),
      fromStepId: identifierSchema,
      toStepId: identifierSchema,
      label: z.string().trim().min(1).max(500),
      nameSnapshot: z.string().trim().min(1).max(240).nullable().default(null),
      understandingRevision: z
        .string()
        .regex(/^[a-f0-9]{64}$/)
        .nullable()
        .default(null),
    })
    .strict(),
]);
const transcriptEventV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().uuid(),
    turnId: z.string().uuid().nullable(),
    at: z.string().datetime(),
    role: z.enum(["user", "assistant"]),
    status: z.enum(["complete", "aborted"]),
    text: z.string().max(20_000),
    mentions: z.array(transcriptMentionV1Schema).max(5),
    action: z.enum([
      "initial",
      "message",
      "analyze_documents",
      "skip_documents",
      "confirmation",
    ]),
  })
  .strict();

type V2Understanding = z.infer<typeof understandingV2Schema>;
type V2ChatMention = z.infer<
  typeof chatTranscriptEventSchema
>["mentions"][number];

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}

function json(value: unknown) {
  return JSON.stringify(value, null, 2) + "\n";
}

function migrationGap(question: string) {
  return `Migration: Entscheidungsverlauf zu „${question}“ muss im Prozessbild geklärt werden.`;
}

function legacyToV2(input: unknown): V2Understanding {
  const legacy = legacyUnderstandingSchema.parse(input);
  return understandingV2Schema.parse({
    ...legacy,
    schemaVersion: 2,
    steps: legacy.steps.map((step) => ({
      id: step.id,
      order: step.order,
      name: step.name,
      activity: step.activity.slice(0, 1_000),
      inputs: step.trigger ? [step.trigger] : [],
      outputs: step.output ? [step.output] : [],
      informationItems: step.information.map((name, index) => ({
        id: `info-${step.order}-${index + 1}`,
        name,
        source: null,
        type: "unknown",
        typeDetail: null,
      })),
      decisions: step.decision
        ? [
            {
              id: `decision-${step.order}-1`,
              question: step.decision,
              mode: "unknown",
              options: [],
            },
          ]
        : [],
      miscellaneous:
        [
          step.responsibleRoles.length &&
            `Verantwortlich: ${step.responsibleRoles.join(", ")}`,
          step.systems.length && `Systeme: ${step.systems.join(", ")}`,
          step.ruleOrJudgement &&
            `Regel oder fachliche Einschätzung: ${step.ruleOrJudgement}`,
          step.handover && `Übergabe: ${step.handover}`,
          step.controls.length && `Kontrollen: ${step.controls.join(", ")}`,
          step.painPoints.length && `Probleme: ${step.painPoints.join(", ")}`,
        ]
          .filter(Boolean)
          .join("\n") || null,
      provenance: step.provenance,
      evidenceIds: step.evidenceIds,
      confidence: step.confidence,
      assumptions: step.assumptions,
      confirmed: step.confirmed,
    })),
  });
}

function createFlow(value: V2Understanding, selected: Set<string>) {
  const stepNodeIds = new Map(
    value.steps.map((step, index) => [step.id, `step-${index + 1}`]),
  );
  const nodes: Array<Record<string, unknown>> = [
    { id: "start", kind: "startEvent" },
    ...value.steps.map((step, index) => ({
      id: `step-${index + 1}`,
      kind: "step",
      stepId: step.id,
    })),
  ];
  let gateway = 0;
  const gatewayByDecision = new Map<string, string>();
  for (const step of value.steps)
    if (step.decisions[0] && selected.has(step.decisions[0].id)) {
      const id = `xor-${++gateway}`;
      gatewayByDecision.set(step.decisions[0].id, id);
      nodes.push({
        id,
        kind: "gateway",
        question: step.decisions[0].question,
        mode: step.decisions[0].mode,
      });
    }
  nodes.push({ id: "end", kind: "endEvent" });
  const edges: Array<Record<string, unknown>> = [];
  const edge = (
    source: string,
    target: string,
    detail: Record<string, unknown> = {},
  ) =>
    edges.push({ id: `edge-${edges.length + 1}`, source, target, ...detail });
  edge("start", "step-1");
  value.steps.forEach((step, index) => {
    const source = `step-${index + 1}`;
    const decision = step.decisions[0];
    const gatewayId =
      decision && selected.has(decision.id)
        ? gatewayByDecision.get(decision.id)
        : null;
    if (!decision || !gatewayId) {
      edge(
        source,
        index + 1 === value.steps.length ? "end" : `step-${index + 2}`,
      );
      return;
    }
    edge(source, gatewayId);
    for (const option of decision.options) {
      const target =
        option.nextStepId === null ? "end" : stepNodeIds.get(option.nextStepId);
      if (!target)
        throw new Error(`Unbekanntes Alt-Ziel: ${option.nextStepId}`);
      edge(gatewayId, target, {
        label: option.label,
        ...(option.determination
          ? { determination: option.determination }
          : {}),
        ...(option.consequence ? { consequence: option.consequence } : {}),
      });
    }
  });
  return { nodes, edges };
}

function eligibleDecisionIds(value: V2Understanding) {
  const stepIds = new Set(value.steps.map((step) => step.id));
  return new Set(
    value.steps.flatMap((step) => {
      const decision = step.decisions[0];
      return step.decisions.length === 1 &&
        decision &&
        decision.options.length >= 2 &&
        decision.options.every(
          (option) =>
            option.nextStepId === null || stepIds.has(option.nextStepId),
        )
        ? [decision.id]
        : [];
    }),
  );
}

export function migrateProcessUnderstanding(
  input: unknown,
): ProcessUnderstanding {
  const v3 = processUnderstandingSchema.safeParse(input);
  if (v3.success) return v3.data;
  const v2 = understandingV2Schema.safeParse(input);
  const value = v2.success ? v2.data : legacyToV2(input);
  let selected = eligibleDecisionIds(value);
  let flow = createFlow(value, selected);
  const omittedQuestions = () =>
    value.steps.flatMap((step) =>
      step.decisions
        .filter((decision) => !selected.has(decision.id))
        .map((decision) => decision.question),
    );
  const { decisions: globalDecisions, ...v2WithoutGlobalDecisions } = value;
  const base = {
    ...v2WithoutGlobalDecisions,
    schemaVersion: 3,
    steps: value.steps.map(({ decisions, ...step }) => {
      void decisions;
      return step;
    }),
    knowledgeGaps: [...value.knowledgeGaps],
  };
  const parse = () =>
    processUnderstandingSchema.parse({
      ...base,
      knowledgeGaps: [
        ...new Set([
          ...base.knowledgeGaps,
          ...omittedQuestions().map(migrationGap),
          ...(globalDecisions.value ?? []).map(migrationGap),
        ]),
      ],
      flow,
    });
  try {
    return parse();
  } catch {
    // Bei einer global unvereinbaren Zieltopologie bleibt nur die belegte lineare Reihenfolge erhalten.
    selected = new Set();
    flow = createFlow(value, selected);
    return parse();
  }
}

async function migrateUnderstandingFile(path: string, auditPath: string) {
  const content = await readFile(path, "utf8").catch((error) => {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  });
  if (content === null) return null;
  const input = JSON.parse(content) as unknown;
  if (input === null) return null;
  const prior = processUnderstandingSchema.safeParse(input);
  const understanding = prior.success
    ? prior.data
    : migrateProcessUnderstanding(input);
  if (!prior.success) {
    const next = json(understanding);
    await atomicWrite(path, next);
    await audit(auditPath, "process-flow-migrated", {
      file: path,
      previousRevision: hash(content),
      nextRevision: hash(next),
    });
  }
  return understanding;
}

async function migrateTranscript(
  path: string,
  auditPath: string,
  understanding: ProcessUnderstanding | null,
) {
  const content = await readFile(path, "utf8").catch((error) => {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  });
  if (content === null || !content.trim()) return;
  const lines = content.trimEnd().split("\n");
  if (
    lines.every(
      (line) => chatTranscriptEventSchema.safeParse(JSON.parse(line)).success,
    )
  )
    return;
  const nodes = new Map(
    understanding?.flow.nodes
      .filter((node) => node.kind === "step")
      .map((node) => [node.stepId, node.id]) ?? [],
  );
  const edges = new Map(
    understanding?.flow.edges.map((edge) => [
      `${edge.source}:${edge.target}`,
      edge.id,
    ]) ?? [],
  );
  let unresolvedMentions = 0;
  const events = lines.map((line) => {
    const event = transcriptEventV1Schema.parse(JSON.parse(line));
    const mentions: V2ChatMention[] = [];
    for (const mention of event.mentions) {
      if (mention.kind === "step") {
        const nodeId = nodes.get(mention.stepId);
        if (!nodeId) continue;
        mentions.push({
          kind: "node",
          nodeId,
          label: mention.label,
          nameSnapshot: mention.nameSnapshot,
          understandingRevision: mention.understandingRevision,
        });
        continue;
      }
      const edgeId = edges.get(
        `${nodes.get(mention.fromStepId)}:${nodes.get(mention.toStepId)}`,
      );
      if (!edgeId) {
        unresolvedMentions += 1;
        continue;
      }
      mentions.push({
        kind: "edge",
        edgeId,
        label: mention.label,
        nameSnapshot: mention.nameSnapshot,
        understandingRevision: mention.understandingRevision,
      });
    }
    return chatTranscriptEventSchema.parse({
      ...event,
      schemaVersion: 2,
      mentions,
    });
  });
  const next = `${events.map((event) => JSON.stringify(event)).join("\n")}\n`;
  await atomicWrite(path, next);
  await audit(auditPath, "chat-transcript-flow-migrated", {
    file: path,
    previousRevision: hash(content),
    nextRevision: hash(next),
    unresolvedMentions,
  });
}

async function migrateChatState(
  path: string,
  auditPath: string,
  lastValid: ProcessUnderstanding | null,
) {
  if (!lastValid) return;
  const content = await readFile(path, "utf8").catch((error) => {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  });
  if (content === null) return;
  const state = z
    .object({
      schemaVersion: z.literal(1),
      lastValidRevision: z
        .string()
        .regex(/^[a-f0-9]{64}$/)
        .nullable(),
    })
    .passthrough()
    .parse(JSON.parse(content));
  const revision = hash(JSON.stringify(lastValid));
  if (state.lastValidRevision === revision) return;
  const next = json({ ...state, lastValidRevision: revision });
  await atomicWrite(path, next);
  await audit(auditPath, "chat-state-flow-migrated", {
    file: path,
    previousRevision: hash(content),
    nextRevision: hash(next),
  });
}

async function migrateOpportunitySnapshot(path: string, auditPath: string) {
  const content = await readFile(path, "utf8").catch((error) => {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  });
  if (!content) return;
  const snapshot = z
    .object({ understanding: z.unknown() })
    .passthrough()
    .parse(JSON.parse(content));
  const currentUnderstanding = processUnderstandingSchema.safeParse(
    snapshot.understanding,
  );
  const nextSnapshot = currentUnderstanding.success
    ? snapshot
    : {
        ...snapshot,
        understanding: migrateProcessUnderstanding(snapshot.understanding),
      };
  const migratedUnderstanding = !currentUnderstanding.success;
  const next = json(nextSnapshot);
  const metadataPath = join(resolve(path, ".."), "metadata.yaml");
  const metadataText = await readFile(metadataPath, "utf8");
  const metadata = z
    .object({ sourceProcessHash: z.string().regex(/^[a-f0-9]{64}$/) })
    .passthrough()
    .parse(load(metadataText));
  const sourceProcessHash = hash(canonical(nextSnapshot));
  const migratedMetadata = metadata.sourceProcessHash !== sourceProcessHash;
  const nextMetadata = migratedMetadata
    ? dump({ ...metadata, sourceProcessHash }, { lineWidth: 140, noRefs: true })
    : metadataText;
  if (migratedUnderstanding) await atomicWrite(path, next);
  if (migratedMetadata) await atomicWrite(metadataPath, nextMetadata);
  if (!migratedUnderstanding && !migratedMetadata) return;
  await audit(auditPath, "opportunity-snapshot-flow-migrated", {
    file: path,
    previousRevision: hash(content),
    nextRevision: hash(next),
    previousMetadataRevision: hash(metadataText),
    nextMetadataRevision: hash(nextMetadata),
  });
}

async function migrateChatContracts(processDir: string, auditPath: string) {
  const chatDir = join(processDir, "chat");
  const promptPath = join(chatDir, "contracts", "process-chat.md");
  const schemaPath = join(
    chatDir,
    "contracts",
    "process-understanding.schema.json",
  );
  const manifestPath = join(chatDir, "contract-manifest.json");
  const prompt = await readFile(promptPath, "utf8").catch(() => null);
  const schema = await readFile(schemaPath, "utf8").catch(() => null);
  const manifest = await readFile(manifestPath, "utf8").catch(() => null);
  if (prompt === null || schema === null) return;
  const defaults =
    process.env.CLAIMS_AI_DEFAULTS_DIR ?? resolve(process.cwd(), "defaults");
  const [nextPrompt, nextSchema] = await Promise.all([
    readFile(join(defaults, "prompts", "process-chat.md"), "utf8"),
    readFile(
      join(defaults, "ai-schemas", "process-understanding.json"),
      "utf8",
    ),
  ]);
  const schemaVersion = z
    .object({
      properties: z.object({
        schemaVersion: z.object({ const: z.literal(3) }),
      }),
    })
    .safeParse(JSON.parse(nextSchema));
  if (!schemaVersion.success)
    throw new Error(
      "Die V3-Chat-Verträge fehlen; die Storage-Migration wurde nicht gestartet.",
    );
  let manifestValue: unknown = null;
  try {
    manifestValue = JSON.parse(manifest ?? "null");
  } catch {
    // Ein kaputtes Manifest wird zusammen mit den eingefrorenen Verträgen ersetzt.
  }
  const nextManifestValue = {
    prompt: hash(nextPrompt),
    schema: hash(nextSchema),
  };
  const manifestMatches =
    z
      .object({ prompt: z.string(), schema: z.string() })
      .safeParse(manifestValue).success &&
    JSON.stringify(manifestValue) === JSON.stringify(nextManifestValue);
  if (prompt === nextPrompt && schema === nextSchema && manifestMatches) return;
  const nextManifest = json(nextManifestValue);
  await Promise.all([
    atomicWrite(promptPath, nextPrompt),
    atomicWrite(schemaPath, nextSchema),
    atomicWrite(manifestPath, nextManifest),
  ]);
  await audit(auditPath, "chat-contract-flow-migrated", {
    previousRevision: hash(`${prompt}\n${schema}\n${manifest ?? ""}`),
    nextRevision: hash(`${nextPrompt}\n${nextSchema}\n${nextManifest}`),
  });
}

/** Migriert vor dem ersten Repository-Zug alle persistierten Prozessstände atomar auf V3. */
export async function migrateProcessFlowStorage(root: string) {
  const processRoot = join(root, "process-captures");
  const entries = await readdir(processRoot, { withFileTypes: true }).catch(
    () => [],
  );
  let migrated = 0;
  for (const entry of entries) {
    if (!entry.isDirectory() || !/^PROC-\d{4}$/.test(entry.name)) continue;
    const processDir = join(processRoot, entry.name);
    const history = join(processDir, "history.jsonl");
    const main = await migrateUnderstandingFile(
      join(processDir, "process-understanding.json"),
      history,
    );
    const lastValid = await migrateUnderstandingFile(
      join(processDir, "chat", "last-valid-process-understanding.json"),
      history,
    );
    await migrateChatState(
      join(processDir, "chat", "state.json"),
      history,
      lastValid,
    );
    await migrateTranscript(
      join(processDir, "chat", "transcript.jsonl"),
      history,
      main ?? lastValid,
    );
    await migrateChatContracts(processDir, history);
    await migrateOpportunitySnapshot(
      join(processDir, "opportunity-discovery", "source-process.json"),
      join(processDir, "opportunity-discovery", "history.jsonl"),
    );
    if (main || lastValid) migrated += 1;
  }
  return { migrated };
}
