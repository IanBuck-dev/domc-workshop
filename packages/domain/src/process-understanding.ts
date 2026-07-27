import { z } from "zod";

export const topicIds = [
  "purpose-scope",
  "flow-roles",
  "information-systems",
  "decisions-controls-handoffs",
  "effort-pain-goals",
] as const;
export const topicIdSchema = z.enum(topicIds);
export const workCharacteristicIds = [
  "combined-information-sources",
  "content-types",
  "case-specific-recognition",
  "uncertain-decisions",
] as const;
export const workCharacteristicIdSchema = z.enum(workCharacteristicIds);

export const workCharacteristicContracts = {
  "combined-information-sources": {
    topicId: "information-systems",
    selection: "single",
    options: [
      { id: "yes", label: "Ja" },
      { id: "no", label: "Nein" },
      { id: "unsure", label: "Nicht sicher" },
    ],
  },
  "content-types": {
    topicId: "information-systems",
    selection: "multiple",
    options: [
      {
        id: "free-text",
        label: "Freitexte, beispielsweise E-Mails, Briefe oder Notizen",
      },
      {
        id: "audio-speech",
        label: "Gesprochene Sprache oder Audioaufnahmen",
      },
      { id: "images-scans", label: "Bilder oder eingescannte Unterlagen" },
      { id: "video", label: "Videos" },
      {
        id: "other-freeform-files",
        label: "Andere frei aufgebaute Dokumente oder Dateien",
      },
      {
        id: "none",
        label:
          "Keine davon – ausschließlich feste Felder, Listen oder Tabellen",
      },
      { id: "unsure", label: "Nicht sicher" },
    ],
  },
  "case-specific-recognition": {
    topicId: "flow-roles",
    selection: "multiple",
    options: [
      {
        id: "detect-unusual-cases",
        label: "Ungewöhnliche Fälle oder Auffälligkeiten erkennen",
      },
      {
        id: "detect-recurring-connections",
        label: "Wiederkehrende Zusammenhänge erkennen",
      },
      {
        id: "adapt-case-flow",
        label: "Den Ablauf abhängig vom Einzelfall anpassen",
      },
      { id: "none", label: "Nichts davon" },
      { id: "unsure", label: "Nicht sicher" },
    ],
  },
  "uncertain-decisions": {
    topicId: "decisions-controls-handoffs",
    selection: "multiple",
    options: [
      {
        id: "estimate-future",
        label: "Zukünftige Entwicklungen, Ergebnisse oder Risiken einschätzen",
      },
      {
        id: "decide-with-incomplete-rules",
        label:
          "Bei unklarer Sachlage eine passende Entscheidung oder Lösung finden, obwohl Regeln nicht jeden Fall abdecken",
      },
      { id: "none", label: "Nichts davon" },
      { id: "unsure", label: "Nicht sicher" },
    ],
  },
} as const satisfies Record<
  (typeof workCharacteristicIds)[number],
  {
    topicId: (typeof topicIds)[number];
    selection: "single" | "multiple";
    options: readonly { id: string; label: string }[];
  }
>;
export const processStateSchema = z.enum([
  "capture_in_progress",
  "follow_up_required",
  "synthesis_ready",
  "review_required",
  "confirmed",
]);
export const provenanceSchema = z.enum([
  "user_stated",
  "file_evidence",
  "ai_structured",
  "ai_inferred",
  "user_confirmed",
  "unknown",
]);
const identifierSchema = z.string().trim().min(1).max(120);
const textSchema = z.string().trim().min(1).max(20_000);

export const topicDefinitionSchema = z.object({
  id: topicIdSchema,
  name: z.string().trim().min(1).max(160),
  question: z.string().trim().min(1).max(2_000),
  helpText: z.string().trim().min(1).max(3_000),
  displayOrder: z.number().int().min(1).max(5),
});

export const workCharacteristicDefinitionSchema = z.object({
  id: workCharacteristicIdSchema,
  topicId: topicIdSchema,
  question: z.string().trim().min(1).max(2_000),
  helpText: z.string().trim().min(1).max(3_000),
  selection: z.enum(["single", "multiple"]),
  options: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(120),
        label: z.string().trim().min(1).max(500),
      }),
    )
    .min(2)
    .max(12),
});

export const processInstructionsSchema = z.object({
  followUps: z.string().trim().min(1).max(30_000),
  synthesis: z.string().trim().min(1).max(30_000),
});

const processCaptureConfigBase = {
  schemaVersion: z.literal(1),
  departments: z.array(z.string().trim().min(1).max(120)).min(1).max(100),
  topics: z.array(topicDefinitionSchema).length(5),
  instructions: processInstructionsSchema,
  uploads: z.object({
    allowedExtensions: z.tuple([
      z.literal(".pdf"),
      z.literal(".xlsx"),
      z.literal(".csv"),
      z.literal(".docx"),
      z.literal(".txt"),
      z.literal(".md"),
      z.literal(".png"),
      z.literal(".jpg"),
      z.literal(".jpeg"),
    ]),
    maxFiles: z.literal(5),
    maxFileBytes: z.literal(20 * 1024 * 1024),
    maxProcessBytes: z.literal(100 * 1024 * 1024),
  }),
  ai: z.object({
    model: z.enum(["sonnet", "claude-opus-4-8"]),
    reasoningEffort: z.literal("medium"),
    timeoutMs: z.number().int().min(10_000).max(300_000),
    maxOutputTokens: z.number().int().min(512).max(32_768),
    maxInputCharacters: z.number().int().min(10_000).max(2_000_000),
    maxBudgetUsd: z.number().positive().max(10),
  }),
};

const processCaptureConfigV1Schema = z.object({
  ...processCaptureConfigBase,
  profile: z.object({ id: z.literal("compact-v1"), version: z.literal(1) }),
});
const processCaptureConfigV2Schema = z.object({
  ...processCaptureConfigBase,
  profile: z.object({ id: z.literal("compact-v1"), version: z.literal(2) }),
  workCharacteristics: z.array(workCharacteristicDefinitionSchema).length(4),
});

export const processCaptureConfigSchema = z
  .union([processCaptureConfigV1Schema, processCaptureConfigV2Schema])
  .superRefine((config, ctx) => {
    const ids = config.topics.map((topic) => topic.id);
    const orders = config.topics.map((topic) => topic.displayOrder);
    if (
      new Set(ids).size !== topicIds.length ||
      topicIds.some((id) => !ids.includes(id))
    )
      ctx.addIssue({
        code: "custom",
        path: ["topics"],
        message: "Exactly the compact-v1 topic IDs are required.",
      });
    if (
      new Set(orders).size !== 5 ||
      ![1, 2, 3, 4, 5].every((order) => orders.includes(order))
    )
      ctx.addIssue({
        code: "custom",
        path: ["topics"],
        message: "Topic display order must be 1 through 5.",
      });
    if ("workCharacteristics" in config) {
      const definitions = new Map(
        config.workCharacteristics.map((item) => [item.id, item]),
      );
      for (const id of workCharacteristicIds) {
        const definition = definitions.get(id);
        const contract = workCharacteristicContracts[id];
        if (!definition) {
          ctx.addIssue({
            code: "custom",
            path: ["workCharacteristics"],
            message: `Missing work characteristic: ${id}`,
          });
          continue;
        }
        if (
          definition.topicId !== contract.topicId ||
          definition.selection !== contract.selection ||
          JSON.stringify(definition.options) !==
            JSON.stringify(contract.options)
        )
          ctx.addIssue({
            code: "custom",
            path: ["workCharacteristics", id],
            message: `The semantic contract for ${id} is immutable.`,
          });
      }
    }
  });

export const coverSchema = z.object({
  department: z.string().trim().min(1).max(120),
  participantName: z.string().trim().min(1).max(200),
  participantEmail: z.string().trim().email().max(320),
  processName: z.string().trim().min(1).max(240),
});
export const topicAnswerSchema = z.object({
  topicId: topicIdSchema,
  text: textSchema,
  answeredAt: z.string().datetime(),
});
export const workCharacteristicAnswerSchema = z.object({
  characteristicId: workCharacteristicIdSchema,
  selectedOptionIds: z
    .array(z.string().trim().min(1).max(120))
    .min(1)
    .max(12)
    .superRefine((ids, ctx) => {
      if (new Set(ids).size !== ids.length)
        ctx.addIssue({ code: "custom", message: "Options must be unique." });
    }),
  answeredAt: z.string().datetime(),
});
export const followUpQuestionSchema = z.object({
  id: identifierSchema,
  topicId: topicIdSchema,
  question: z.string().trim().min(1).max(2_000),
  rationale: z.string().trim().min(1).max(2_000),
});
export const followUpAnswerSchema = z.object({
  questionId: identifierSchema,
  topicId: topicIdSchema,
  text: textSchema,
  answeredAt: z.string().datetime(),
});
export const evidenceReferenceSchema = z.object({
  id: identifierSchema,
  kind: z.enum([
    "main_answer",
    "follow_up_answer",
    "upload",
    "human_correction",
  ]),
  sourceId: identifierSchema,
  excerpt: z.string().trim().min(1).max(2_000),
});

const factBase = {
  provenance: provenanceSchema,
  evidenceIds: z.array(identifierSchema).max(50),
  confidence: z.number().int().min(0).max(100).nullable(),
  assumptions: z.array(z.string().trim().min(1).max(1_000)).max(20),
  confirmed: z.boolean(),
};
export const stringFactSchema = z.object({
  value: z.string().trim().min(1).max(12_000).nullable(),
  ...factBase,
});
export const stringListFactSchema = z.object({
  value: z.array(z.string().trim().min(1).max(2_000)).max(100).nullable(),
  ...factBase,
});

export const processStepSchema = z.object({
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
});
export const documentCoverageSchema = z.object({
  uploadId: z.string().uuid(),
  name: z.string().trim().min(1).max(240),
  status: z.enum(["complete", "partial", "failed"]),
  processedCharacters: z.number().int().nonnegative().nullable(),
  limitation: z.string().trim().min(1).max(2_000).nullable(),
});
export const processUnderstandingSchema = z
  .object({
    purpose: stringFactSchema,
    trigger: stringFactSchema,
    outcome: stringFactSchema,
    boundaries: stringFactSchema,
    participants: stringListFactSchema,
    informationSources: stringListFactSchema,
    systems: stringListFactSchema,
    decisions: stringListFactSchema,
    controls: stringListFactSchema,
    handoffs: stringListFactSchema,
    volumeAndTime: stringListFactSchema,
    painPoints: stringListFactSchema,
    improvementGoals: stringListFactSchema,
    steps: z.array(processStepSchema).min(5).max(8),
    evidence: z.array(evidenceReferenceSchema).max(250),
    documentCoverage: z.array(documentCoverageSchema).max(5),
    knowledgeGaps: z.array(z.string().trim().min(1).max(2_000)).max(50),
    conflicts: z.array(z.string().trim().min(1).max(2_000)).max(50),
  })
  .superRefine((value, ctx) => {
    const stepIds = value.steps.map((step) => step.id);
    const orders = value.steps.map((step) => step.order);
    if (new Set(stepIds).size !== stepIds.length)
      ctx.addIssue({
        code: "custom",
        path: ["steps"],
        message: "Step IDs must be unique.",
      });
    if (!orders.every((order, index) => order === index + 1))
      ctx.addIssue({
        code: "custom",
        path: ["steps"],
        message: "Steps must be ordered contiguously.",
      });
    const listedEvidenceIds = value.evidence.map((evidence) => evidence.id);
    const evidenceIds = new Set(listedEvidenceIds);
    if (evidenceIds.size !== listedEvidenceIds.length)
      ctx.addIssue({
        code: "custom",
        path: ["evidence"],
        message: "Evidence IDs must be unique.",
      });
    const coverageIds = value.documentCoverage.map((item) => item.uploadId);
    if (new Set(coverageIds).size !== coverageIds.length)
      ctx.addIssue({
        code: "custom",
        path: ["documentCoverage"],
        message: "Document coverage upload IDs must be unique.",
      });
    const facts = [
      value.purpose,
      value.trigger,
      value.outcome,
      value.boundaries,
      value.participants,
      value.informationSources,
      value.systems,
      value.decisions,
      value.controls,
      value.handoffs,
      value.volumeAndTime,
      value.painPoints,
      value.improvementGoals,
      ...value.steps,
    ];
    facts.forEach((fact, factIndex) =>
      fact.evidenceIds.forEach((id) => {
        if (!evidenceIds.has(id))
          ctx.addIssue({
            code: "custom",
            path: ["evidence", factIndex],
            message: `Unknown evidence ID: ${id}`,
          });
      }),
    );
  });

export const uploadRecordSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(240),
  mediaType: z.string().trim().min(1).max(200),
  size: z.number().int().positive(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  uploadedAt: z.string().datetime(),
});
export const aiTraceSchema = z.object({
  operationId: z.string().uuid(),
  sessionId: z.string().min(1).nullable(),
  model: z.string().min(1),
  durationMs: z.number().int().nonnegative(),
  inputTokens: z.number().int().nonnegative().nullable(),
  outputTokens: z.number().int().nonnegative().nullable(),
  sandboxed: z.boolean().optional(),
});

export const processCaptureRecordSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().regex(/^PROC-\d{4}$/),
    state: processStateSchema,
    profile: z.object({
      id: z.literal("compact-v1"),
      version: z.union([z.literal(1), z.literal(2)]),
    }),
    configHash: z.string().regex(/^[a-f0-9]{64}$/),
    cover: coverSchema,
    configSnapshot: processCaptureConfigSchema,
    mainAnswers: z.array(topicAnswerSchema).max(5),
    workCharacteristicAnswers: z.array(workCharacteristicAnswerSchema).max(4),
    followUps: z.array(followUpQuestionSchema).max(5),
    followUpAnswers: z.array(followUpAnswerSchema).max(5),
    selectedUploadIds: z.array(z.string().uuid()).max(5),
    understanding: processUnderstandingSchema.nullable(),
    uploads: z.array(uploadRecordSchema).max(5),
    confirmedAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .superRefine((record, ctx) => {
    if (record.profile.version !== record.configSnapshot.profile.version)
      ctx.addIssue({
        code: "custom",
        path: ["profile"],
        message: "Record and configuration profile versions must match.",
      });
    const mainIds = record.mainAnswers.map((answer) => answer.topicId);
    if (new Set(mainIds).size !== mainIds.length)
      ctx.addIssue({
        code: "custom",
        path: ["mainAnswers"],
        message: "Topic answers must be unique.",
      });
    const followTopicIds = record.followUps.map((question) => question.topicId);
    if (new Set(followTopicIds).size !== followTopicIds.length)
      ctx.addIssue({
        code: "custom",
        path: ["followUps"],
        message: "Only one follow-up per topic is allowed.",
      });
    const followUpIds = record.followUps.map((question) => question.id);
    if (new Set(followUpIds).size !== followUpIds.length)
      ctx.addIssue({
        code: "custom",
        path: ["followUps"],
        message: "Follow-up IDs must be unique.",
      });
    const expected = new Map(
      record.followUps.map((question) => [question.id, question.topicId]),
    );
    if (
      record.followUpAnswers.some(
        (answer) => expected.get(answer.questionId) !== answer.topicId,
      )
    )
      ctx.addIssue({
        code: "custom",
        path: ["followUpAnswers"],
        message: "Follow-up answers must match generated questions.",
      });
    if (
      new Set(record.selectedUploadIds).size !==
        record.selectedUploadIds.length ||
      record.selectedUploadIds.some(
        (id) => !record.uploads.some((upload) => upload.id === id),
      )
    )
      ctx.addIssue({
        code: "custom",
        path: ["selectedUploadIds"],
        message: "Selected uploads must be unique and belong to the process.",
      });
    const hasAllMainAnswers =
      record.mainAnswers.length === topicIds.length &&
      topicIds.every((id) => mainIds.includes(id));
    const workCharacteristicsValid =
      record.profile.version === 1
        ? record.workCharacteristicAnswers.length === 0
        : workCharacteristicAnswersSchema.safeParse(
            record.workCharacteristicAnswers,
          ).success;
    if (record.state !== "capture_in_progress" && !workCharacteristicsValid)
      ctx.addIssue({
        code: "custom",
        path: ["workCharacteristicAnswers"],
        message: "This process state requires all four work characteristics.",
      });
    const hasAllFollowUpAnswers =
      record.followUpAnswers.length === record.followUps.length;
    if (record.state !== "capture_in_progress" && !hasAllMainAnswers)
      ctx.addIssue({
        code: "custom",
        path: ["state"],
        message: "This process state requires all five main answers.",
      });
    if (
      record.state === "follow_up_required" &&
      (record.followUps.length === 0 || record.followUpAnswers.length !== 0)
    )
      ctx.addIssue({
        code: "custom",
        path: ["state"],
        message: "Follow-up-required state requires unanswered questions.",
      });
    if (
      ["synthesis_ready", "review_required", "confirmed"].includes(
        record.state,
      ) &&
      !hasAllFollowUpAnswers
    )
      ctx.addIssue({
        code: "custom",
        path: ["state"],
        message: "This process state requires all follow-ups to be answered.",
      });
    if (
      ["capture_in_progress", "follow_up_required", "synthesis_ready"].includes(
        record.state,
      ) &&
      record.understanding !== null
    )
      ctx.addIssue({
        code: "custom",
        path: ["understanding"],
        message: "This process state cannot contain a synthesized result.",
      });
    if (
      ["review_required", "confirmed"].includes(record.state) &&
      record.understanding === null
    )
      ctx.addIssue({
        code: "custom",
        path: ["understanding"],
        message: "This process state requires a synthesized result.",
      });
    if ((record.state === "confirmed") !== (record.confirmedAt !== null))
      ctx.addIssue({
        code: "custom",
        path: ["confirmedAt"],
        message: "Confirmation timestamp and process state must agree.",
      });
  });

export const understandingSectionSchema = z.enum([
  "overview",
  "participants",
  "flow",
  "decisions",
  "problems",
  "open-points",
]);

export type TopicId = z.infer<typeof topicIdSchema>;
export type WorkCharacteristicId = z.infer<typeof workCharacteristicIdSchema>;
export type ProcessCaptureConfig = z.infer<typeof processCaptureConfigSchema>;
export type WorkCharacteristicDefinition = z.infer<
  typeof workCharacteristicDefinitionSchema
>;
export type Cover = z.infer<typeof coverSchema>;
export type TopicAnswer = z.infer<typeof topicAnswerSchema>;
export type WorkCharacteristicAnswer = z.infer<
  typeof workCharacteristicAnswerSchema
>;
export type FollowUpQuestion = z.infer<typeof followUpQuestionSchema>;
export type FollowUpAnswer = z.infer<typeof followUpAnswerSchema>;
export type ProcessUnderstanding = z.infer<typeof processUnderstandingSchema>;
export type ProcessCaptureRecord = z.infer<typeof processCaptureRecordSchema>;
export type UploadRecord = z.infer<typeof uploadRecordSchema>;
export type AiTrace = z.infer<typeof aiTraceSchema>;
export type UnderstandingSection = z.infer<typeof understandingSectionSchema>;

export function assertExactlyFiveAnswers(answers: TopicAnswer[]) {
  const parsed = z.array(topicAnswerSchema).length(5).parse(answers);
  if (topicIds.some((id) => !parsed.some((answer) => answer.topicId === id)))
    throw new Error("Bitte beantworten Sie alle fünf Themenbereiche.");
  return parsed;
}

export const workCharacteristicAnswersSchema = z
  .array(workCharacteristicAnswerSchema)
  .length(4)
  .superRefine((answers, ctx) => {
    const ids = answers.map((answer) => answer.characteristicId);
    if (
      new Set(ids).size !== workCharacteristicIds.length ||
      workCharacteristicIds.some((id) => !ids.includes(id))
    )
      ctx.addIssue({
        code: "custom",
        message: "Bitte beantworten Sie alle vier Arbeitsmerkmale.",
      });
    answers.forEach((answer, index) => {
      const contract = workCharacteristicContracts[answer.characteristicId];
      const allowed = new Set<string>(
        contract.options.map((option) => option.id),
      );
      const selected = answer.selectedOptionIds;
      if (selected.some((id) => !allowed.has(id)))
        ctx.addIssue({
          code: "custom",
          path: [index, "selectedOptionIds"],
          message: "Die Auswahl enthält einen unbekannten Wert.",
        });
      if (contract.selection === "single" && selected.length !== 1)
        ctx.addIssue({
          code: "custom",
          path: [index, "selectedOptionIds"],
          message: "Bitte wählen Sie genau eine Antwort.",
        });
      if (
        selected.length > 1 &&
        (selected.includes("none") || selected.includes("unsure"))
      )
        ctx.addIssue({
          code: "custom",
          path: [index, "selectedOptionIds"],
          message: "Diese Antwort kann nur einzeln gewählt werden.",
        });
    });
  });

export function assertWorkCharacteristicAnswers(
  config: ProcessCaptureConfig,
  input: unknown,
) {
  if (config.profile.version === 1) {
    const parsed = z.array(workCharacteristicAnswerSchema).max(0).parse(input);
    return parsed;
  }
  return workCharacteristicAnswersSchema.parse(input);
}

export function assertUnderstandingReferences(
  record: ProcessCaptureRecord,
  understanding: ProcessUnderstanding,
  options: { allowHumanCorrections?: boolean } = {},
) {
  const selected = new Map(
    record.uploads
      .filter((upload) => record.selectedUploadIds.includes(upload.id))
      .map((upload) => [upload.id, upload]),
  );
  if (
    understanding.documentCoverage.length !== selected.size ||
    understanding.documentCoverage.some(
      (item) =>
        !selected.has(item.uploadId) ||
        selected.get(item.uploadId)?.name !== item.name,
    )
  )
    throw new Error(
      "Die KI-Antwort verweist auf eine nicht ausgewählte Datei.",
    );
  const mainAnswers = new Set(
    record.mainAnswers.map((answer) => answer.topicId),
  );
  const followUpAnswers = new Set(
    record.followUpAnswers.map((answer) => answer.questionId),
  );
  const invalidEvidence = understanding.evidence.some((evidence) => {
    if (evidence.kind === "main_answer")
      return !mainAnswers.has(evidence.sourceId as TopicId);
    if (evidence.kind === "follow_up_answer")
      return !followUpAnswers.has(evidence.sourceId);
    if (evidence.kind === "upload") return !selected.has(evidence.sourceId);
    return !(
      options.allowHumanCorrections === true &&
      evidence.kind === "human_correction" &&
      evidence.sourceId === evidence.id
    );
  });
  if (invalidEvidence)
    throw new Error("Die KI-Antwort enthält eine unbekannte Evidenzquelle.");
  return understanding;
}
