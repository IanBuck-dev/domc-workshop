import { z } from "zod";
import {
  followUpQuestionSchema,
  processSynthesisAiResultSchema,
} from "../../domain/src/process-understanding.ts";

export const processFollowUpResultSchema = z
  .object({ followUps: z.array(followUpQuestionSchema).max(5) })
  .superRefine((value, ctx) => {
    const topics = value.followUps.map((followUp) => followUp.topicId);
    if (new Set(topics).size !== topics.length)
      ctx.addIssue({
        code: "custom",
        path: ["followUps"],
        message: "Only one follow-up per topic is allowed.",
      });
    const ids = value.followUps.map((followUp) => followUp.id);
    if (new Set(ids).size !== ids.length)
      ctx.addIssue({
        code: "custom",
        path: ["followUps"],
        message: "Follow-up IDs must be unique.",
      });
  });
export { processSynthesisAiResultSchema as processSynthesisResultSchema };
