import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, unlink } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { dump, load } from "js-yaml";
import { z } from "zod";
import { unzipSync } from "fflate";
import {
  aiTraceSchema,
  assertExactlyFiveAnswers,
  assertUnderstandingReferences,
  assertWorkCharacteristicAnswers,
  coverSchema,
  followUpAnswerSchema,
  followUpQuestionSchema,
  processCaptureConfigSchema,
  processCaptureRecordSchema,
  processStateSchema,
  processUnderstandingSchema,
  topicAnswerSchema,
  uploadRecordSchema,
  workCharacteristicAnswerSchema,
  type AiTrace,
  type FollowUpQuestion,
  type ProcessCaptureConfig,
  type ProcessCaptureRecord,
  type ProcessUnderstanding,
  type UploadRecord,
  type WorkCharacteristicAnswer,
} from "../../domain/src/process-understanding.ts";
import { atomicWrite } from "./atomic-write.ts";
import { audit } from "./audit-log.ts";

const metadataSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().regex(/^PROC-\d{4}$/),
  state: processStateSchema,
  profile: z.object({
    id: z.literal("compact-v1"),
    version: z.union([z.literal(1), z.literal(2)]),
  }),
  configHash: z.string().regex(/^[a-f0-9]{64}$/),
  confirmedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
const answersFileSchema = z.object({
  mainAnswers: z.array(topicAnswerSchema).max(5),
  workCharacteristicAnswers: z
    .array(workCharacteristicAnswerSchema)
    .max(4)
    .optional(),
  selectedUploadIds: z.array(z.string().uuid()).max(5),
});
const followUpsFileSchema = z.object({
  questions: z.array(followUpQuestionSchema).max(5),
  answers: z.array(followUpAnswerSchema).max(5),
});
const auditEntrySchema = z.object({
  at: z.string().datetime(),
  event: z.string().min(1),
  detail: z.unknown(),
});
const operationEntrySchema = z.object({
  at: z.string().datetime(),
  operationName: z.string().min(1),
  state: z.enum(["completed", "failed", "cancelled"]),
  trace: aiTraceSchema.optional(),
  error: z.string().optional(),
});

const mediaTypes: Record<string, string[]> = {
  ".pdf": ["application/pdf"],
  ".xlsx": [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/zip",
  ],
  ".csv": ["text/csv", "text/plain", "application/vnd.ms-excel"],
  ".docx": [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/zip",
  ],
  ".pptx": [
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/zip",
  ],
  ".txt": ["text/plain"],
  ".md": ["text/markdown", "text/plain"],
  ".png": ["image/png"],
  ".jpg": ["image/jpeg"],
  ".jpeg": ["image/jpeg"],
};

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
export function processConfigHash(config: ProcessCaptureConfig) {
  return createHash("sha256")
    .update(canonical(processCaptureConfigSchema.parse(config)))
    .digest("hex");
}
function safeName(name: string) {
  const safe = basename(name)
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}._-]+/gu, "-")
    .replace(/^[-.]+/, "")
    .slice(0, 180);
  if (!safe) throw new Error("Ungültiger Dateiname.");
  return safe;
}
function normalizeMediaType(value: string) {
  return value.split(";", 1)[0]!.trim().toLowerCase();
}
function hasPrefix(bytes: Uint8Array, prefix: number[]) {
  return prefix.every((value, index) => bytes[index] === value);
}
function validateFileBytes(extension: string, bytes: Uint8Array) {
  if (!bytes.length) throw new Error("Die Datei ist leer.");
  if (extension === ".pdf" && !hasPrefix(bytes, [0x25, 0x50, 0x44, 0x46]))
    throw new Error("Der Dateiinhalt ist kein gültiges PDF.");
  if (
    extension === ".png" &&
    !hasPrefix(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  )
    throw new Error("Der Dateiinhalt ist kein gültiges PNG-Bild.");
  if (
    [".jpg", ".jpeg"].includes(extension) &&
    !hasPrefix(bytes, [0xff, 0xd8, 0xff])
  )
    throw new Error("Der Dateiinhalt ist kein gültiges JPEG-Bild.");
  if ([".docx", ".xlsx", ".pptx"].includes(extension)) {
    let entries: Record<string, Uint8Array>;
    try {
      entries = unzipSync(bytes);
    } catch {
      throw new Error("Die Office-Datei ist beschädigt oder ungültig.");
    }
    const required =
      extension === ".docx"
        ? ["[Content_Types].xml", "word/document.xml"]
        : extension === ".xlsx"
          ? ["[Content_Types].xml", "xl/workbook.xml"]
          : ["[Content_Types].xml", "ppt/presentation.xml"];
    if (required.some((name) => !entries[name]))
      throw new Error("Der Inhalt passt nicht zur angegebenen Office-Datei.");
    if (
      extension === ".pptx" &&
      !Object.keys(entries).some((name) =>
        /^ppt\/slides\/slide\d+\.xml$/.test(name),
      )
    )
      throw new Error(
        "Die Office-Datei enthält keine lesbare Präsentationsfolie.",
      );
  }
  if ([".txt", ".md", ".csv"].includes(extension) && bytes.includes(0))
    throw new Error("Die Textdatei enthält ungültige Binärdaten.");
}
function factsOf(understanding: ProcessUnderstanding) {
  return [
    understanding.purpose,
    understanding.trigger,
    understanding.outcome,
    understanding.boundaries,
    understanding.participants,
    understanding.informationSources,
    understanding.systems,
    understanding.decisions,
    understanding.controls,
    understanding.handoffs,
    understanding.volumeAndTime,
    understanding.painPoints,
    understanding.improvementGoals,
    ...understanding.steps,
  ];
}
function comparableFactValue(fact: ReturnType<typeof factsOf>[number]) {
  if ("value" in fact) return fact.value;
  const value = structuredClone(fact) as Record<string, unknown>;
  delete value.provenance;
  delete value.evidenceIds;
  delete value.confidence;
  delete value.assumptions;
  delete value.confirmed;
  return value;
}

export class ProcessCaptureNotFoundError extends Error {
  constructor() {
    super("Prozess nicht gefunden.");
    this.name = "ProcessCaptureNotFoundError";
  }
}

export class ProcessUploadNotFoundError extends Error {
  constructor() {
    super("Datei nicht gefunden.");
    this.name = "ProcessUploadNotFoundError";
  }
}

export class ProcessUploadIntegrityError extends Error {
  constructor() {
    super("Die gespeicherte Datei konnte nicht sicher gelesen werden.");
    this.name = "ProcessUploadIntegrityError";
  }
}

export class ProcessCaptureRepository {
  constructor(public root: string) {}

  private processRoot() {
    return join(this.root, "process-captures");
  }
  dir(id: string) {
    if (!/^PROC-\d{4}$/.test(id)) throw new Error("Ungültige Prozess-ID.");
    return join(this.processRoot(), id);
  }
  uploadPath(id: string, uploadId: string, name: string) {
    if (!z.string().uuid().safeParse(uploadId).success)
      throw new Error("Ungültige Datei-ID.");
    return join(this.dir(id), "uploads", `${uploadId}-${safeName(name)}`);
  }

  async list() {
    let names: string[];
    try {
      names = await readdir(this.processRoot());
    } catch {
      return [];
    }
    const records = await Promise.all(
      names
        .filter((name) => /^PROC-\d{4}$/.test(name))
        .map((id) => this.get(id)),
    );
    return records
      .filter((record): record is ProcessCaptureRecord => record !== null)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async get(id: string): Promise<ProcessCaptureRecord | null> {
    if (!/^PROC-\d{4}$/.test(id)) return null;
    try {
      const dir = this.dir(id);
      const [
        metadata,
        cover,
        configSnapshot,
        answers,
        followUps,
        understanding,
        uploadNames,
      ] = await Promise.all([
        readFile(join(dir, "metadata.yaml"), "utf8").then((text) =>
          metadataSchema.parse(load(text)),
        ),
        readFile(join(dir, "cover.yaml"), "utf8").then((text) =>
          coverSchema.parse(load(text)),
        ),
        readFile(join(dir, "config-snapshot.json"), "utf8").then((text) =>
          processCaptureConfigSchema.parse(JSON.parse(text)),
        ),
        readFile(join(dir, "answers.json"), "utf8").then((text) =>
          answersFileSchema.parse(JSON.parse(text)),
        ),
        readFile(join(dir, "follow-ups.json"), "utf8").then((text) =>
          followUpsFileSchema.parse(JSON.parse(text)),
        ),
        readFile(join(dir, "process-understanding.json"), "utf8").then((text) =>
          processUnderstandingSchema.nullable().parse(JSON.parse(text)),
        ),
        readdir(join(dir, "uploads")),
      ]);
      if (processConfigHash(configSnapshot) !== metadata.configHash)
        throw new Error("Der Konfigurations-Hash ist ungültig.");
      const uploads = await Promise.all(
        uploadNames
          .filter((name) => name.endsWith(".meta.json"))
          .map((name) =>
            readFile(join(dir, "uploads", name), "utf8").then((text) =>
              uploadRecordSchema.parse(JSON.parse(text)),
            ),
          ),
      );
      const record = processCaptureRecordSchema.parse({
        ...metadata,
        cover,
        configSnapshot,
        ...answers,
        workCharacteristicAnswers: answers.workCharacteristicAnswers ?? [],
        followUps: followUps.questions,
        followUpAnswers: followUps.answers,
        understanding,
        uploads,
      });
      if (record.understanding)
        assertUnderstandingReferences(record, record.understanding, {
          allowHumanCorrections: true,
        });
      return record;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async required(id: string) {
    const record = await this.get(id);
    if (!record) throw new ProcessCaptureNotFoundError();
    return record;
  }

  async create(coverInput: unknown, configInput: unknown) {
    const cover = coverSchema.parse(coverInput);
    const config = processCaptureConfigSchema.parse(configInput);
    if (config.profile.version !== 2)
      throw new Error(
        "Neue Prozessaufnahmen benötigen die aktuelle Profilversion.",
      );
    const [activeNames, historicalNames] = await Promise.all([
      readdir(this.processRoot()).catch(() => []),
      readdir(join(this.root, "trash", "process-captures")).catch(() => []),
    ]);
    const usedNumbers = [...activeNames, ...historicalNames]
      .map((name) => /^PROC-(\d{4})(?:$|-)/.exec(name)?.[1])
      .filter((value): value is string => Boolean(value))
      .map(Number);
    const next = Math.max(0, ...usedNumbers) + 1;
    if (next > 9_999) throw new Error("Der Prozessnummernbereich ist voll.");
    const id = `PROC-${String(next).padStart(4, "0")}`;
    const now = new Date().toISOString();
    const record = processCaptureRecordSchema.parse({
      schemaVersion: 1,
      id,
      state: "capture_in_progress",
      profile: config.profile,
      configHash: processConfigHash(config),
      cover,
      configSnapshot: config,
      mainAnswers: [],
      workCharacteristicAnswers: [],
      followUps: [],
      followUpAnswers: [],
      selectedUploadIds: [],
      understanding: null,
      uploads: [],
      confirmedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    await mkdir(join(this.dir(id), "uploads"), { recursive: true });
    await this.writeRecord(record);
    await atomicWrite(join(this.dir(id), "operations.jsonl"), "");
    await audit(join(this.dir(id), "history.jsonl"), "process-created", {
      profile: record.profile,
      configHash: record.configHash,
    });
    return record;
  }

  async saveMainAnswers(
    id: string,
    input: unknown,
    workCharacteristicInput: unknown,
    selectedUploadIds: string[],
  ) {
    const record = await this.required(id);
    if (record.state !== "capture_in_progress")
      throw new Error(
        "Die Hauptantworten können in diesem Status nicht geändert werden.",
      );
    const answers = assertExactlyFiveAnswers(input as never[]);
    const workCharacteristicAnswers = assertWorkCharacteristicAnswers(
      record.configSnapshot,
      workCharacteristicInput,
    );
    this.assertSelectedUploads(record, selectedUploadIds);
    await this.writeJson(id, "answers.json", {
      mainAnswers: answers,
      workCharacteristicAnswers,
      selectedUploadIds,
    });
    await this.touch(record);
    await audit(join(this.dir(id), "history.jsonl"), "main-answers-saved", {
      answers,
      workCharacteristicAnswers,
      selectedUploadIds,
    });
    return this.required(id);
  }

  async saveFollowUps(
    id: string,
    questionsInput: FollowUpQuestion[],
    trace: AiTrace,
  ) {
    const record = await this.required(id);
    if (
      record.state !== "capture_in_progress" ||
      record.mainAnswers.length !== 5
    )
      throw new Error(
        "Die Rückfragen können in diesem Status nicht gespeichert werden.",
      );
    const questions = z
      .array(followUpQuestionSchema)
      .max(5)
      .parse(questionsInput);
    if (
      new Set(questions.map((question) => question.topicId)).size !==
      questions.length
    )
      throw new Error(
        "Pro Themenbereich ist höchstens eine Rückfrage zulässig.",
      );
    await this.writeJson(id, "follow-ups.json", { questions, answers: [] });
    await this.touch(
      record,
      questions.length ? "follow_up_required" : "synthesis_ready",
    );
    await this.recordAiOperation(id, "process-follow-ups", "completed", trace);
    await audit(join(this.dir(id), "history.jsonl"), "follow-ups-generated", {
      questions,
      trace,
    });
    return this.required(id);
  }

  async saveFollowUpAnswers(id: string, input: unknown) {
    const record = await this.required(id);
    if (record.state !== "follow_up_required")
      throw new Error("Es sind keine Rückfragen zu beantworten.");
    const answers = z
      .array(followUpAnswerSchema)
      .length(record.followUps.length)
      .parse(input);
    const expected = new Map(
      record.followUps.map((question) => [question.id, question.topicId]),
    );
    if (
      answers.some(
        (answer) => expected.get(answer.questionId) !== answer.topicId,
      ) ||
      new Set(answers.map((answer) => answer.questionId)).size !==
        answers.length
    )
      throw new Error("Bitte beantworten Sie jede Rückfrage genau einmal.");
    await this.writeJson(id, "follow-ups.json", {
      questions: record.followUps,
      answers,
    });
    await this.touch(record, "synthesis_ready");
    await audit(join(this.dir(id), "history.jsonl"), "follow-ups-answered", {
      answers,
    });
    return this.required(id);
  }

  async saveUnderstanding(
    id: string,
    input: ProcessUnderstanding,
    trace: AiTrace,
  ) {
    const record = await this.required(id);
    if (record.state !== "synthesis_ready")
      throw new Error(
        "Das Prozessbild kann in diesem Status nicht gespeichert werden.",
      );
    const understanding = assertUnderstandingReferences(
      record,
      processUnderstandingSchema.parse(input),
    );
    await this.writeJson(id, "process-understanding.json", understanding);
    await this.touch(record, "review_required");
    await this.recordAiOperation(id, "process-synthesis", "completed", trace);
    await audit(
      join(this.dir(id), "history.jsonl"),
      "understanding-synthesized",
      { trace, steps: understanding.steps.length },
    );
    return this.required(id);
  }

  async correctUnderstanding(id: string, input: unknown, note: string) {
    const record = await this.required(id);
    if (
      !record.understanding ||
      !["review_required", "confirmed"].includes(record.state)
    )
      throw new Error("Es liegt kein bearbeitbares Prozessbild vor.");
    const next = processUnderstandingSchema.parse(input);
    const previousHumanEvidenceIds = new Set(
      record.understanding.evidence
        .filter((item) => item.kind === "human_correction")
        .map((item) => item.id),
    );
    if (
      next.evidence.some(
        (item) =>
          item.kind === "human_correction" &&
          !previousHumanEvidenceIds.has(item.id),
      )
    )
      throw new Error(
        "Korrektur-Evidenz wird ausschließlich vom System aufgezeichnet.",
      );
    assertUnderstandingReferences(record, next, {
      allowHumanCorrections: true,
    });
    const correctionId = crypto.randomUUID();
    const previousFacts = factsOf(record.understanding);
    const nextFacts = factsOf(next);
    nextFacts.forEach((fact, index) => {
      const previous = previousFacts[index];
      if (
        previous &&
        JSON.stringify(comparableFactValue(previous)) !==
          JSON.stringify(comparableFactValue(fact))
      ) {
        fact.provenance = "user_confirmed";
        fact.confirmed = true;
        fact.confidence = null;
        fact.assumptions = [];
        fact.evidenceIds = [...new Set([...fact.evidenceIds, correctionId])];
      }
    });
    next.evidence.push({
      id: correctionId,
      kind: "human_correction",
      sourceId: correctionId,
      excerpt: note,
    });
    const value = processUnderstandingSchema.parse(next);
    assertUnderstandingReferences(record, value, {
      allowHumanCorrections: true,
    });
    await this.writeJson(id, "process-understanding.json", value);
    await this.touch(record, "review_required", null);
    await audit(
      join(this.dir(id), "history.jsonl"),
      "understanding-corrected",
      { note, previous: record.understanding, next: value },
    );
    return this.required(id);
  }

  async correctWorkCharacteristics(
    id: string,
    input: WorkCharacteristicAnswer[],
    reason: string,
  ) {
    const record = await this.required(id);
    if (
      record.profile.version !== 2 ||
      !["review_required", "confirmed"].includes(record.state)
    )
      throw new Error("Die Arbeitsmerkmale können hier nicht geändert werden.");
    const note = z.string().trim().min(1).max(2_000).parse(reason);
    const answers = assertWorkCharacteristicAnswers(
      record.configSnapshot,
      input,
    );
    await this.writeJson(id, "answers.json", {
      mainAnswers: record.mainAnswers,
      workCharacteristicAnswers: answers,
      selectedUploadIds: record.selectedUploadIds,
    });
    await this.touch(record, "review_required", null);
    await audit(
      join(this.dir(id), "history.jsonl"),
      "work-characteristics-corrected",
      {
        reason: note,
        previous: record.workCharacteristicAnswers,
        next: answers,
      },
    );
    return this.required(id);
  }

  async confirm(id: string) {
    const record = await this.required(id);
    if (record.state !== "review_required" || !record.understanding)
      throw new Error("Bitte prüfen Sie zuerst das Prozessbild.");
    const now = new Date().toISOString();
    await this.writeMetadata({
      ...record,
      state: "confirmed",
      confirmedAt: now,
      updatedAt: now,
    });
    await audit(
      join(this.dir(id), "history.jsonl"),
      "understanding-confirmed",
      { confirmedAt: now },
    );
    return this.required(id);
  }

  async saveUpload(id: string, file: File) {
    const record = await this.required(id);
    if (record.state !== "capture_in_progress")
      throw new Error("Dateien können nur vor der Analyse hochgeladen werden.");
    if (record.uploads.length >= record.configSnapshot.uploads.maxFiles)
      throw new Error("Es können höchstens fünf Dateien hochgeladen werden.");
    if (
      file.size <= 0 ||
      file.size > record.configSnapshot.uploads.maxFileBytes
    )
      throw new Error("Die Datei darf höchstens 20 MB groß sein.");
    const total =
      record.uploads.reduce((sum, upload) => sum + upload.size, 0) + file.size;
    if (total > record.configSnapshot.uploads.maxProcessBytes)
      throw new Error("Die Dateien überschreiten zusammen 100 MB.");
    const name = safeName(file.name);
    const extension = extname(name).toLowerCase();
    if (
      !(
        record.configSnapshot.uploads.allowedExtensions as readonly string[]
      ).includes(extension)
    )
      throw new Error("Dieser Dateityp wird nicht unterstützt.");
    const mediaType = normalizeMediaType(
      file.type || "application/octet-stream",
    );
    if (!mediaTypes[extension]?.includes(mediaType))
      throw new Error("Dateiendung und Medientyp passen nicht zusammen.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    validateFileBytes(extension, bytes);
    const upload: UploadRecord = uploadRecordSchema.parse({
      id: crypto.randomUUID(),
      name,
      mediaType,
      size: bytes.byteLength,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      uploadedAt: new Date().toISOString(),
    });
    await atomicWrite(this.uploadPath(id, upload.id, upload.name), bytes);
    await this.writeJson(id, join("uploads", `${upload.id}.meta.json`), upload);
    await audit(join(this.dir(id), "history.jsonl"), "file-uploaded", upload);
    return upload;
  }

  async readUpload(id: string, uploadId: string) {
    const record = await this.required(id);
    const upload = record.uploads.find((item) => item.id === uploadId);
    if (!upload) throw new ProcessUploadNotFoundError();
    let bytes: Uint8Array;
    try {
      bytes = await readFile(
        this.uploadPath(record.id, upload.id, upload.name),
      );
    } catch {
      throw new ProcessUploadIntegrityError();
    }
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    if (bytes.byteLength !== upload.size || sha256 !== upload.sha256)
      throw new ProcessUploadIntegrityError();
    return { upload, bytes };
  }

  async removeUpload(id: string, uploadId: string) {
    const record = await this.required(id);
    if (record.state !== "capture_in_progress")
      throw new Error("Dateien können nach der Analyse nicht entfernt werden.");
    const upload = record.uploads.find((item) => item.id === uploadId);
    if (!upload) throw new Error("Datei nicht gefunden.");
    await Promise.all([
      unlink(this.uploadPath(id, upload.id, upload.name)),
      unlink(join(this.dir(id), "uploads", `${upload.id}.meta.json`)),
    ]);
    if (record.selectedUploadIds.includes(uploadId))
      await this.writeJson(id, "answers.json", {
        mainAnswers: record.mainAnswers,
        workCharacteristicAnswers: record.workCharacteristicAnswers,
        selectedUploadIds: record.selectedUploadIds.filter(
          (selectedId) => selectedId !== uploadId,
        ),
      });
    await this.touch(record);
    await audit(join(this.dir(id), "history.jsonl"), "file-removed", upload);
  }

  async recordAiOperation(
    id: string,
    operationName: string,
    state: "completed" | "failed" | "cancelled",
    trace?: AiTrace,
    error?: string,
  ) {
    const entry = operationEntrySchema.parse({
      at: new Date().toISOString(),
      operationName,
      state,
      trace,
      error,
    });
    await audit(join(this.dir(id), "operations.jsonl"), operationName, entry);
  }

  async history(id: string) {
    await this.required(id);
    return (await readFile(join(this.dir(id), "history.jsonl"), "utf8"))
      .split("\n")
      .filter(Boolean)
      .map((line) => auditEntrySchema.parse(JSON.parse(line)))
      .reverse();
  }

  async deleteCapture(id: string, active = false) {
    await this.required(id);
    if (active)
      throw new Error("Bitte warten Sie, bis die KI-Aktion abgeschlossen ist.");
    await rm(this.dir(id), { recursive: true });
    return { id, deleted: true as const };
  }

  private assertSelectedUploads(record: ProcessCaptureRecord, ids: string[]) {
    if (
      new Set(ids).size !== ids.length ||
      ids.length > 5 ||
      ids.some((id) => !record.uploads.some((upload) => upload.id === id))
    )
      throw new Error(
        "Mindestens eine ausgewählte Datei gehört nicht zu diesem Prozess.",
      );
  }
  private async touch(
    record: ProcessCaptureRecord,
    state = record.state,
    confirmedAt = record.confirmedAt,
  ) {
    await this.writeMetadata({
      ...record,
      state,
      confirmedAt,
      updatedAt: new Date().toISOString(),
    });
  }
  private async writeRecord(record: ProcessCaptureRecord) {
    await Promise.all([
      this.writeMetadata(record),
      atomicWrite(
        join(this.dir(record.id), "cover.yaml"),
        dump(record.cover, { lineWidth: 140, noRefs: true }),
      ),
      this.writeJson(record.id, "config-snapshot.json", record.configSnapshot),
      this.writeJson(record.id, "answers.json", {
        mainAnswers: record.mainAnswers,
        workCharacteristicAnswers: record.workCharacteristicAnswers,
        selectedUploadIds: record.selectedUploadIds,
      }),
      this.writeJson(record.id, "follow-ups.json", {
        questions: record.followUps,
        answers: record.followUpAnswers,
      }),
      this.writeJson(
        record.id,
        "process-understanding.json",
        record.understanding,
      ),
    ]);
  }
  private async writeMetadata(
    record: Pick<
      ProcessCaptureRecord,
      | "schemaVersion"
      | "id"
      | "state"
      | "profile"
      | "configHash"
      | "confirmedAt"
      | "createdAt"
      | "updatedAt"
    >,
  ) {
    const value = metadataSchema.parse(record);
    await atomicWrite(
      join(this.dir(value.id), "metadata.yaml"),
      dump(value, { lineWidth: 140, noRefs: true }),
    );
  }
  private async writeJson(id: string, name: string, value: unknown) {
    await atomicWrite(
      join(this.dir(id), name),
      JSON.stringify(value, null, 2) + "\n",
    );
  }
}
