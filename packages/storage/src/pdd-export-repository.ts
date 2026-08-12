import { createHash } from "node:crypto";
import { access, mkdir, readFile, rm } from "node:fs/promises";
import { resolve, join } from "node:path";
import { z } from "zod";
import {
  pddSourceRevision,
  pddExportAuditDetailSchema,
  pddExportConfigSchema,
  safePddFilename,
  type PddExportAuditDetail,
} from "../../domain/src/pdd-export.ts";
import {
  processCaptureRecordSchema,
  type ProcessCaptureRecord,
} from "../../domain/src/process-understanding.ts";
import { atomicWrite } from "./atomic-write.ts";
import { ProcessCaptureRepository } from "./process-capture-repository.ts";
import { patchPddCurrentStateTemplate } from "./pdd-workbook.ts";

export class PddExportRepository {
  constructor(
    public root: string,
    private defaultsRoot?: string,
  ) {}

  async config() {
    const root =
      this.defaultsRoot ??
      process.env.CLAIMS_AI_DEFAULTS_DIR ??
      resolve(process.cwd(), "defaults");
    const file = Bun.file(join(root, "pdd-export-config.json"));
    if (!(await file.exists()))
      throw new Error("Die PDD-Exportvorlage ist nicht verfügbar.");
    try {
      return pddExportConfigSchema.parse(await file.json());
    } catch {
      throw new Error("Die PDD-Exportvorlage ist ungültig.");
    }
  }

  async export(
    input: ProcessCaptureRecord,
    options: {
      exportedAt?: string;
      exportId?: string;
      initiatedBy?: string;
    } = {},
  ): Promise<{ detail: PddExportAuditDetail; bytes: Uint8Array }> {
    const record = processCaptureRecordSchema.parse(input);
    if (
      record.state !== "confirmed" ||
      !record.understanding ||
      !record.confirmedAt
    )
      throw new Error("Bitte bestätigen Sie zuerst das Prozessbild.");
    const [config, exportedAt] = await Promise.all([
      this.config(),
      Promise.resolve(
        z
          .string()
          .datetime()
          .parse(options.exportedAt ?? new Date().toISOString()),
      ),
    ]);
    const exportId = z
      .string()
      .uuid()
      .parse(options.exportId ?? crypto.randomUUID());
    if (!config.enabled)
      throw new Error("Der PDD-Export ist derzeit nicht verfügbar.");
    if (
      config.schemaVersion !== 2 ||
      record.profile.version !== 3 ||
      !record.currentStateDetails
    )
      throw new Error(
        "Diese Prozessaufnahme enthält noch nicht die erforderliche PDD-Definition.",
      );
    const details = record.currentStateDetails;
    const unknown = (item: {
      state?: string;
      value: unknown;
      reason?: string | null;
    }) =>
      item.state === undefined
        ? item.value === null
          ? "Nicht bekannt: Angabe offen"
          : String(item.value)
        : item.state === "known"
          ? String(item.value)
          : `Nicht bekannt: ${item.reason ?? "Angabe offen"}`;
    const scope =
      "Nicht Bestandteil dieser Ausbaustufe – Fokus auf Ist-Zustand.";
    const mapping = config.mapping as {
      cover: Record<string, string>;
      definition: Record<string, string>;
      stepRows: number[];
    };
    const owner = unknown(details.processOwner);
    const values: Record<string, Record<string, string>> = {
      Deckblatt: {
        B5: record.cover.processName,
        B6: record.id,
        B7: "Prozessdokumentation – Ist-Zustand",
        B8: `${config.template.version} / ${pddSourceRevision(record).slice(0, 12)}`,
        B9: exportedAt.slice(0, 10),
        B10: record.cover.participantName,
        B11:
          details.processOwner.state === "known"
            ? details.processOwner.value!.department
            : owner,
        B12: scope,
        B13:
          record.confirmationQuality === "complete"
            ? "Fachlich bestätigt"
            : "Mit offenen Punkten bestätigt",
        B14: scope,
        B15:
          details.confidentiality.state === "known"
            ? {
                internal: "Intern",
                confidential: "Vertraulich",
                strictly_confidential: "Streng vertraulich",
              }[details.confidentiality.value!]
            : unknown(details.confidentiality),
      },
      "01_Prozessdefinition": {},
      "02_Prozessschritte": { B18: scope },
    };
    const understanding = record.understanding!;
    const joined = (values: string[] | null) =>
      values?.join("\n") || "Nicht bekannt: Angabe offen";
    Object.assign(values["01_Prozessdefinition"], {
      B6: record.cover.processName,
      G6:
        details.processOwner.state === "known"
          ? `${details.processOwner.value!.role} — ${details.processOwner.value!.department}`
          : owner,
      K6: `${record.confirmedAt!.slice(0, 10)} / ${pddSourceRevision(record).slice(0, 12)}`,
      B7: unknown(details.currentStateSummary),
      K7: understanding.steps
        .flatMap((step) => step.actors ?? [])
        .map((actor) => `${actor.name} (${actor.involvement})`)
        .filter((value, index, list) => list.indexOf(value) === index)
        .join("\n"),
      B8:
        details.painPoints.state === "known"
          ? details.painPoints
              .value!.slice(0, 3)
              .map((item) => item.description)
              .join("\n")
          : unknown(details.painPoints),
      K8: scope,
      B9: unknown(understanding.outcome),
      K9: unknown(understanding.boundaries),
      B12: unknown(understanding.trigger),
      G12: unknown(understanding.outcome),
      K12: joined(understanding.volumeAndTime.value),
      B13: joined(understanding.informationSources.value),
      G13: [
        ...new Set([
          ...understanding.steps.flatMap((step) => step.outputs),
          understanding.outcome.value ?? "",
        ]),
      ]
        .filter(Boolean)
        .join("\n"),
      K13:
        details.variations.state === "known"
          ? details.variations
              .value!.map((item) => `${item.name}: ${item.trigger}`)
              .join("\n")
          : unknown(details.variations),
      B14: understanding.steps
        .flatMap((step) => step.actors ?? [])
        .map((actor) => `${actor.name} (${actor.involvement})`)
        .filter((value, index, list) => list.indexOf(value) === index)
        .join("\n"),
      G14:
        details.systems.state === "known"
          ? details.systems
              .value!.filter((system) =>
                understanding.steps.some((step) =>
                  step.systemRefs?.includes(system.id),
                ),
              )
              .map((system) => system.name)
              .join("\n")
          : unknown(details.systems),
      K14: "Nicht bekannt: Medienbrüche nicht vollständig erfasst",
      B17: scope,
      K17: scope,
      B18:
        details.painPoints.state === "known"
          ? details.painPoints
              .value!.slice(0, 3)
              .map((item) => item.description)
              .join("\n")
          : unknown(details.painPoints),
      K18: scope,
      B21:
        details.systems.state === "known"
          ? details.systems.value!.map((item) => item.name).join("\n")
          : unknown(details.systems),
      G21: "Nicht bekannt: Übergaben nicht vollständig erfasst",
      K21: unknown(details.operationalContext.operationAndSupport),
      B22: unknown(details.operationalContext.accessAndProtection),
      G22: unknown(details.operationalContext.monitoringAndTraceability),
      K22: unknown(details.operationalContext.constraintsAndOpenQuestions),
    });
    understanding.steps.forEach((step, index) => {
      const row = mapping.stepRows[index]!;
      values["02_Prozessschritte"]![`A${row}`] = String(step.order);
      values["02_Prozessschritte"]![`B${row}`] =
        `${step.name}\n${step.activity}`;
      values["02_Prozessschritte"]![`C${row}`] = [
        ...(step.actors ?? []).map(
          (actor) => `${actor.name} (${actor.involvement})`,
        ),
        ...(details.systems.value ?? [])
          .filter((system) => step.systemRefs?.includes(system.id))
          .map((system) => system.name),
      ].join("\n");
      values["02_Prozessschritte"]![`D${row}`] = [
        ...step.inputs,
        ...step.informationItems.map((item) => item.name),
      ].join("\n");
      values["02_Prozessschritte"]![`E${row}`] = step.outputs.join("\n");
      values["02_Prozessschritte"]![`F${row}`] =
        "Nicht bekannt: Pain Points nicht vollständig zugeordnet";
      values["02_Prozessschritte"]![`G${row}`] = scope;
      values["02_Prozessschritte"]![`H${row}`] = step.decisions?.some(
        (item) => item.humanInvolvement === "yes",
      )
        ? "Ja"
        : step.decisions?.some((item) => item.humanInvolvement === "partial")
          ? "Teilweise"
          : step.decisions?.some((item) => item.humanInvolvement === "no")
            ? "Nein"
            : "Offen";
      values["02_Prozessschritte"]![`I${row}`] = (
        step.exceptionRefs ?? []
      ).join("\n");
    });
    for (const row of mapping.stepRows.slice(understanding.steps.length))
      for (const column of "ABCDEFGHI")
        values["02_Prozessschritte"]![`${column}${row}`] = "";
    const template = new Uint8Array(
      await readFile(
        join(
          this.defaultsRoot ??
            process.env.CLAIMS_AI_DEFAULTS_DIR ??
            resolve(process.cwd(), "defaults"),
          config.template.asset!,
        ),
      ),
    );
    const bytes = patchPddCurrentStateTemplate(
      template,
      config.template.sha256!,
      config.sheets,
      values,
    );
    const model = { sourceRevision: pddSourceRevision(record) };
    const filename = safePddFilename({
      prefix: config.filenamePrefix,
      processId: record.id,
      confirmedAt: record.confirmedAt,
      sourceRevision: model.sourceRevision,
      exportId,
    });
    const detail = pddExportAuditDetailSchema.parse({
      exportId,
      filename,
      byteSize: bytes.byteLength,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      sourceRevision: model.sourceRevision,
      confirmedAt: record.confirmedAt,
      exportedAt,
      initiatedBy: z
        .string()
        .trim()
        .min(1)
        .max(100)
        .parse(options.initiatedBy ?? "system"),
      template: config.template,
    });
    const directory = join(this.root, "process-captures", record.id, "exports");
    const path = join(directory, filename);
    await mkdir(directory, { recursive: true });
    try {
      await access(path);
      throw new Error(
        "Eine PDD-Arbeitsmappe mit dieser Kennung existiert bereits.",
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    try {
      await atomicWrite(path, bytes);
      await new ProcessCaptureRepository(this.root).appendHistory(
        record.id,
        "pdd-exported",
        detail,
      );
    } catch (error) {
      await rm(path, { force: true });
      throw error;
    }
    return { detail, bytes };
  }
}
