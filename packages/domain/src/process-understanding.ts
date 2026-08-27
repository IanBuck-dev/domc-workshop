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
export const interactionModeSchema = z.enum(["chat", "form"]);
export const confirmationQualitySchema = z
  .enum(["complete", "with_gaps"])
  .nullable();
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

const legacyAllowedExtensionsSchema = z.tuple([
  z.literal(".pdf"),
  z.literal(".xlsx"),
  z.literal(".csv"),
  z.literal(".docx"),
  z.literal(".txt"),
  z.literal(".md"),
  z.literal(".png"),
  z.literal(".jpg"),
  z.literal(".jpeg"),
]);
const allowedExtensionsSchema = z.union([
  legacyAllowedExtensionsSchema,
  z.tuple([
    z.literal(".pdf"),
    z.literal(".xlsx"),
    z.literal(".csv"),
    z.literal(".docx"),
    z.literal(".pptx"),
    z.literal(".txt"),
    z.literal(".md"),
    z.literal(".png"),
    z.literal(".jpg"),
    z.literal(".jpeg"),
  ]),
]);

const processCaptureConfigBase = {
  schemaVersion: z.literal(1),
  departments: z.array(z.string().trim().min(1).max(120)).min(1).max(100),
  topics: z.array(topicDefinitionSchema).length(5),
  instructions: processInstructionsSchema,
  uploads: z.object({
    allowedExtensions: allowedExtensionsSchema,
    maxFiles: z.literal(5),
    maxFileBytes: z.literal(20 * 1024 * 1024),
    maxProcessBytes: z.literal(100 * 1024 * 1024),
  }),
  ai: z.object({
    model: z.enum(["sonnet", "opus", "claude-opus-4-8", "gpt-5.6-sol"]),
    reasoningEffort: z.literal("medium"),
    timeoutMs: z.number().int().min(10_000).max(600_000),
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
const processCaptureConfigV3Schema = z.object({
  ...processCaptureConfigBase,
  profile: z.object({ id: z.literal("compact-v1"), version: z.literal(3) }),
  workCharacteristics: z.array(workCharacteristicDefinitionSchema).length(4),
});

export const processCaptureConfigSchema = z
  .union([
    processCaptureConfigV1Schema,
    processCaptureConfigV2Schema,
    processCaptureConfigV3Schema,
  ])
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
export const validationInputSnapshotSchema = z
  .object({
    mainAnswers: z.array(topicAnswerSchema).length(5),
    workCharacteristicAnswers: z.array(workCharacteristicAnswerSchema).max(4),
    selectedUploadIds: z.array(z.string().uuid()).max(5),
  })
  .superRefine((snapshot, ctx) => {
    const mainIds = snapshot.mainAnswers.map((answer) => answer.topicId);
    const characteristicIds = snapshot.workCharacteristicAnswers.map(
      (answer) => answer.characteristicId,
    );
    if (
      new Set(mainIds).size !== topicIds.length ||
      topicIds.some((id) => !mainIds.includes(id))
    )
      ctx.addIssue({
        code: "custom",
        path: ["mainAnswers"],
        message: "A validation snapshot requires each topic exactly once.",
      });
    if (new Set(characteristicIds).size !== characteristicIds.length)
      ctx.addIssue({
        code: "custom",
        path: ["workCharacteristicAnswers"],
        message: "Validation work characteristics must be unique.",
      });
    if (
      new Set(snapshot.selectedUploadIds).size !==
      snapshot.selectedUploadIds.length
    )
      ctx.addIssue({
        code: "custom",
        path: ["selectedUploadIds"],
        message: "Validation upload IDs must be unique.",
      });
  });
export const previousQuestionReviewSchema = z.object({
  questionId: identifierSchema,
  topicId: topicIdSchema,
  outcome: z.enum(["addressed", "not_addressed"]),
  rationale: z.string().trim().min(1).max(2_000),
});
export const evidenceReferenceSchema = z
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

const factBase = {
  provenance: provenanceSchema,
  evidenceIds: z.array(identifierSchema).max(50),
  confidence: z.number().int().min(0).max(100).nullable(),
  assumptions: z.array(z.string().trim().min(1).max(1_000)).max(20),
  confirmed: z.boolean(),
};
export const coverageStateSchema = z.enum([
  "known",
  "unknown",
  "not_applicable",
]);
export function qualifiedCurrentStateValueSchema<T extends z.ZodType>(
  value: T,
) {
  return z
    .object({
      state: coverageStateSchema,
      value: value.nullable(),
      reason: z.string().trim().min(1).max(2_000).nullable(),
      ...factBase,
    })
    .strict()
    .superRefine((item, ctx) => {
      const currentValue = (item as unknown as { value: unknown }).value;
      if (item.state === "known" && currentValue === null)
        ctx.addIssue({
          code: "custom",
          path: ["value"],
          message: "Bekannte Angaben benötigen einen Wert.",
        });
      if (item.state !== "known" && !item.reason)
        ctx.addIssue({
          code: "custom",
          path: ["reason"],
          message:
            "Unbekannte oder nicht zutreffende Angaben benötigen eine Begründung.",
        });
      if (item.state === "known" && item.reason !== null)
        ctx.addIssue({
          code: "custom",
          path: ["reason"],
          message: "Bekannte Angaben dürfen keine Lückenbegründung enthalten.",
        });
      if (item.state === "unknown" && item.provenance !== "unknown")
        ctx.addIssue({
          code: "custom",
          path: ["provenance"],
          message: "Unbekannte Angaben haben die Provenienz unbekannt.",
        });
    });
}
export const processActorSchema = z
  .object({
    id: identifierSchema,
    kind: z.enum(["department", "role", "external_party"]),
    name: z.string().trim().min(1).max(240),
    involvement: z.enum([
      "performs",
      "decides",
      "approves",
      "receives",
      "supplies",
    ]),
  })
  .strict();
export const processSystemSchema = z
  .object({
    id: identifierSchema,
    name: z.string().trim().min(1).max(240),
    kind: z.enum([
      "application",
      "repository",
      "communication",
      "manual_tool",
      "other",
    ]),
  })
  .strict();
export const processPainPointSchema = z
  .object({
    id: identifierSchema,
    description: z.string().trim().min(1).max(2_000),
  })
  .strict();
export const processVariationSchema = z
  .object({
    id: identifierSchema,
    name: z.string().trim().min(1).max(240),
    kind: z.enum(["flow_branch", "step_exception"]),
    trigger: z.string().trim().min(1).max(2_000),
    currentHandling: z.string().trim().min(1).max(2_000),
    affectedStepIds: z.array(identifierSchema).max(8),
    gatewayId: identifierSchema.nullable(),
  })
  .strict();
export const processHandoffSchema = z
  .object({
    fromActorRef: identifierSchema,
    toActorRef: identifierSchema,
    transferredInformationIds: z.array(identifierSchema).max(40),
    channel: z.string().trim().min(1).max(1_000),
    mediaBreak: z.enum(["yes", "no", "unknown"]),
    note: z.string().trim().min(1).max(2_000).nullable(),
  })
  .strict();
export const currentStateDetailsSchema = z
  .object({
    schemaVersion: z.literal(1),
    currentStateSummary: qualifiedCurrentStateValueSchema(
      z.string().trim().min(1).max(4_000),
    ),
    processOwner: qualifiedCurrentStateValueSchema(
      z
        .object({
          department: z.string().trim().min(1).max(120),
          role: z.string().trim().min(1).max(240),
        })
        .strict(),
    ),
    confidentiality: qualifiedCurrentStateValueSchema(
      z.enum(["internal", "confidential", "strictly_confidential"]),
    ),
    systems: qualifiedCurrentStateValueSchema(
      z.array(processSystemSchema).max(40),
    ),
    painPoints: qualifiedCurrentStateValueSchema(
      z.array(processPainPointSchema).max(40),
    ),
    variations: qualifiedCurrentStateValueSchema(
      z.array(processVariationSchema).max(40),
    ),
    operationalContext: z
      .object({
        operationAndSupport: qualifiedCurrentStateValueSchema(
          z.string().trim().min(1).max(4_000),
        ),
        accessAndProtection: qualifiedCurrentStateValueSchema(
          z.string().trim().min(1).max(4_000),
        ),
        monitoringAndTraceability: qualifiedCurrentStateValueSchema(
          z.string().trim().min(1).max(4_000),
        ),
        constraintsAndOpenQuestions: qualifiedCurrentStateValueSchema(
          z.array(z.string().trim().min(1).max(2_000)).max(40),
        ),
      })
      .strict(),
  })
  .strict();
export const stringFactSchema = z
  .object({
    value: z.string().trim().min(1).max(12_000).nullable(),
    ...factBase,
  })
  .strict();
export const stringListFactSchema = z
  .object({
    value: z.array(z.string().trim().min(1).max(2_000)).max(100).nullable(),
    ...factBase,
  })
  .strict();

export const processInformationTypes = [
  "system_field",
  "email",
  "spreadsheet",
  "document",
  "image_or_scan",
  "free_text",
  "database_or_report",
  "other",
  "unknown",
] as const;
export const processInformationTypeSchema = z.enum(processInformationTypes);
export const processDecisionModes = [
  "rule_based",
  "professional_judgement",
  "mixed",
  "unknown",
] as const;
export const processDecisionModeSchema = z.enum(processDecisionModes);

const uniqueStepTextArray = (maximum: number) =>
  z
    .array(z.string().trim().min(1).max(1_000))
    .max(maximum)
    .superRefine((values, ctx) => {
      if (new Set(values).size !== values.length)
        ctx.addIssue({
          code: "custom",
          message: "Step values must be unique.",
        });
    });

const processInformationTypeDetailSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .nullable();

function addInformationTypeDetailIssue(
  item: {
    type: z.infer<typeof processInformationTypeSchema>;
    typeDetail: string | null;
  },
  ctx: z.RefinementCtx,
) {
  if (item.type !== "other" && item.typeDetail !== null)
    ctx.addIssue({
      code: "custom",
      path: ["typeDetail"],
      message: "Only information type 'other' may define typeDetail.",
    });
}

export const processInformationItemSchema = z
  .object({
    id: identifierSchema,
    name: z.string().trim().min(1).max(1_000),
    source: z.string().trim().min(1).max(1_000).nullable(),
    type: processInformationTypeSchema,
    typeDetail: processInformationTypeDetailSchema.default(null),
  })
  .strict()
  .superRefine(addInformationTypeDetailIssue);

export const processFlowIdentifierSchema = z
  .string()
  .trim()
  .min(1)
  .regex(
    /^(start|end|step-[1-9]\d*|xor-[1-9]\d*|edge-[1-9]\d*)$/,
    "Graph IDs must be start, end, step-<n>, xor-<n>, or edge-<n>.",
  );

const flowTextSchema = (maximum: number) =>
  z.string().trim().min(1).max(maximum);

export const processFlowStartEventNodeSchema = z
  .object({ id: processFlowIdentifierSchema, kind: z.literal("startEvent") })
  .strict();
export const processFlowStepNodeSchema = z
  .object({
    id: processFlowIdentifierSchema,
    kind: z.literal("step"),
    stepId: identifierSchema,
  })
  .strict();
export const processFlowGatewayNodeSchema = z
  .object({
    id: processFlowIdentifierSchema,
    kind: z.literal("gateway"),
    question: flowTextSchema(2_000),
    mode: processDecisionModeSchema,
    variationRef: identifierSchema.nullable().optional(),
    humanInvolvement: z
      .enum(["yes", "partial", "no", "unknown"])
      .nullable()
      .optional(),
    ownerActorRef: identifierSchema.nullable().optional(),
  })
  .strict();
export const processFlowEndEventNodeSchema = z
  .object({ id: processFlowIdentifierSchema, kind: z.literal("endEvent") })
  .strict();
export const processFlowNodeSchema = z.discriminatedUnion("kind", [
  processFlowStartEventNodeSchema,
  processFlowStepNodeSchema,
  processFlowGatewayNodeSchema,
  processFlowEndEventNodeSchema,
]);
export const processFlowEdgeSchema = z
  .object({
    id: processFlowIdentifierSchema,
    source: processFlowIdentifierSchema,
    target: processFlowIdentifierSchema,
    label: flowTextSchema(1_000).optional(),
    determination: flowTextSchema(2_000).optional(),
    consequence: flowTextSchema(2_000).optional(),
    handoff: qualifiedCurrentStateValueSchema(processHandoffSchema)
      .nullable()
      .optional(),
  })
  .strict();
export const processFlowSchema = z
  .object({
    nodes: z.array(processFlowNodeSchema).min(3).max(64),
    edges: z.array(processFlowEdgeSchema).min(2).max(128),
  })
  .strict();

export const processStepSchema = z
  .object({
    id: identifierSchema,
    order: z.number().int().min(1).max(8),
    name: z.string().trim().min(1).max(500),
    activity: z.string().trim().min(1).max(1_000),
    inputs: uniqueStepTextArray(30),
    outputs: uniqueStepTextArray(30),
    informationItems: z.array(processInformationItemSchema).max(40),
    miscellaneous: z.string().trim().min(1).max(4_000).nullable(),
    actors: z.array(processActorSchema).max(20).optional(),
    systemRefs: z.array(identifierSchema).max(40).optional(),
    painPoints: z
      .array(
        z
          .object({
            painPointRef: identifierSchema,
            cause: z.string().trim().min(1).max(2_000).nullable(),
          })
          .strict(),
      )
      .max(40)
      .optional(),
    decisions: z
      .array(
        z
          .object({
            description: z.string().trim().min(1).max(2_000),
            humanInvolvement: z.enum(["yes", "partial", "no", "unknown"]),
            decisionOwnerActorRef: identifierSchema.nullable(),
          })
          .strict(),
      )
      .max(20)
      .optional(),
    exceptionRefs: z.array(identifierSchema).max(20).optional(),
    ...factBase,
  })
  .strict();

export const documentCoverageSchema = z
  .object({
    uploadId: z.string().uuid(),
    name: z.string().trim().min(1).max(240),
    status: z.enum(["complete", "partial", "failed"]),
    processedCharacters: z.number().int().nonnegative().nullable(),
    limitation: z.string().trim().min(1).max(2_000).nullable(),
  })
  .strict()
  .superRefine((coverage, ctx) => {
    if (
      (coverage.status === "partial" || coverage.status === "failed") &&
      !coverage.limitation
    )
      ctx.addIssue({
        code: "custom",
        path: ["limitation"],
        message: "Partial or failed document coverage requires a limitation.",
      });

    if (
      coverage.status === "failed" &&
      coverage.processedCharacters !== null &&
      coverage.processedCharacters > 0
    )
      ctx.addIssue({
        code: "custom",
        path: ["processedCharacters"],
        message: "Failed document coverage cannot report processed characters.",
      });
  });
const processUnderstandingV3Fields = {
  purpose: stringFactSchema,
  trigger: stringFactSchema,
  outcome: stringFactSchema,
  boundaries: stringFactSchema,
  participants: stringListFactSchema,
  informationSources: stringListFactSchema,
  systems: stringListFactSchema,
  controls: stringListFactSchema,
  handoffs: stringListFactSchema,
  volumeAndTime: stringListFactSchema,
  painPoints: stringListFactSchema,
  improvementGoals: stringListFactSchema,
  evidence: z.array(evidenceReferenceSchema).max(250),
  documentCoverage: z.array(documentCoverageSchema).max(5),
  knowledgeGaps: z.array(z.string().trim().min(1).max(2_000)).max(50),
  conflicts: z.array(z.string().trim().min(1).max(2_000)).max(50),
};

type ProcessFlow = z.infer<typeof processFlowSchema>;
type ProcessStep = z.infer<typeof processStepSchema>;

export type FlowIssue = {
  path: string;
  code: string;
  message: string;
};

function walkGraph(start: string, adjacency: Map<string, string[]>) {
  const visited = new Set<string>();
  const pending = [start];
  while (pending.length) {
    const id = pending.pop()!;
    if (visited.has(id)) continue;
    visited.add(id);
    for (const target of adjacency.get(id) ?? [])
      if (!visited.has(target)) pending.push(target);
  }
  return visited;
}

/** Validiert den kanonischen Prozessgraphen ohne Zod- oder UI-Abhängigkeit. */
export function validateProcessFlow(
  flow: ProcessFlow,
  steps: ProcessStep[],
): FlowIssue[] {
  const issues: FlowIssue[] = [];
  const add = (path: string, code: string, message: string) =>
    issues.push({ path, code, message });
  const { nodes, edges } = flow;
  const nodeIds = nodes.map((node) => node.id);
  const edgeIds = edges.map((edge) => edge.id);
  const allGraphIds = [...nodeIds, ...edgeIds];

  if (new Set(nodeIds).size !== nodeIds.length)
    add("flow.nodes", "duplicate_node_id", "Flow node IDs must be unique.");
  if (new Set(edgeIds).size !== edgeIds.length)
    add("flow.edges", "duplicate_edge_id", "Flow edge IDs must be unique.");
  if (new Set(allGraphIds).size !== allGraphIds.length)
    add(
      "flow",
      "duplicate_graph_id",
      "Node and edge IDs must be unique across the flow.",
    );

  const starts = nodes.filter((node) => node.kind === "startEvent");
  const ends = nodes.filter((node) => node.kind === "endEvent");
  if (starts.length !== 1)
    add(
      "flow.nodes",
      "start_count",
      "A flow requires exactly one start event.",
    );
  if (ends.length !== 1)
    add("flow.nodes", "end_count", "A flow requires exactly one end event.");

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const outgoing = new Map(nodes.map((node) => [node.id, [] as number[]]));
  const incoming = new Map(nodes.map((node) => [node.id, [] as number[]]));
  edges.forEach((edge, edgeIndex) => {
    if (!/^edge-[1-9]\d*$/.test(edge.id))
      add(
        `flow.edges[${edgeIndex}].id`,
        "edge_id_type",
        "An edge ID must be edge-<n>.",
      );
    if (!nodeById.has(edge.source))
      add(
        `flow.edges[${edgeIndex}].source`,
        "unknown_source",
        `Unknown source node ID: ${edge.source}`,
      );
    if (!nodeById.has(edge.target))
      add(
        `flow.edges[${edgeIndex}].target`,
        "unknown_target",
        `Unknown target node ID: ${edge.target}`,
      );
    outgoing.get(edge.source)?.push(edgeIndex);
    incoming.get(edge.target)?.push(edgeIndex);

    if (
      (edge.determination !== undefined || edge.consequence !== undefined) &&
      nodeById.get(edge.source)?.kind !== "gateway"
    )
      add(
        `flow.edges[${edgeIndex}]`,
        "gateway_edge_detail",
        "Determination and consequence are only allowed on gateway edges.",
      );
  });

  nodes.forEach((node, nodeIndex) => {
    const nodePath = `flow.nodes[${nodeIndex}]`;
    const idMatchesKind =
      (node.kind === "startEvent" && node.id === "start") ||
      (node.kind === "endEvent" && node.id === "end") ||
      (node.kind === "step" && /^step-[1-9]\d*$/.test(node.id)) ||
      (node.kind === "gateway" && /^xor-[1-9]\d*$/.test(node.id));
    if (!idMatchesKind)
      add(
        `${nodePath}.id`,
        "node_id_type",
        "The node ID must match its graph-object type.",
      );
    const outgoingEdges = (outgoing.get(node.id) ?? []).map(
      (index) => edges[index]!,
    );
    const incomingEdges = (incoming.get(node.id) ?? []).map(
      (index) => edges[index]!,
    );

    if (node.kind === "startEvent") {
      if (incomingEdges.length !== 0 || outgoingEdges.length !== 1)
        add(
          nodePath,
          "start_degree",
          "The start event requires no incoming and one outgoing edge.",
        );
      if (
        outgoingEdges[0] &&
        nodeById.get(outgoingEdges[0].target)?.kind !== "step"
      )
        add(
          nodePath,
          "start_target",
          "The start event must lead to a step node.",
        );
    }

    if (node.kind === "step") {
      if (outgoingEdges.length !== 1)
        add(
          nodePath,
          "step_degree",
          "A step node requires exactly one outgoing edge.",
        );
      outgoingEdges.forEach((edge) => {
        const targetKind = nodeById.get(edge.target)?.kind;
        if (
          targetKind !== "step" &&
          targetKind !== "gateway" &&
          targetKind !== "endEvent"
        )
          add(
            `flow.edges[${edges.indexOf(edge)}].target`,
            "step_target",
            "A step must lead to a step, gateway, or the end event.",
          );
      });
    }

    if (node.kind === "gateway") {
      if (
        incomingEdges.length !== 1 ||
        nodeById.get(incomingEdges[0]?.source ?? "")?.kind !== "step"
      )
        add(
          nodePath,
          "gateway_source",
          "A gateway requires exactly one incoming edge from a step.",
        );
      if (outgoingEdges.length < 2)
        add(
          nodePath,
          "gateway_degree",
          "A gateway requires at least two outgoing edges.",
        );
      for (const edge of outgoingEdges) {
        const edgeIndex = edges.indexOf(edge);
        if (!edge.label)
          add(
            `flow.edges[${edgeIndex}].label`,
            "gateway_label",
            "Gateway branches require an answer label.",
          );
        const targetKind = nodeById.get(edge.target)?.kind;
        if (targetKind !== "step" && targetKind !== "endEvent")
          add(
            `flow.edges[${edgeIndex}].target`,
            "gateway_target",
            "A gateway branch must lead to a step or the end event.",
          );
      }
    }

    if (node.kind === "endEvent" && outgoingEdges.length !== 0)
      add(nodePath, "end_degree", "The end event cannot have outgoing edges.");
  });

  const knownStepIds = new Set(steps.map((step) => step.id));
  const stepNodes = nodes.flatMap((node, nodeIndex) =>
    node.kind === "step" ? [{ node, nodeIndex }] : [],
  );
  const referencedStepIds = stepNodes.map(({ node }) => node.stepId);
  stepNodes.forEach(({ node, nodeIndex }) => {
    if (!knownStepIds.has(node.stepId))
      add(
        `flow.nodes[${nodeIndex}].stepId`,
        "unknown_step",
        `Unknown step ID: ${node.stepId}`,
      );
  });
  if (new Set(referencedStepIds).size !== referencedStepIds.length)
    add(
      "flow.nodes",
      "duplicate_step_reference",
      "Every step may be referenced by only one flow node.",
    );
  steps.forEach((step, stepIndex) => {
    if (!referencedStepIds.includes(step.id))
      add(
        `steps[${stepIndex}].id`,
        "missing_step_node",
        `Step is missing its flow node: ${step.id}`,
      );
  });

  if (starts.length !== 1 || ends.length !== 1) return issues;
  const adjacency = new Map(nodes.map((node) => [node.id, [] as string[]]));
  const reverse = new Map(nodes.map((node) => [node.id, [] as string[]]));
  for (const edge of edges) {
    if (!nodeById.has(edge.source) || !nodeById.has(edge.target)) continue;
    adjacency.get(edge.source)!.push(edge.target);
    reverse.get(edge.target)!.push(edge.source);
  }
  const reachableFromStart = walkGraph(starts[0]!.id, adjacency);
  nodes.forEach((node, nodeIndex) => {
    if (!reachableFromStart.has(node.id))
      add(
        `flow.nodes[${nodeIndex}]`,
        "unreachable_node",
        `Node is not reachable from the start event: ${node.id}`,
      );
  });
  // Die Rückwärtssuche erkennt auch erreichbare Zyklen ohne Ausstieg zum Ende.
  const canReachEnd = walkGraph(ends[0]!.id, reverse);
  nodes.forEach((node, nodeIndex) => {
    if (!canReachEnd.has(node.id))
      add(
        `flow.nodes[${nodeIndex}]`,
        "dead_end",
        `Node cannot reach the end event: ${node.id}`,
      );
  });
  return issues;
}

function addSharedUnderstandingIssues(
  value: {
    steps: Array<z.infer<typeof processStepSchema>>;
    evidence: Array<z.infer<typeof evidenceReferenceSchema>>;
    documentCoverage: Array<z.infer<typeof documentCoverageSchema>>;
    purpose: z.infer<typeof stringFactSchema>;
    trigger: z.infer<typeof stringFactSchema>;
    outcome: z.infer<typeof stringFactSchema>;
    boundaries: z.infer<typeof stringFactSchema>;
    participants: z.infer<typeof stringListFactSchema>;
    informationSources: z.infer<typeof stringListFactSchema>;
    systems: z.infer<typeof stringListFactSchema>;
    controls: z.infer<typeof stringListFactSchema>;
    handoffs: z.infer<typeof stringListFactSchema>;
    volumeAndTime: z.infer<typeof stringListFactSchema>;
    painPoints: z.infer<typeof stringListFactSchema>;
    improvementGoals: z.infer<typeof stringListFactSchema>;
  },
  ctx: z.RefinementCtx,
) {
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

  const informationIds = value.steps.flatMap((step) =>
    step.informationItems.map((item) => item.id),
  );
  if (new Set(informationIds).size !== informationIds.length)
    ctx.addIssue({
      code: "custom",
      path: ["steps"],
      message: "Information IDs must be unique.",
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
}

const processUnderstandingV3BaseSchema = z
  .object({
    schemaVersion: z.literal(3),
    ...processUnderstandingV3Fields,
    steps: z.array(processStepSchema).min(1).max(8),
    flow: processFlowSchema,
  })
  .strict();

function zodPath(path: string) {
  return path
    .split(/[.[\]]/)
    .filter(Boolean)
    .map((part) => (/^\d+$/.test(part) ? Number(part) : part));
}

function addUnderstandingV3Issues(
  value: z.infer<typeof processUnderstandingV3BaseSchema>,
  ctx: z.RefinementCtx,
) {
  addSharedUnderstandingIssues(value, ctx);
  validateProcessFlow(value.flow, value.steps).forEach((issue) =>
    ctx.addIssue({
      code: "custom",
      path: zodPath(issue.path),
      message: issue.message,
    }),
  );
}

export const processUnderstandingSchema =
  processUnderstandingV3BaseSchema.superRefine(addUnderstandingV3Issues);
export const processUnderstandingV3Schema = processUnderstandingSchema;
export const processUnderstandingStorageSchema = processUnderstandingSchema;

const processInformationItemAiSchema = z
  .object({
    name: z.string().trim().min(1).max(1_000),
    source: z.string().trim().min(1).max(1_000).nullable(),
    type: processInformationTypeSchema,
    typeDetail: processInformationTypeDetailSchema,
  })
  .strict()
  .superRefine(addInformationTypeDetailIssue);
const processStepAiSchema = processStepSchema
  .omit({ informationItems: true })
  .extend({
    informationItems: z.array(processInformationItemAiSchema).max(40),
  })
  .strict();

const processSynthesisEvidenceSchema = evidenceReferenceSchema
  .extend({
    kind: z.enum(["main_answer", "follow_up_answer", "upload"]),
  })
  .strict();

export const processSynthesisAiResultSchema = z
  .object({
    schemaVersion: z.literal(3),
    ...processUnderstandingV3Fields,
    evidence: z.array(processSynthesisEvidenceSchema).max(250),
    steps: z.array(processStepAiSchema).min(5).max(8),
    flow: processFlowSchema,
  })
  .strict();

function deterministicNestedId(
  prefix: "info",
  stepId: string,
  positions: number[],
) {
  const suffix = `-${positions.join("-")}`;
  const fixed = `${prefix}-`;
  const maximumStepLength = 120 - fixed.length - suffix.length;
  let component = stepId;
  if (component.length > maximumStepLength) {
    let hash = 2_166_136_261;
    for (const character of component) {
      hash ^= character.codePointAt(0) ?? 0;
      hash = Math.imul(hash, 16_777_619);
    }
    const digest = (hash >>> 0).toString(36);
    component = `${component.slice(0, maximumStepLength - digest.length - 1)}-${digest}`;
  }
  return `${fixed}${component}${suffix}`;
}

export function normalizeProcessSynthesisResult(input: unknown) {
  const value = processSynthesisAiResultSchema.parse(input);
  return processUnderstandingSchema.parse({
    ...value,
    steps: value.steps.map((step) => ({
      ...step,
      informationItems: step.informationItems.map((item, index) => ({
        ...item,
        id: deterministicNestedId("info", step.id, [index + 1]),
      })),
    })),
  });
}

export const uploadRecordSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(240),
  mediaType: z.string().trim().min(1).max(200),
  size: z.number().int().positive(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  uploadedAt: z.string().datetime(),
});
export const aiTraceSchema = z.object({
  // Records written before provider selection existed came from Claude CLI.
  provider: z.enum(["codex-cli", "claude-cli"]).default("claude-cli"),
  operationId: z.string().uuid(),
  sessionId: z.string().min(1).nullable(),
  model: z.string().min(1),
  durationMs: z.number().int().nonnegative(),
  inputTokens: z.number().int().nonnegative().nullable(),
  outputTokens: z.number().int().nonnegative().nullable(),
  sandboxed: z.boolean().optional(),
});

export const validationRunSchema = z.object({
  runNumber: z.number().int().positive(),
  completedAt: z.string().datetime(),
  inputSnapshot: validationInputSnapshotSchema,
  questions: z.array(followUpQuestionSchema).max(5),
  previousQuestionReviews: z.array(previousQuestionReviewSchema).max(5),
  trace: aiTraceSchema.nullable(),
});

export const processCaptureRecordSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().regex(/^PROC-\d{4}$/),
    state: processStateSchema,
    profile: z.object({
      id: z.literal("compact-v1"),
      version: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    }),
    configHash: z.string().regex(/^[a-f0-9]{64}$/),
    interactionMode: interactionModeSchema.default("form"),
    confirmationQuality: confirmationQualitySchema.default(null),
    cover: coverSchema,
    configSnapshot: processCaptureConfigSchema,
    mainAnswers: z.array(topicAnswerSchema).max(5),
    workCharacteristicAnswers: z.array(workCharacteristicAnswerSchema).max(4),
    followUps: z.array(followUpQuestionSchema).max(5),
    followUpAnswers: z.array(followUpAnswerSchema).max(5),
    validationRuns: z.array(validationRunSchema),
    selectedUploadIds: z.array(z.string().uuid()).max(5),
    understanding: processUnderstandingSchema.nullable(),
    currentStateDetails: currentStateDetailsSchema.nullable().default(null),
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
    record.validationRuns.forEach((run, index) => {
      if (run.runNumber !== index + 1)
        ctx.addIssue({
          code: "custom",
          path: ["validationRuns", index, "runNumber"],
          message: "Validation run numbers must be contiguous.",
        });
      if (index > 0 && run.trace === null)
        ctx.addIssue({
          code: "custom",
          path: ["validationRuns", index, "trace"],
          message: "Only a migrated legacy baseline may omit its AI trace.",
        });
      const snapshotCharacteristicsValid =
        record.profile.version === 1
          ? run.inputSnapshot.workCharacteristicAnswers.length === 0
          : workCharacteristicAnswersSchema.safeParse(
              run.inputSnapshot.workCharacteristicAnswers,
            ).success;
      if (!snapshotCharacteristicsValid)
        ctx.addIssue({
          code: "custom",
          path: ["validationRuns", index, "inputSnapshot"],
          message:
            "Validation snapshots must match the capture profile's work characteristics.",
        });
      const topicIdsInRun = run.questions.map((question) => question.topicId);
      const questionIdsInRun = run.questions.map((question) => question.id);
      if (new Set(topicIdsInRun).size !== topicIdsInRun.length)
        ctx.addIssue({
          code: "custom",
          path: ["validationRuns", index, "questions"],
          message: "Only one validation question per topic is allowed.",
        });
      if (new Set(questionIdsInRun).size !== questionIdsInRun.length)
        ctx.addIssue({
          code: "custom",
          path: ["validationRuns", index, "questions"],
          message: "Validation question IDs must be unique per run.",
        });
      const previousQuestions =
        record.validationRuns[index - 1]?.questions ?? [];
      const reviews = new Map(
        run.previousQuestionReviews.map((review) => [
          review.questionId,
          review,
        ]),
      );
      if (
        reviews.size !== run.previousQuestionReviews.length ||
        reviews.size !== previousQuestions.length ||
        previousQuestions.some(
          (question) => reviews.get(question.id)?.topicId !== question.topicId,
        )
      )
        ctx.addIssue({
          code: "custom",
          path: ["validationRuns", index, "previousQuestionReviews"],
          message:
            "Every immediately preceding question must be reviewed exactly once.",
        });
    });
    const latestValidation = record.validationRuns.at(-1);
    if (
      latestValidation &&
      JSON.stringify(record.followUps) !==
        JSON.stringify(latestValidation.questions)
    )
      ctx.addIssue({
        code: "custom",
        path: ["followUps"],
        message: "Current follow-ups must match the latest validation run.",
      });
    const expected = new Map(
      record.followUps.map((question) => [question.id, question.topicId]),
    );
    if (
      !record.validationRuns.length &&
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
    if (
      record.interactionMode === "form" &&
      record.state !== "capture_in_progress" &&
      !workCharacteristicsValid
    )
      ctx.addIssue({
        code: "custom",
        path: ["workCharacteristicAnswers"],
        message: "This process state requires all four work characteristics.",
      });
    if (
      record.interactionMode === "form" &&
      record.state === "capture_in_progress" &&
      record.validationRuns.length
    )
      ctx.addIssue({
        code: "custom",
        path: ["state"],
        message: "Capture-in-progress cannot contain a completed validation.",
      });
    if (
      record.interactionMode === "form" &&
      record.state !== "capture_in_progress" &&
      !hasAllMainAnswers
    )
      ctx.addIssue({
        code: "custom",
        path: ["state"],
        message: "This process state requires all five main answers.",
      });
    if (
      record.interactionMode === "form" &&
      record.state === "follow_up_required" &&
      (record.followUps.length === 0 ||
        (latestValidation !== undefined &&
          latestValidation.questions.length === 0))
    )
      ctx.addIssue({
        code: "custom",
        path: ["state"],
        message: "Follow-up-required state requires unanswered questions.",
      });
    if (
      record.interactionMode === "form" &&
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
      record.interactionMode === "form" &&
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
    if (record.state === "confirmed" && record.confirmationQuality === null)
      ctx.addIssue({
        code: "custom",
        path: ["confirmationQuality"],
        message: "A confirmed process requires a confirmation quality.",
      });
    if (
      record.interactionMode === "chat" &&
      record.state === "confirmed" &&
      record.understanding === null
    )
      ctx.addIssue({
        code: "custom",
        path: ["understanding"],
        message: "A confirmed chat capture requires a valid understanding.",
      });
    if (
      record.interactionMode === "chat" &&
      record.state !== "confirmed" &&
      record.confirmationQuality !== null
    )
      ctx.addIssue({
        code: "custom",
        path: ["confirmationQuality"],
        message: "Chat confirmation quality is only stored after confirmation.",
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
export type ValidationInputSnapshot = z.infer<
  typeof validationInputSnapshotSchema
>;
export type PreviousQuestionReview = z.infer<
  typeof previousQuestionReviewSchema
>;
export type ValidationRun = z.infer<typeof validationRunSchema>;
export type ProcessUnderstanding = z.infer<typeof processUnderstandingSchema>;
export type ProcessCaptureRecord = z.infer<typeof processCaptureRecordSchema>;
export const processDefinitionDraftSchema = z
  .object({
    schemaVersion: z.literal(1),
    understanding: processUnderstandingSchema,
    currentStateDetails: currentStateDetailsSchema,
  })
  .strict();
export type ProcessDefinitionDraft = z.infer<
  typeof processDefinitionDraftSchema
>;
export type CurrentStateDetails = z.infer<typeof currentStateDetailsSchema>;

/** Fachlicher Schlüssel für aktive Prozessaufnahmen. */
export function normalizedProcessName(value: string) {
  return value.trim().toLocaleLowerCase("de-DE").replace(/\s+/g, " ");
}
export type UploadRecord = z.infer<typeof uploadRecordSchema>;
// Input keeps the added provider backward compatible; storage parsing fills legacy
// records with `claude-cli` via the schema default.
export type AiTrace = z.input<typeof aiTraceSchema>;
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
  options: {
    allowHumanCorrections?: boolean;
    chatMessageIds?: Set<string>;
  } = {},
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
    if (evidence.kind === "chat_message")
      return !options.chatMessageIds?.has(evidence.sourceId);
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
