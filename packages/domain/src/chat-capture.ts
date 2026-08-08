import { z } from "zod";
import { processFlowIdentifierSchema } from "./process-understanding.ts";

const idSchema = z.string().trim().min(1).max(160);
const textSchema = z.string().trim().min(1).max(20_000);

export const chatDocumentGateSchema = z.enum([
  "pending",
  "documents_selected",
  "skipped",
]);
export const chatTurnOutcomeSchema = z.enum(["completed", "failed", "aborted"]);
export const chatUnderstandingStatusSchema = z.enum([
  "missing",
  "invalid",
  "valid",
]);
export const chatActivityKindSchema = z.enum([
  "reading_documents",
  "updating_diagram",
  "checking_open_points",
]);
export const chatActivityEventSchema = z.discriminatedUnion("state", [
  z
    .object({
      schemaVersion: z.literal(1),
      state: z.literal("active"),
      kind: chatActivityKindSchema,
      timestamp: z.string().datetime(),
    })
    .strict(),
  z
    .object({
      schemaVersion: z.literal(1),
      state: z.literal("idle"),
      timestamp: z.string().datetime(),
    })
    .strict(),
]);
export const chatUnderstandingEventSchema = z
  .object({
    status: chatUnderstandingStatusSchema,
    revision: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    timestamp: z.string().datetime(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.status === "valid" && !value.revision)
      ctx.addIssue({
        code: "custom",
        path: ["revision"],
        message: "Valid understanding events require a revision.",
      });
    if (value.status !== "valid" && value.revision)
      ctx.addIssue({
        code: "custom",
        path: ["revision"],
        message: "Only valid understanding events may have a revision.",
      });
  });
export const chatCaptureStateSchema = z
  .object({
    schemaVersion: z.literal(1),
    documentGate: chatDocumentGateSchema,
    selectedUploadIds: z.array(z.string().uuid()).max(5),
    lastValidRevision: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .nullable(),
    lastValidAt: z.string().datetime().nullable(),
    lastTurnOutcome: chatTurnOutcomeSchema.nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();

export const chatMentionSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("node"),
      nodeId: processFlowIdentifierSchema,
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
      kind: z.literal("edge"),
      edgeId: processFlowIdentifierSchema,
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

export const chatTranscriptEventSchema = z
  .object({
    schemaVersion: z.literal(2),
    id: z.string().uuid(),
    turnId: z.string().uuid().nullable(),
    at: z.string().datetime(),
    role: z.enum(["user", "assistant"]),
    status: z.enum(["complete", "aborted"]),
    text: z.string().max(20_000),
    mentions: z.array(chatMentionSchema).max(5),
    action: z.enum([
      "initial",
      "message",
      "analyze_documents",
      "skip_documents",
      "confirmation",
    ]),
  })
  .strict()
  .superRefine((value, ctx) => {
    const keys = value.mentions.map((mention) =>
      mention.kind === "node"
        ? `node:${mention.nodeId}`
        : `edge:${mention.edgeId}`,
    );
    if (new Set(keys).size !== keys.length)
      ctx.addIssue({
        code: "custom",
        path: ["mentions"],
        message: "Mentions must be unique.",
      });
  });

export const chatSessionRecordSchema = z
  .object({
    schemaVersion: z.literal(1),
    activeSessionId: idSchema,
    activeSessionStarted: z.boolean(),
    replacementCandidateId: idSchema.nullable(),
    replacedSessionIds: z.array(idSchema).max(100),
    lastTurnAt: z.string().datetime().nullable(),
  })
  .strict();

/**
 * Aktionen, die einen KI-Zug auslösen. „skip_documents" gehört bewusst nicht
 * dazu: Der Verzicht auf Unterlagen ist ein fest verdrahteter Zustandswechsel
 * mit fester Rückfrage (eigene Route), kein Modellaufruf. Als Transkriptwert
 * bleibt „skip_documents" bestehen.
 */
export const chatActionSchema = z.enum(["message", "analyze_documents"]);
export const chatMessageRequestSchema = z
  .object({
    id: z.string().uuid(),
    text: textSchema,
    action: chatActionSchema,
    selectedUploadIds: z.array(z.string().uuid()).max(5).default([]),
    mentions: z.array(chatMentionSchema).max(5).default([]),
  })
  .strict()
  .superRefine((value, ctx) => {
    const keys = value.mentions.map((mention) =>
      mention.kind === "node"
        ? `node:${mention.nodeId}`
        : `edge:${mention.edgeId}`,
    );
    if (new Set(keys).size !== keys.length)
      ctx.addIssue({
        code: "custom",
        path: ["mentions"],
        message: "Mentions must be unique.",
      });
  });

export type ChatCaptureState = z.infer<typeof chatCaptureStateSchema>;
export type ChatMention = z.infer<typeof chatMentionSchema>;
export type ChatTranscriptEvent = z.infer<typeof chatTranscriptEventSchema>;
export type ChatSessionRecord = z.infer<typeof chatSessionRecordSchema>;
export type ChatUnderstandingStatus = z.infer<
  typeof chatUnderstandingStatusSchema
>;
export type ChatActivityKind = z.infer<typeof chatActivityKindSchema>;
export type ChatActivityEvent = z.infer<typeof chatActivityEventSchema>;
export type ChatUnderstandingEvent = z.infer<
  typeof chatUnderstandingEventSchema
>;
