import { z } from "zod";

export const processOperationNames = [
  "process-follow-ups",
  "process-synthesis",
  "opportunity-discovery",
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

export const processEventSchema = z.discriminatedUnion("type", [
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
]);

export type ProcessOperationName = z.infer<
  typeof processOperationStatusSchema
>["operationName"];
export type ProcessOperationStatus = z.infer<
  typeof processOperationStatusSchema
>;
export type ProcessEvent = z.infer<typeof processEventSchema>;
