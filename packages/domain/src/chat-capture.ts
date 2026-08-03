import { z } from "zod";

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
      kind: z.literal("step"),
      stepId: idSchema,
      label: z.string().trim().min(1).max(500),
    })
    .strict(),
  z
    .object({
      kind: z.literal("transition"),
      fromStepId: idSchema,
      toStepId: idSchema,
      label: z.string().trim().min(1).max(500),
    })
    .strict(),
]);

export const chatTranscriptEventSchema = z
  .object({
    schemaVersion: z.literal(1),
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
      mention.kind === "step"
        ? `step:${mention.stepId}`
        : `transition:${mention.fromStepId}:${mention.toStepId}`,
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

export const chatActionSchema = z.enum([
  "message",
  "analyze_documents",
  "skip_documents",
]);
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
      mention.kind === "step"
        ? `step:${mention.stepId}`
        : `transition:${mention.fromStepId}:${mention.toStepId}`,
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
