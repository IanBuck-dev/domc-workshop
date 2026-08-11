import { z } from "zod";
import { memoryConsolidationSummarySchema } from "./memory.ts";

export const processOperationNames = [
  "process-follow-ups",
  "process-synthesis",
  "opportunity-discovery",
  "memory-distillation",
] as const;

export const processOperationStatusSchema = z
  .object({
    operationId: z.string().uuid(),
    processId: z.string().trim().min(1).max(120),
    operationName: z.enum(processOperationNames),
    state: z.enum(["queued", "running", "failed"]),
    position: z.number().int().nonnegative(),
    createdAt: z.string().datetime(),
    error: z.string().trim().min(1).max(1_000).optional(),
  })
  .strict();

export const memoryConsolidationStatusSchema = z
  .object({
    operationId: z.string().uuid().optional(),
    state: z.enum(["idle", "queued", "running", "completed", "failed"]),
    summary: memoryConsolidationSummarySchema.optional(),
    error: z.string().trim().min(1).max(1_000).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      ["queued", "running", "completed"].includes(value.state) &&
      !value.operationId
    )
      ctx.addIssue({
        code: "custom",
        path: ["operationId"],
        message: "Der Konsolidierungslauf benötigt eine Kennung.",
      });
    if (value.state === "completed" && !value.summary)
      ctx.addIssue({
        code: "custom",
        path: ["summary"],
        message: "Ein abgeschlossener Lauf benötigt eine Zusammenfassung.",
      });
    if (value.state === "failed" && !value.error)
      ctx.addIssue({
        code: "custom",
        path: ["error"],
        message: "Ein fehlgeschlagener Lauf benötigt eine Fehlermeldung.",
      });
  });

export const processEventSchema = z.union([
  z
    .object({
      type: z.literal("operations"),
      operations: z.array(processOperationStatusSchema).max(100),
    })
    .strict(),
  z
    .object({
      type: z.literal("process-changed"),
      processId: z.string().trim().min(1).max(120),
    })
    .strict(),
  z
    .object({
      type: z.literal("memory-consolidation"),
      ...memoryConsolidationStatusSchema.shape,
    })
    .strict()
    .superRefine((value, ctx) => {
      if (
        ["queued", "running", "completed"].includes(value.state) &&
        !value.operationId
      )
        ctx.addIssue({
          code: "custom",
          path: ["operationId"],
          message: "Der Konsolidierungslauf benötigt eine Kennung.",
        });
      if (value.state === "completed" && !value.summary)
        ctx.addIssue({
          code: "custom",
          path: ["summary"],
          message: "Ein abgeschlossener Lauf benötigt eine Zusammenfassung.",
        });
      if (value.state === "failed" && !value.error)
        ctx.addIssue({
          code: "custom",
          path: ["error"],
          message: "Ein fehlgeschlagener Lauf benötigt eine Fehlermeldung.",
        });
    }),
]);

export type ProcessOperationName = z.infer<
  typeof processOperationStatusSchema
>["operationName"];
export type ProcessOperationStatus = z.infer<
  typeof processOperationStatusSchema
>;
export type MemoryConsolidationStatus = z.infer<
  typeof memoryConsolidationStatusSchema
>;
export type ProcessEvent = z.infer<typeof processEventSchema>;
