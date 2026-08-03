import { afterEach, describe, expect, test } from "bun:test";
import {
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ProcessCaptureRepository } from "../packages/storage/src/process-capture-repository.ts";
import {
  insertProcessStep,
  moveProcessStep,
  removeProcessStep,
} from "../packages/domain/src/process-understanding-editing.ts";
import {
  answers,
  cover,
  legacyUnderstanding,
  processConfig,
  understanding,
  validationInputSnapshot,
  workCharacteristicAnswers,
} from "./process-fixtures.ts";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "process-storage-"));
  roots.push(root);
  return {
    root,
    repo: new ProcessCaptureRepository(root),
    config: await processConfig(),
  };
}
const trace = () => ({
  operationId: crypto.randomUUID(),
  sessionId: crypto.randomUUID(),
  model: "claude-opus-4-8",
  durationMs: 10,
  inputTokens: 2,
  outputTokens: 4,
  sandboxed: true,
});

describe("process capture repository", () => {
  test("creates only canonical files and never scans legacy roots", async () => {
    const { root, repo, config } = await fixture();
    await writeFile(join(root, "legacy-marker"), "unchanged");
    const record = await repo.create(cover, config);
    expect(record.id).toBe("PROC-0001");
    expect(record.state).toBe("capture_in_progress");
    expect((await readdir(repo.dir(record.id))).sort()).toEqual([
      "answers.json",
      "config-snapshot.json",
      "cover.yaml",
      "follow-ups.json",
      "history.jsonl",
      "metadata.yaml",
      "operations.jsonl",
      "process-understanding.json",
      "uploads",
    ]);
    expect(await readFile(join(root, "legacy-marker"), "utf8")).toBe(
      "unchanged",
    );
    expect((await repo.list()).map((item) => item.id)).toEqual([record.id]);
    const metadataPath = join(repo.dir(record.id), "metadata.yaml");
    const legacyMetadata = (await readFile(metadataPath, "utf8"))
      .replace(/^interactionMode:.*\n/m, "")
      .replace(/^confirmationQuality:.*\n/m, "");
    await writeFile(metadataPath, legacyMetadata);
    expect(
      (await new ProcessCaptureRepository(root).required(record.id))
        .interactionMode,
    ).toBe("form");
  });

  test("persists bounded followups, synthesis, correction, and confirmation", async () => {
    const { repo, config } = await fixture();
    let record = await repo.create(cover, config);
    record = await repo.saveMainAnswers(
      record.id,
      answers(),
      workCharacteristicAnswers(),
      [],
    );
    const questions = [
      {
        id: "follow-purpose",
        topicId: "purpose-scope" as const,
        question: "Was ist das normale Ergebnis?",
        rationale: "Ergebnis fehlt.",
      },
    ];
    record = await repo.saveValidationRun(
      record.id,
      validationInputSnapshot(
        record.mainAnswers,
        record.workCharacteristicAnswers,
      ),
      [],
      questions,
      trace(),
    );
    expect(record.state).toBe("follow_up_required");
    record = await repo.acceptOpenQuestionsForSynthesis(record.id);
    expect(record.state).toBe("synthesis_ready");
    const invalidEvidence = understanding();
    invalidEvidence.evidence[0]!.kind = "upload";
    await expect(
      repo.saveUnderstanding(record.id, invalidEvidence, trace()),
    ).rejects.toThrow("unbekannte Evidenzquelle");
    expect((await repo.required(record.id)).state).toBe("synthesis_ready");
    record = await repo.saveUnderstanding(record.id, understanding(), trace());
    expect(record.state).toBe("review_required");
    const corrected = structuredClone(record.understanding!);
    corrected.purpose.value = "Korrigierter fachlicher Zweck.";
    [corrected.steps[0], corrected.steps[1]] = [
      corrected.steps[1]!,
      corrected.steps[0]!,
    ];
    corrected.steps.forEach((step, index) => {
      step.order = index + 1;
    });
    record = await repo.correctUnderstanding(
      record.id,
      corrected,
      "Zweck fachlich präzisiert.",
    );
    expect(record.understanding?.purpose.provenance).toBe("user_confirmed");
    expect(
      record.understanding?.steps.slice(0, 2).map((step) => step.id),
    ).toEqual(["step-2", "step-1"]);
    expect(
      record.understanding?.steps.slice(0, 2).map((step) => step.order),
    ).toEqual([1, 2]);
    expect(record.understanding?.steps[0]?.provenance).toBe("user_confirmed");
    record = await repo.confirm(record.id);
    expect(record.state).toBe("confirmed");
    expect(record.understanding?.trigger.provenance).toBe("ai_structured");
    expect(record.understanding?.knowledgeGaps).toContain(
      "Exakte Fallzahl unbekannt",
    );
    const correctedCharacteristics = workCharacteristicAnswers();
    correctedCharacteristics[1]!.selectedOptionIds = ["none"];
    record = await repo.correctWorkCharacteristics(
      record.id,
      correctedCharacteristics,
      "Inhaltsarten fachlich berichtigt.",
    );
    expect(record.state).toBe("review_required");
    expect(record.confirmedAt).toBeNull();
    expect(record.workCharacteristicAnswers[1]?.selectedOptionIds).toEqual([
      "none",
    ]);
    expect((await repo.history(record.id)).map((entry) => entry.event)).toEqual(
      expect.arrayContaining([
        "understanding-confirmed",
        "work-characteristics-corrected",
      ]),
    );
  });

  test("materializes legacy follow-ups and appends revalidation history", async () => {
    const { repo, config } = await fixture();
    let record = await repo.create(cover, config);
    const inputA = answers();
    record = await repo.saveMainAnswers(
      record.id,
      inputA,
      workCharacteristicAnswers(),
      [],
    );
    const question = {
      id: "legacy-question",
      topicId: "purpose-scope" as const,
      question: "Welches Ergebnis entsteht?",
      rationale: "Das Ergebnis ist noch offen.",
    };
    record = await repo.saveValidationRun(
      record.id,
      validationInputSnapshot(
        record.mainAnswers,
        record.workCharacteristicAnswers,
      ),
      [],
      [question],
      trace(),
    );
    const followUpsPath = join(repo.dir(record.id), "follow-ups.json");
    await writeFile(
      followUpsPath,
      `${JSON.stringify({ questions: [question], answers: [] }, null, 2)}\n`,
    );

    const legacy = await repo.required(record.id);
    expect(legacy.validationRuns).toEqual([]);
    const inputB = answers();
    inputB[0] = {
      ...inputB[0]!,
      text: "Eine fachlich geprüfte Ansprache ist das normale Ergebnis.",
    };
    record = await repo.saveMainAnswers(
      record.id,
      inputB,
      workCharacteristicAnswers(),
      [],
    );
    expect(record.validationRuns).toHaveLength(1);
    expect(record.validationRuns[0]?.trace).toBeNull();
    expect(record.validationRuns[0]?.inputSnapshot.mainAnswers[0]?.text).toBe(
      inputA[0]?.text,
    );

    record = await repo.saveValidationRun(
      record.id,
      validationInputSnapshot(
        record.mainAnswers,
        record.workCharacteristicAnswers,
      ),
      [
        {
          questionId: question.id,
          topicId: question.topicId,
          outcome: "addressed",
          rationale: "Das Ergebnis ist jetzt konkret benannt.",
        },
      ],
      [],
      trace(),
    );
    expect(record.state).toBe("synthesis_ready");
    expect(record.validationRuns.map((run) => run.runNumber)).toEqual([1, 2]);
    expect(record.validationRuns[1]?.inputSnapshot.mainAnswers[0]?.text).toBe(
      inputB[0]?.text,
    );
    expect(record.validationRuns[1]?.previousQuestionReviews[0]).toMatchObject({
      questionId: "legacy-question",
      outcome: "addressed",
    });
    expect((await repo.history(record.id)).map((entry) => entry.event)).toEqual(
      expect.arrayContaining([
        "validation-input-updated",
        "validation-run-completed",
      ]),
    );
  });

  test("validates upload type/count and permanently deletes records", async () => {
    const { repo, config } = await fixture();
    const record = await repo.create(cover, config);
    const file = new File(["Fiktiver Ablauf"], "prozess.txt", {
      type: "text/plain;charset=utf-8",
    });
    const upload = await repo.saveUpload(record.id, file);
    expect(upload.mediaType).toBe("text/plain");
    expect(
      (await stat(repo.uploadPath(record.id, upload.id, upload.name))).isFile(),
    ).toBe(true);
    await expect(
      repo.saveUpload(
        record.id,
        new File(["x"], "bad.exe", { type: "application/octet-stream" }),
      ),
    ).rejects.toThrow();
    await expect(
      repo.saveUpload(
        record.id,
        new File(["kein echtes PDF"], "falsch.pdf", {
          type: "application/pdf",
        }),
      ),
    ).rejects.toThrow("kein gültiges PDF");
    await expect(
      repo.saveUpload(
        record.id,
        new File(
          [new Uint8Array(config.uploads.maxFileBytes + 1)],
          "zu-gross.txt",
          { type: "text/plain" },
        ),
      ),
    ).rejects.toThrow("höchstens 20 MB");
    await expect(
      repo.saveMainAnswers(record.id, answers(), workCharacteristicAnswers(), [
        crypto.randomUUID(),
      ]),
    ).rejects.toThrow("gehört nicht zu diesem Prozess");
    for (let index = 2; index <= 5; index++)
      await repo.saveUpload(
        record.id,
        new File([`Ablauf ${index}`], `prozess-${index}.txt`, {
          type: "text/plain",
        }),
      );
    await expect(
      repo.saveUpload(
        record.id,
        new File(["sechste Datei"], "prozess-6.txt", {
          type: "text/plain",
        }),
      ),
    ).rejects.toThrow("höchstens fünf Dateien");
    await expect(repo.deleteCapture(record.id, true)).rejects.toThrow(
      "KI-Aktion",
    );
    const deleted = await repo.deleteCapture(record.id);
    expect(deleted.deleted).toBe(true);
    expect(await repo.get(record.id)).toBeNull();
    expect((await repo.create(cover, config)).id).toBe("PROC-0001");
  });

  test("permanently deletes a confirmed process after explicit repository call", async () => {
    const { repo, config } = await fixture();
    let record = await repo.create(cover, config);
    record = await repo.saveMainAnswers(
      record.id,
      answers(),
      workCharacteristicAnswers(),
      [],
    );
    record = await repo.saveValidationRun(
      record.id,
      validationInputSnapshot(
        record.mainAnswers,
        record.workCharacteristicAnswers,
      ),
      [],
      [],
      trace(),
    );
    record = await repo.saveUnderstanding(record.id, understanding(), trace());
    record = await repo.confirm(record.id);

    expect((await repo.deleteCapture(record.id)).deleted).toBe(true);
    expect(await repo.get(record.id)).toBeNull();
    expect(await stat(repo.dir(record.id)).catch(() => null)).toBeNull();
  });

  test("reads uploads byte-identically and rejects tampered files", async () => {
    const { repo, config } = await fixture();
    const record = await repo.create(cover, config);
    const original = new TextEncoder().encode("Fiktiver Ablauf mit Umlaut: ä");
    const upload = await repo.saveUpload(
      record.id,
      new File([original], "Ablauf Übersicht.txt", { type: "text/plain" }),
    );

    const stored = await repo.readUpload(record.id, upload.id);
    expect(stored.upload).toEqual(upload);
    expect(stored.bytes).toEqual(original);
    await expect(
      repo.readUpload(record.id, crypto.randomUUID()),
    ).rejects.toThrow("Datei nicht gefunden");

    await writeFile(
      repo.uploadPath(record.id, upload.id, upload.name),
      "manipulierter Inhalt gleicher oder anderer Länge",
    );
    await expect(repo.readUpload(record.id, upload.id)).rejects.toThrow(
      "nicht sicher gelesen",
    );
  });

  test("rejects corrupt canonical files after restart without repairing them", async () => {
    const { root, repo, config } = await fixture();
    const record = await repo.create(cover, config);
    const answersPath = join(repo.dir(record.id), "answers.json");
    await writeFile(answersPath, "{ broken json\n");
    const before = await readFile(answersPath, "utf8");

    const restarted = new ProcessCaptureRepository(root);
    await expect(restarted.required(record.id)).rejects.toThrow();
    expect(await readFile(answersPath, "utf8")).toBe(before);
  });

  test("reads legacy understanding without rewriting and persists v2 on nested correction", async () => {
    const { root, repo, config } = await fixture();
    let record = await repo.create(cover, config);
    record = await repo.saveMainAnswers(
      record.id,
      answers(),
      workCharacteristicAnswers(),
      [],
    );
    record = await repo.saveValidationRun(
      record.id,
      validationInputSnapshot(
        record.mainAnswers,
        record.workCharacteristicAnswers,
      ),
      [],
      [],
      trace(),
    );
    record = await repo.saveUnderstanding(record.id, understanding(), trace());

    const path = join(repo.dir(record.id), "process-understanding.json");
    const legacyJson = `${JSON.stringify(legacyUnderstanding(), null, 2)}\n`;
    await writeFile(path, legacyJson, "utf8");

    const restarted = new ProcessCaptureRepository(root);
    const migrated = await restarted.required(record.id);
    expect(migrated.understanding?.schemaVersion).toBe(2);
    expect(migrated.understanding?.steps[0]?.informationItems[0]).toMatchObject(
      { source: null, type: "unknown" },
    );
    expect(await readFile(path, "utf8")).toBe(legacyJson);

    const corrected = structuredClone(migrated.understanding!);
    corrected.steps[0]!.informationItems[0]!.source = "Vertriebs-CRM";
    corrected.steps[0]!.informationItems[0]!.type = "system_field";
    corrected.steps[0]!.miscellaneous = "Fachlich ergänzter Hinweis.";
    const saved = await restarted.correctUnderstanding(
      record.id,
      corrected,
      "Informationsquelle und Hinweis ergänzt.",
    );
    expect(saved.understanding?.steps[0]?.provenance).toBe("user_confirmed");
    expect(saved.understanding?.steps[1]?.provenance).toBe("ai_structured");
    expect(
      saved.understanding?.evidence.filter(
        (item) => item.kind === "human_correction",
      ),
    ).toHaveLength(1);
    const stored = JSON.parse(await readFile(path, "utf8"));
    expect(stored.schemaVersion).toBe(2);
    expect(stored.steps[0].informationItems[0]).toMatchObject({
      source: "Vertriebs-CRM",
      type: "system_field",
    });
    const correction = (await restarted.history(record.id)).find(
      (entry) => entry.event === "understanding-corrected",
    );
    expect(correction?.detail).toMatchObject({
      note: "Informationsquelle und Hinweis ergänzt.",
      previous: { schemaVersion: 2 },
      next: { schemaVersion: 2 },
    });
  });

  test("rejects forged correction evidence and keeps canonical output unchanged", async () => {
    const { repo, config } = await fixture();
    let record = await repo.create(cover, config);
    record = await repo.saveMainAnswers(
      record.id,
      answers(),
      workCharacteristicAnswers(),
      [],
    );
    record = await repo.saveValidationRun(
      record.id,
      validationInputSnapshot(
        record.mainAnswers,
        record.workCharacteristicAnswers,
      ),
      [],
      [],
      trace(),
    );
    record = await repo.saveUnderstanding(record.id, understanding(), trace());
    const before = await readFile(
      join(repo.dir(record.id), "process-understanding.json"),
      "utf8",
    );
    const forged = structuredClone(record.understanding!);
    forged.evidence.push({
      id: "forged-correction",
      kind: "human_correction",
      sourceId: "forged-correction",
      excerpt: "Nicht vom System erzeugt",
    });
    await expect(
      repo.correctUnderstanding(record.id, forged, "Fachliche Korrektur"),
    ).rejects.toThrow("ausschließlich vom System");
    expect(
      await readFile(
        join(repo.dir(record.id), "process-understanding.json"),
        "utf8",
      ),
    ).toBe(before);
  });

  test("audits inserted, reordered, and deleted steps by stable ID", async () => {
    const { repo, config } = await fixture();
    let record = await repo.create(cover, config);
    record = await repo.saveMainAnswers(
      record.id,
      answers(),
      workCharacteristicAnswers(),
      [],
    );
    record = await repo.saveValidationRun(
      record.id,
      validationInputSnapshot(
        record.mainAnswers,
        record.workCharacteristicAnswers,
      ),
      [],
      [],
      trace(),
    );
    record = await repo.saveUnderstanding(record.id, understanding(6), trace());

    let corrected = removeProcessStep(record.understanding!, "step-6");
    corrected = insertProcessStep(corrected, 5, "step-new");
    corrected.steps[0]!.name = "Fachlich korrigierter Start";
    corrected.steps[5] = {
      ...corrected.steps[5]!,
      name: "Neuer Abschluss",
      activity: "Der Abschluss wird dokumentiert.",
      inputs: ["Geprüftes Ergebnis"],
      outputs: ["Dokumentierter Abschluss"],
    };
    record = await repo.correctUnderstanding(
      record.id,
      corrected,
      "Start, Abschluss und Struktur fachlich berichtigt.",
    );

    const humanEvidence = record.understanding!.evidence.filter(
      (item) => item.kind === "human_correction",
    );
    expect(humanEvidence).toHaveLength(1);
    const correctionId = humanEvidence[0]!.id;
    expect(record.understanding!.steps[0]).toMatchObject({
      id: "step-1",
      provenance: "user_confirmed",
    });
    expect(record.understanding!.steps[0]!.evidenceIds).toContain(correctionId);
    expect(record.understanding!.steps[1]!.provenance).toBe("ai_structured");
    expect(record.understanding!.steps[5]).toMatchObject({
      id: "step-new",
      provenance: "user_confirmed",
    });
    expect(record.understanding!.steps[5]!.evidenceIds).toContain(correctionId);

    const reordered = moveProcessStep(record.understanding!, "step-1", 1);
    const reorderedRecord = await repo.correctUnderstanding(
      record.id,
      reordered,
      "Die ersten beiden Schritte wurden neu sortiert.",
    );
    expect(
      reorderedRecord.understanding!.steps.slice(0, 2).map((step) => step.id),
    ).toEqual(["step-2", "step-1"]);
    expect(reorderedRecord.understanding!.steps[1]!.name).toBe(
      "Fachlich korrigierter Start",
    );

    const corrections = (await repo.history(record.id)).filter(
      (entry) => entry.event === "understanding-corrected",
    );
    expect(corrections).toHaveLength(2);
    const structural = corrections.find(
      (entry) =>
        (entry.detail as { note?: string }).note ===
        "Start, Abschluss und Struktur fachlich berichtigt.",
    )!;
    const detail = structural.detail as {
      previous: { steps: Array<{ id: string }> };
      next: { steps: Array<{ id: string }> };
    };
    expect(detail.previous.steps.map((step) => step.id)).toContain("step-6");
    expect(detail.next.steps.map((step) => step.id)).not.toContain("step-6");
    expect(detail.next.steps.map((step) => step.id)).toContain("step-new");
  });
});
