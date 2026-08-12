import { createHash } from "node:crypto";
import { z } from "zod";
import {
  confirmationQualitySchema,
  processCaptureRecordSchema,
  processDecisionModeSchema,
  processInformationTypeSchema,
  provenanceSchema,
  type ProcessCaptureConfig,
  type ProcessCaptureRecord,
} from "./process-understanding.ts";

const sheetNames = [
  "Übersicht",
  "Prozessschritte",
  "Entscheidungen",
  "Informationen",
  "Organisation",
  "Offene Punkte",
  "Nachweise",
] as const;

const labelsSchema = z
  .object({
    unknown: z.string().trim().min(1).max(120),
    notCaptured: z.string().trim().min(1).max(120),
    provenance: z.record(provenanceSchema, z.string().trim().min(1).max(200)),
    informationTypes: z.record(
      processInformationTypeSchema,
      z.string().trim().min(1).max(200),
    ),
    decisionModes: z.record(
      processDecisionModeSchema,
      z.string().trim().min(1).max(200),
    ),
    confirmationQuality: z.record(
      confirmationQualitySchema.unwrap(),
      z.string().trim().min(1).max(200),
    ),
  })
  .strict();

export const pddExportConfigSchema = z
  .object({
    schemaVersion: z.union([z.literal(1), z.literal(2)]),
    enabled: z.boolean().default(true),
    template: z
      .object({
        id: z.string().trim().min(1).max(120),
        version: z.string().trim().min(1).max(40),
        title: z.string().trim().min(1).max(240),
        asset: z.string().trim().min(1).max(240).optional(),
        sha256: z
          .string()
          .regex(/^[a-f0-9]{64}$/)
          .optional(),
        mappingVersion: z.number().int().positive().optional(),
      })
      .strict(),
    sheets: z.array(z.string().trim().min(1).max(120)).min(7).max(17),
    mapping: z.unknown().optional(),
    filenamePrefix: z.string().trim().min(1).max(80),
    labels: labelsSchema,
  })
  .strict();
export type PddExportConfig = z.infer<typeof pddExportConfigSchema>;

export const pddCellSchema = z
  .object({
    value: z.union([z.string().max(20_000), z.number().finite()]),
    kind: z.enum(["text", "number", "date"]),
  })
  .strict();
export const pddSheetModelSchema = z
  .object({
    name: z.enum(sheetNames),
    title: z.string().trim().min(1).max(240),
    columns: z.array(z.string().trim().min(1).max(240)).min(1).max(20),
    rows: z.array(z.array(pddCellSchema).max(20)).max(1_000),
  })
  .strict()
  .superRefine((sheet, ctx) => {
    sheet.rows.forEach((row, index) => {
      if (row.length !== sheet.columns.length)
        ctx.addIssue({
          code: "custom",
          path: ["rows", index],
          message: "PDD row length must match the sheet columns.",
        });
    });
  });

export const pddWorkbookModelSchema = z
  .object({
    schemaVersion: z.literal(1),
    source: z
      .object({
        processId: z.string().regex(/^PROC-\d{4}$/),
        processName: z.string().trim().min(1).max(240),
        sourceRevision: z.string().regex(/^[a-f0-9]{64}$/),
        confirmedAt: z.string().datetime(),
        confirmationQuality: confirmationQualitySchema.unwrap(),
        exportedAt: z.string().datetime(),
      })
      .strict(),
    template: pddExportConfigSchema.shape.template,
    sheets: z.array(pddSheetModelSchema).length(sheetNames.length),
  })
  .strict()
  .superRefine((model, ctx) => {
    if (!model.sheets.every((sheet, index) => sheet.name === sheetNames[index]))
      ctx.addIssue({
        code: "custom",
        path: ["sheets"],
        message: "PDD sheets must use the configured seven-sheet order.",
      });
  });
export type PddWorkbookModel = z.infer<typeof pddWorkbookModelSchema>;

export const pddExportAuditDetailSchema = z
  .object({
    exportId: z.string().uuid(),
    filename: z.string().trim().min(1).max(255).endsWith(".xlsx"),
    byteSize: z.number().int().positive(),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    sourceRevision: z.string().regex(/^[a-f0-9]{64}$/),
    confirmedAt: z.string().datetime(),
    exportedAt: z.string().datetime(),
    initiatedBy: z.string().trim().min(1).max(100),
    template: pddExportConfigSchema.shape.template,
  })
  .strict();
export type PddExportAuditDetail = z.infer<typeof pddExportAuditDetailSchema>;

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}

function text(value: string | null | undefined, unknown: string) {
  return value ?? unknown;
}
function lines(value: string[] | null | undefined, unknown: string) {
  return value?.length ? value.join("\n") : unknown;
}
function evidence(ids: string[]) {
  return ids.length ? ids.join("\n") : "Nicht bekannt";
}
function factRow(
  label: string,
  fact: {
    value: string | string[] | null;
    provenance: keyof PddExportConfig["labels"]["provenance"];
    confidence: number | null;
    confirmed: boolean;
    evidenceIds: string[];
    assumptions: string[];
  },
  config: PddExportConfig,
): z.infer<typeof pddCellSchema>[] {
  const value = Array.isArray(fact.value)
    ? lines(fact.value, config.labels.unknown)
    : text(fact.value, config.labels.unknown);
  return [
    { value: label, kind: "text" },
    { value, kind: "text" },
    { value: config.labels.provenance[fact.provenance], kind: "text" },
    {
      value: fact.confidence === null ? config.labels.unknown : fact.confidence,
      kind: fact.confidence === null ? "text" : "number",
    },
    { value: fact.confirmed ? "Ja" : "Nein", kind: "text" },
    { value: evidence(fact.evidenceIds), kind: "text" },
    { value: lines(fact.assumptions, config.labels.unknown), kind: "text" },
  ];
}

/** Stable revision for the canonical confirmed snapshot used by one export. */
export function pddSourceRevision(input: ProcessCaptureRecord) {
  const record = processCaptureRecordSchema.parse(input);
  if (
    !record.confirmedAt ||
    !record.confirmationQuality ||
    !record.understanding
  )
    throw new Error(
      "Der PDD-Export benötigt ein bestätigtes Prozessverständnis.",
    );
  return createHash("sha256")
    .update(
      canonical({
        cover: record.cover,
        confirmedAt: record.confirmedAt,
        confirmationQuality: record.confirmationQuality,
        workCharacteristicAnswers: record.workCharacteristicAnswers,
        understanding: record.understanding,
        currentStateDetails: record.currentStateDetails,
      }),
    )
    .digest("hex");
}

export function safePddFilename(input: {
  prefix: string;
  processId: string;
  confirmedAt: string;
  sourceRevision: string;
  exportId: string;
}) {
  const processId = z
    .string()
    .regex(/^PROC-\d{4}$/)
    .parse(input.processId);
  const confirmedAt = z.string().datetime().parse(input.confirmedAt);
  const revision = z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .parse(input.sourceRevision);
  const exportId = z.string().uuid().parse(input.exportId);
  const prefix = input.prefix
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  if (!prefix) throw new Error("Ungültiger PDD-Dateiname.");
  const date = confirmedAt.slice(0, 10);
  return `${prefix}-${processId}-${date}-${revision.slice(0, 12)}-${exportId.slice(0, 8)}.xlsx`;
}

export function derivePddCoverage(record: ProcessCaptureRecord) {
  const errors: string[] = [];
  const gaps: string[] = [];
  if (record.profile.version !== 3 || !record.currentStateDetails)
    errors.push("Die vollständige PDD-Definition fehlt.");
  const details = record.currentStateDetails;
  if (details) {
    const qualified = [
      details.currentStateSummary,
      details.processOwner,
      details.confidentiality,
      details.systems,
      details.painPoints,
      details.variations,
      ...Object.values(details.operationalContext),
    ];
    qualified.forEach((item) => {
      if (item.state === "known" && item.value === null)
        errors.push("Eine bekannte PDD-Angabe hat keinen Wert.");
      if (item.state !== "known" && !item.reason)
        errors.push("Eine offene PDD-Angabe hat keine Begründung.");
      if (item.state === "unknown")
        gaps.push(item.reason ?? "PDD-Angabe offen");
    });
  }
  record.understanding?.steps.forEach((step) => {
    if (!step.actors?.length)
      gaps.push(`Beteiligte Rolle für Schritt ${step.order} ist offen.`);
    if (
      step.decisions?.some(
        (decision) =>
          decision.humanInvolvement === "unknown" ||
          ((decision.humanInvolvement === "yes" ||
            decision.humanInvolvement === "partial") &&
            !decision.decisionOwnerActorRef),
      )
    )
      gaps.push(
        `Entscheidung in Schritt ${step.order} ist nicht vollständig geklärt.`,
      );
  });
  return {
    valid: errors.length === 0,
    quality:
      gaps.length ||
      record.understanding?.knowledgeGaps.length ||
      record.understanding?.conflicts.length
        ? ("with_gaps" as const)
        : ("complete" as const),
    covered: Math.max(0, 10 - gaps.length),
    gaps,
    errors,
  };
}
export const validatePddCurrentState = derivePddCoverage;

export function createPddWorkbookModel(
  input: ProcessCaptureRecord,
  configInput: PddExportConfig,
  exportedAt: string,
) {
  const record = processCaptureRecordSchema.parse(input);
  const config = pddExportConfigSchema.parse(configInput);
  const timestamp = z.string().datetime().parse(exportedAt);
  if (
    record.state !== "confirmed" ||
    !record.confirmedAt ||
    !record.confirmationQuality ||
    !record.understanding
  )
    throw new Error(
      "Der PDD-Export ist erst nach der fachlichen Bestätigung verfügbar.",
    );
  const understanding = record.understanding;
  const revision = pddSourceRevision(record);
  const factColumns = [
    "Angabe",
    "Inhalt",
    "Provenienz",
    "Sicherheit",
    "Bestätigt",
    "Nachweise",
    "Annahmen",
  ];
  const assumptions: z.infer<typeof pddCellSchema>[][] = [];
  const addAssumptions = (origin: string, values: string[]) =>
    values.forEach((value) =>
      assumptions.push([
        { value: "Annahme", kind: "text" },
        { value: origin, kind: "text" },
        { value, kind: "text" },
      ]),
    );
  const overviewFacts = [
    ["Zweck", understanding.purpose],
    ["Auslöser", understanding.trigger],
    ["Ergebnis", understanding.outcome],
    ["Geltungsbereich und Abgrenzung", understanding.boundaries],
    ["Mengen und Zeiten", understanding.volumeAndTime],
    ["Bekannte Schwachstellen", understanding.painPoints],
    ["Verbesserungsziele", understanding.improvementGoals],
  ] as const;
  const informationFacts = [
    ["Informationsquellen", understanding.informationSources],
    ["Systeme", understanding.systems],
  ] as const;
  const organizationFacts = [
    ["Beteiligte und Rollen", understanding.participants],
    ["Kontrollen", understanding.controls],
    ["Übergaben", understanding.handoffs],
  ] as const;
  [...overviewFacts, ...informationFacts, ...organizationFacts].forEach(
    ([name, fact]) => addAssumptions(name, fact.assumptions),
  );
  understanding.steps.forEach((step) =>
    addAssumptions(
      `Prozessschritt ${step.order}: ${step.name}`,
      step.assumptions,
    ),
  );

  const gatewayNodes = understanding.flow.nodes.filter(
    (node) => node.kind === "gateway",
  );
  const decisions = gatewayNodes.flatMap((gateway) => {
    const branches = understanding.flow.edges.filter(
      (edge) => edge.source === gateway.id,
    );
    return (branches.length ? branches : [null]).map((branch) => [
      { value: gateway.question, kind: "text" as const },
      {
        value: config.labels.decisionModes[gateway.mode],
        kind: "text" as const,
      },
      { value: branch?.label ?? config.labels.unknown, kind: "text" as const },
      {
        value: branch?.determination ?? config.labels.unknown,
        kind: "text" as const,
      },
      {
        value: branch?.consequence ?? config.labels.unknown,
        kind: "text" as const,
      },
      { value: branch?.target ?? config.labels.unknown, kind: "text" as const },
    ]);
  });
  const overviewRows: z.infer<typeof pddCellSchema>[][] = [
    ["Prozess-ID", record.id, "text"],
    ["Fachbereich", record.cover.department, "text"],
    ["Bestätigt am", record.confirmedAt, "date"],
    [
      "Bestätigungsqualität",
      config.labels.confirmationQuality[record.confirmationQuality],
      "text",
    ],
    ["Quellrevision", revision, "text"],
    ["Exportiert am", timestamp, "date"],
  ].map(([label, value, kind]) => [
    { value: label, kind: "text" },
    { value, kind: kind as "text" | "date" },
    ...Array.from({ length: factColumns.length - 2 }, () => ({
      value: config.labels.unknown,
      kind: "text" as const,
    })),
  ]);
  overviewRows.push(
    ...overviewFacts.map(([name, fact]) => factRow(name, fact, config)),
  );
  const characteristicDefinitions =
    record.profile.version === 2
      ? (
          record.configSnapshot as Extract<
            ProcessCaptureConfig,
            { profile: { version: 2 } }
          >
        ).workCharacteristics
      : null;
  const workCharacteristicRows: z.infer<typeof pddCellSchema>[][] =
    characteristicDefinitions
      ? record.workCharacteristicAnswers.map((answer) => {
          const definition = characteristicDefinitions.find(
            (item) => item.id === answer.characteristicId,
          )!;
          return [
            { value: definition.question, kind: "text" as const },
            {
              value: answer.selectedOptionIds
                .map(
                  (id) =>
                    definition.options.find((option) => option.id === id)
                      ?.label ?? id,
                )
                .join("\n"),
              kind: "text" as const,
            },
            ...Array.from({ length: 5 }, () => ({
              value: config.labels.unknown,
              kind: "text" as const,
            })),
          ];
        })
      : [
          [
            { value: "Arbeitsmerkmale", kind: "text" },
            { value: config.labels.notCaptured, kind: "text" },
            ...Array.from({ length: 5 }, () => ({
              value: config.labels.unknown,
              kind: "text" as const,
            })),
          ],
        ];

  const model = {
    schemaVersion: 1 as const,
    source: {
      processId: record.id,
      processName: record.cover.processName,
      sourceRevision: revision,
      confirmedAt: record.confirmedAt,
      confirmationQuality: record.confirmationQuality,
      exportedAt: timestamp,
    },
    template: config.template,
    sheets: [
      {
        name: config.sheets[0] as (typeof sheetNames)[number],
        title: `${config.template.title}: ${record.cover.processName}`,
        columns: factColumns,
        rows: overviewRows,
      },
      {
        name: config.sheets[1] as (typeof sheetNames)[number],
        title: "Prozessschritte",
        columns: [
          "ID",
          "Nr.",
          "Name",
          "Tätigkeit",
          "Eingaben",
          "Ausgaben",
          "Sonstiges",
          "Provenienz",
          "Sicherheit",
          "Bestätigt",
          "Nachweise",
          "Annahmen",
        ],
        rows: understanding.steps.map((step) => [
          { value: step.id, kind: "text" as const },
          { value: step.order, kind: "number" as const },
          { value: step.name, kind: "text" as const },
          { value: step.activity, kind: "text" as const },
          {
            value: step.inputs.length
              ? step.inputs.join("\n")
              : config.labels.unknown,
            kind: "text" as const,
          },
          {
            value: step.outputs.length
              ? step.outputs.join("\n")
              : config.labels.unknown,
            kind: "text" as const,
          },
          {
            value: text(step.miscellaneous, config.labels.unknown),
            kind: "text" as const,
          },
          {
            value: config.labels.provenance[step.provenance],
            kind: "text" as const,
          },
          {
            value: step.confidence ?? config.labels.unknown,
            kind:
              step.confidence === null
                ? ("text" as const)
                : ("number" as const),
          },
          { value: step.confirmed ? "Ja" : "Nein", kind: "text" as const },
          { value: evidence(step.evidenceIds), kind: "text" as const },
          {
            value: lines(step.assumptions, config.labels.unknown),
            kind: "text" as const,
          },
        ]),
      },
      {
        name: config.sheets[2] as (typeof sheetNames)[number],
        title: "Entscheidungen",
        columns: [
          "Entscheidung",
          "Art",
          "Zweig",
          "Feststellung",
          "Folge",
          "Ziel",
        ],
        rows: decisions,
      },
      {
        name: config.sheets[3] as (typeof sheetNames)[number],
        title: "Informationen",
        columns: [
          "Prozessschritt",
          "Information",
          "Quelle",
          "Typ",
          "Details",
          "Provenienz",
          "Sicherheit",
          "Bestätigt",
          "Nachweise",
          "Annahmen",
        ],
        rows: [
          ...informationFacts.map(([name, fact]) => [
            { value: name, kind: "text" as const },
            {
              value: Array.isArray(fact.value)
                ? lines(fact.value, config.labels.unknown)
                : text(fact.value, config.labels.unknown),
              kind: "text" as const,
            },
            { value: "Globale Angabe", kind: "text" as const },
            { value: "Globale Angabe", kind: "text" as const },
            { value: config.labels.unknown, kind: "text" as const },
            {
              value: config.labels.provenance[fact.provenance],
              kind: "text" as const,
            },
            {
              value: fact.confidence ?? config.labels.unknown,
              kind:
                fact.confidence === null
                  ? ("text" as const)
                  : ("number" as const),
            },
            { value: fact.confirmed ? "Ja" : "Nein", kind: "text" as const },
            { value: evidence(fact.evidenceIds), kind: "text" as const },
            { value: config.labels.unknown, kind: "text" as const },
          ]),
          ...understanding.steps.flatMap((step) =>
            step.informationItems.map((item) => [
              { value: `${step.order}. ${step.name}`, kind: "text" as const },
              { value: item.name, kind: "text" as const },
              {
                value: text(item.source, config.labels.unknown),
                kind: "text" as const,
              },
              {
                value: config.labels.informationTypes[item.type],
                kind: "text" as const,
              },
              {
                value: text(item.typeDetail, config.labels.unknown),
                kind: "text" as const,
              },
              {
                value: config.labels.provenance[step.provenance],
                kind: "text" as const,
              },
              {
                value: step.confidence ?? config.labels.unknown,
                kind:
                  step.confidence === null
                    ? ("text" as const)
                    : ("number" as const),
              },
              { value: step.confirmed ? "Ja" : "Nein", kind: "text" as const },
              { value: evidence(step.evidenceIds), kind: "text" as const },
              {
                value: lines(step.assumptions, config.labels.unknown),
                kind: "text" as const,
              },
            ]),
          ),
        ],
      },
      {
        name: config.sheets[4] as (typeof sheetNames)[number],
        title: "Organisation",
        columns: factColumns,
        rows: [
          ...organizationFacts.map(([name, fact]) =>
            factRow(name, fact, config),
          ),
          ...workCharacteristicRows,
        ],
      },
      {
        name: config.sheets[5] as (typeof sheetNames)[number],
        title: "Offene Punkte",
        columns: ["Art", "Ursprung", "Inhalt"],
        rows: [
          ...understanding.knowledgeGaps.map((value) => [
            { value: "Wissenslücke", kind: "text" as const },
            { value: "Prozessverständnis", kind: "text" as const },
            { value, kind: "text" as const },
          ]),
          ...understanding.conflicts.map((value) => [
            { value: "Widerspruch", kind: "text" as const },
            { value: "Prozessverständnis", kind: "text" as const },
            { value, kind: "text" as const },
          ]),
          ...assumptions,
        ],
      },
      {
        name: config.sheets[6] as (typeof sheetNames)[number],
        title: "Nachweise",
        columns: ["ID", "Art", "Quelle", "Auszug"],
        rows: [
          ...understanding.evidence.map((item) => [
            { value: item.id, kind: "text" as const },
            { value: item.kind, kind: "text" as const },
            { value: item.sourceId, kind: "text" as const },
            { value: item.excerpt, kind: "text" as const },
          ]),
          ...understanding.documentCoverage.map((item) => [
            { value: item.uploadId, kind: "text" as const },
            {
              value: `Unterlagenabdeckung: ${item.status}`,
              kind: "text" as const,
            },
            { value: item.name, kind: "text" as const },
            {
              value: item.limitation ?? config.labels.unknown,
              kind: "text" as const,
            },
          ]),
        ],
      },
    ],
  };
  return pddWorkbookModelSchema.parse(model);
}
