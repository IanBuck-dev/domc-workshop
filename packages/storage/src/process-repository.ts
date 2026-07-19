import { appendFile, mkdir, readFile, readdir, stat } from "node:fs/promises";
import { basename, join } from "node:path";
import { dump, load } from "js-yaml";
import {
  processExtractionSchema,
  processMetadataSchema,
  processRecordSchema,
  transcriptTurnSchema,
  type DiscoveryTurn,
  type ProcessExtraction,
  type ProcessMetadata,
  type ProcessRecord,
  type TranscriptTurn,
  type Workshop,
} from "../../domain/src/schemas.ts";
import { atomicWrite } from "./atomic-write.ts";
import { audit } from "./audit-log.ts";

const opening =
  "Willkommen zur Prozessaufnahme. Wir starten ganz praktisch: Welche Aufgabe kostet Sie im Arbeitsalltag besonders viel Zeit oder Nerven?";

export class ProcessRepository {
  constructor(public root: string) {}

  dir(id: string) {
    if (!/^PROC-\d{4}$/.test(id)) throw new Error("Ungültige Prozess-ID");
    return join(this.root, "processes", id);
  }

  async list() {
    let names: string[] = [];
    try {
      names = await readdir(join(this.root, "processes"));
    } catch {
      return [];
    }
    return (
      await Promise.all(
        names
          .filter((name) => /^PROC-\d{4}$/.test(name))
          .map((id) => this.get(id)),
      )
    )
      .filter((value): value is ProcessRecord => value !== null)
      .sort((a, b) => b.metadata.updatedAt.localeCompare(a.metadata.updatedAt));
  }

  async get(id: string): Promise<ProcessRecord | null> {
    try {
      const dir = this.dir(id);
      const [metadataText, extractionText, pdd, transcriptText, uploadNames] =
        await Promise.all([
          readFile(join(dir, "metadata.yaml"), "utf8"),
          readFile(join(dir, "extraction.yaml"), "utf8"),
          readFile(join(dir, "pdd.md"), "utf8"),
          readFile(join(dir, "transcript.jsonl"), "utf8"),
          readdir(join(dir, "uploads")),
        ]);
      const transcript = transcriptText
        .split("\n")
        .filter(Boolean)
        .map((line) => transcriptTurnSchema.parse(JSON.parse(line)));
      const uploads = await Promise.all(
        uploadNames.map(async (name) => ({
          name,
          size: (await stat(join(dir, "uploads", name))).size,
        })),
      );
      return processRecordSchema.parse({
        metadata: processMetadataSchema.parse(load(metadataText)),
        extraction: processExtractionSchema.parse(load(extractionText)),
        transcript,
        pdd,
        uploads,
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async create(workshop: Workshop, department = "Noch offen") {
    const all = await this.list();
    const next =
      Math.max(0, ...all.map((item) => Number(item.metadata.id.slice(5)))) + 1;
    const id = `PROC-${String(next).padStart(4, "0")}`;
    const now = new Date().toISOString();
    const metadata: ProcessMetadata = {
      schemaVersion: 1,
      id,
      state: "Interview läuft",
      department: department.trim() || "Noch offen",
      sessionId: crypto.randomUUID(),
      sessionStarted: false,
      model: workshop.discovery.model,
      modelDisplay: workshop.discovery.modelDisplay,
      effort: workshop.discovery.effort,
      interviewComplete: false,
      createdAt: now,
      updatedAt: now,
    };
    const extraction: ProcessExtraction = {
      schemaVersion: 1,
      processName: "Unbenannter Prozess",
      department: metadata.department,
      contact: "Nicht angegeben",
      trigger: "Noch offen",
      frequency: "Noch offen",
      volume: "Noch offen",
      systems: [],
      documents: [],
      painPoints: [],
      steps: [],
      criteriaAssessment: workshop.discovery.criteria.map((criterion) => ({
        criterionId: criterion.id,
        question: criterion.question,
        answer: "unklar",
        evidence: [],
        confidence: 0,
      })),
      openQuestions: [],
    };
    const dir = this.dir(id);
    await mkdir(join(dir, "uploads"), { recursive: true });
    await Promise.all([
      this.writeMetadata(metadata),
      this.writeExtraction(id, extraction),
      atomicWrite(join(dir, "pdd.md"), ""),
      atomicWrite(
        join(dir, "transcript.jsonl"),
        JSON.stringify({ role: "assistant", text: opening, timestamp: now }) +
          "\n",
      ),
    ]);
    await audit(join(dir, "history.jsonl"), "process-created", {
      department: metadata.department,
      model: metadata.model,
      effort: metadata.effort,
    });
    return (await this.get(id))!;
  }

  private async writeMetadata(metadata: ProcessMetadata) {
    const value = processMetadataSchema.parse(metadata);
    await atomicWrite(
      join(this.dir(value.id), "metadata.yaml"),
      dump(value, { lineWidth: 140, noRefs: true }),
    );
  }

  private async writeExtraction(id: string, extraction: ProcessExtraction) {
    await atomicWrite(
      join(this.dir(id), "extraction.yaml"),
      dump(processExtractionSchema.parse(extraction), {
        lineWidth: 140,
        noRefs: true,
      }),
    );
  }

  async persistTurn(
    id: string,
    userText: string,
    assistantText: string,
    result: DiscoveryTurn,
  ) {
    const record = await this.get(id);
    if (!record) throw new Error("Prozess nicht gefunden");
    const extraction = processExtractionSchema.parse({
      ...record.extraction,
      ...result.extractionDelta,
      schemaVersion: 1,
      openQuestions: result.openPoints,
    });
    const now = new Date().toISOString();
    const turns: TranscriptTurn[] = [
      { role: "user", text: userText, timestamp: now },
      { role: "assistant", text: assistantText, timestamp: now },
    ];
    await this.writeExtraction(id, extraction);
    await appendFile(
      join(this.dir(id), "transcript.jsonl"),
      turns
        .map((turn) => JSON.stringify(transcriptTurnSchema.parse(turn)))
        .join("\n") + "\n",
      "utf8",
    );
    const metadata = processMetadataSchema.parse({
      ...record.metadata,
      department: extraction.department,
      sessionStarted: true,
      interviewComplete: result.interviewComplete,
      updatedAt: now,
    });
    await this.writeMetadata(metadata);
    await audit(join(this.dir(id), "history.jsonl"), "discovery-turn", {
      criteriaCoverage: result.criteriaCoverage,
      interviewComplete: result.interviewComplete,
    });
    return (await this.get(id))!;
  }

  async updateDepartment(id: string, department: string) {
    const record = await this.get(id);
    if (!record) throw new Error("Prozess nicht gefunden");
    const next = department.trim();
    if (!next) throw new Error("Bitte wählen Sie einen Fachbereich aus.");
    if (next.length > 120) throw new Error("Der Fachbereich ist zu lang.");
    const now = new Date().toISOString();
    await this.writeExtraction(id, {
      ...record.extraction,
      department: next,
    });
    await this.writeMetadata({
      ...record.metadata,
      department: next,
      updatedAt: now,
    });
    await audit(join(this.dir(id), "history.jsonl"), "department-updated", {
      previous: record.extraction.department,
      next,
    });
    return (await this.get(id))!;
  }

  async finish(id: string) {
    const record = await this.get(id);
    if (!record) throw new Error("Prozess nicht gefunden");
    if (record.metadata.state !== "Interview läuft")
      throw new Error("Dieses Interview ist bereits abgeschlossen.");
    if (!record.metadata.interviewComplete)
      throw new Error("Das Interview enthält noch offene Punkte.");
    const metadata = {
      ...record.metadata,
      state: "Interview abgeschlossen" as const,
      updatedAt: new Date().toISOString(),
    };
    await this.writeMetadata(metadata);
    await audit(join(this.dir(id), "history.jsonl"), "interview-finished", {});
    return (await this.get(id))!;
  }

  async savePdd(id: string, markdown: string, manual = false, changeNote = "") {
    const record = await this.get(id);
    if (!record) throw new Error("Prozess nicht gefunden");
    if (!markdown.trim()) throw new Error("Das PDD darf nicht leer sein.");
    await atomicWrite(join(this.dir(id), "pdd.md"), markdown.trim() + "\n");
    await this.writeMetadata({
      ...record.metadata,
      state: manual ? "Geprüft" : "PDD erstellt",
      updatedAt: new Date().toISOString(),
    });
    await audit(
      join(this.dir(id), "history.jsonl"),
      manual ? "pdd-reviewed" : "pdd-generated",
      { characters: markdown.length, ...(manual ? { changeNote } : {}) },
    );
    return (await this.get(id))!;
  }

  async saveUpload(id: string, originalName: string, bytes: Uint8Array) {
    const record = await this.get(id);
    if (!record) throw new Error("Prozess nicht gefunden");
    const name = basename(originalName)
      .normalize("NFKD")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+/, "")
      .slice(0, 120);
    if (!name) throw new Error("Ungültiger Dateiname");
    await atomicWrite(join(this.dir(id), "uploads", name), bytes);
    await audit(join(this.dir(id), "history.jsonl"), "file-uploaded", {
      name,
      size: bytes.byteLength,
    });
    return name;
  }

  async history(id: string) {
    try {
      return (await readFile(join(this.dir(id), "history.jsonl"), "utf8"))
        .split("\n")
        .filter(Boolean)
        .map(
          (line) =>
            JSON.parse(line) as { at: string; event: string; detail: unknown },
        )
        .reverse();
    } catch {
      return [];
    }
  }
}
