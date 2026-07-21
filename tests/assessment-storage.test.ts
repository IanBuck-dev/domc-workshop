import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { strToU8, zipSync } from "fflate";
import { assessmentConfigSchema } from "../packages/domain/src/assessment";
import { AssessmentRepository } from "../packages/storage/src/assessment-repository";

const roots: string[] = [];
const config = assessmentConfigSchema.parse(
  await Bun.file("defaults/assessment-config.json").json(),
);
const cover = {
  department: "Schaden",
  participantName: "Test Person",
  participantEmail: "test@example.invalid",
  processName: "Schadenprüfung",
};
const operation = {
  operationId: crypto.randomUUID(),
  model: "test",
  sessionId: null,
  durationMs: 1,
  inputTokens: 1,
  outputTokens: 1,
};

async function repository() {
  const root = await mkdtemp(join(tmpdir(), "claims-assessment-"));
  roots.push(root);
  return new AssessmentRepository(root);
}

afterEach(async () =>
  Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  ),
);

describe("assessment repository", () => {
  test("freezes mode/config, duplicates comparison data and keeps split atomic records", async () => {
    const repo = await repository();
    const original = await repo.create({ cover, mode: "form", config });
    const duplicate = await repo.duplicateForComparison(original.id);
    const refreshed = await repo.get(original.id);
    expect(duplicate.mode).toBe("chat");
    expect(duplicate.configHash).toBe(original.configHash);
    expect(refreshed).not.toBeNull();
    expect(duplicate.comparisonGroupId).toBe(refreshed!.comparisonGroupId);
    expect(
      JSON.parse(
        await readFile(join(repo.dir(original.id), "criteria.json"), "utf8"),
      ),
    ).toHaveLength(28);
    const snapshotPath = join(repo.dir(original.id), "config-snapshot.json");
    const snapshot = JSON.parse(await readFile(snapshotPath, "utf8")) as {
      openingMessage: string;
    };
    snapshot.openingMessage = "Manipulierter Text";
    await writeFile(snapshotPath, JSON.stringify(snapshot), "utf8");
    await expect(repo.get(original.id)).rejects.toThrow("Konfigurations-Hash");
  });

  test("retains a no-signal gateway result outside criteria and ranking states", async () => {
    const repo = await repository();
    const record = await repo.create({ cover, mode: "form", config });
    const decisions = config.gateway.questions.map((question) => ({
      questionId: question.id,
      decision: "no" as const,
      confidence: 90,
      rationale: "Keine Hinweise",
      evidence: [],
      assumptions: [],
    }));
    const saved = await repo.saveGateway(record.id, {
      userAnswers: [],
      decisions,
      followUpQuestion: null,
      followUpAnswer: null,
      followUpsUsed: 0,
      final: true,
      hasClearAiSignal: false,
      operation,
    });
    expect(saved.state).toBe("submitted_without_clear_ai_signal");
    expect(await repo.list()).toHaveLength(1);
  });

  test("requires row confirmation in form mode and makes a review stale after edits", async () => {
    const repo = await repository();
    let record = await repo.create({ cover, mode: "form", config });
    const decisions = config.gateway.questions.map((question, index) => ({
      questionId: question.id,
      decision: (index ? "no" : "yes") as "yes" | "no",
      confidence: 90,
      rationale: "Test",
      evidence: [],
      assumptions: [],
    }));
    record = await repo.saveGateway(record.id, {
      userAnswers: [],
      decisions,
      followUpQuestion: null,
      followUpAnswer: null,
      followUpsUsed: 0,
      final: true,
      hasClearAiSignal: true,
      operation,
    });
    const proposed = record.criteria.map((item, index) => ({
      ...item,
      value:
        item.criterionId === "absolute-necessity"
          ? false
          : index < 4
            ? 1_000
            : 2,
      source: "ai" as const,
      confirmation: "pending" as const,
      rationale: "Test",
      confidence: 80,
      updatedBy: "ai" as const,
      updatedAt: new Date().toISOString(),
    }));
    record = await repo.applyAiCriteria(record.id, proposed, operation);
    expect(record.state).toBe("criteria_in_progress");
    for (const value of record.criteria)
      record = await repo.confirmCriterion(record.id, value.criterionId);
    expect(record.state).toBe("ready_for_review");
    record = await repo.saveReview(record.id, {
      id: crypto.randomUUID(),
      status: "current",
      reviewedCriteriaUpdatedAt: record.updatedAt,
      deterministicWarnings: [],
      findings: [],
      chatMessagesUsed: 0,
      operation,
      createdAt: new Date().toISOString(),
    });
    expect(record.state).toBe("ready_for_confirmation");
    record = await repo.setCriterion(record.id, "annual-savings", 2_000);
    expect(record.state).toBe("ready_for_review");
    expect(record.review?.status).toBe("stale");
    expect((await repo.history(record.id)).map((item) => item.event)).toContain(
      "criterion-human-updated",
    );
    record = await repo.setCriterion(record.id, "annual-savings", null);
    expect(record.state).toBe("criteria_in_progress");
    expect(record.calculatedResults).toBeNull();
    expect(
      record.criteria.find((item) => item.criterionId === "annual-savings")
        ?.confirmation,
    ).toBe("empty");
    expect((await repo.history(record.id)).map((item) => item.event)).toContain(
      "criterion-human-cleared",
    );
  });

  test("validates upload contents and stores only supported assessment files", async () => {
    const repo = await repository();
    const record = await repo.create({ cover, mode: "chat", config });
    const workbook = zipSync({
      "[Content_Types].xml": strToU8(
        '<Types><Override ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/></Types>',
      ),
      "xl/workbook.xml": strToU8("<workbook/>"),
    });
    const upload = await repo.saveUpload(
      record.id,
      "test.xlsx",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      workbook,
    );
    expect(upload.name).toBe("test.xlsx");
    expect((await repo.get(record.id))?.uploads).toHaveLength(1);
    const textUpload = await repo.saveUpload(
      record.id,
      "browser.txt",
      "text/plain;charset=utf-8",
      new TextEncoder().encode("Fiktive Testdatei aus einem Browser."),
    );
    expect(textUpload.mediaType).toBe("text/plain");
    const arbitraryZip = zipSync({ "payload.txt": strToU8("not a workbook") });
    await expect(
      repo.saveUpload(
        record.id,
        "falsch.xlsx",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        arbitraryZip,
      ),
    ).rejects.toThrow("Dateiendung und Inhaltstyp");
    await expect(
      repo.saveUpload(
        record.id,
        "ungueltig.txt",
        "text/plain",
        new Uint8Array([0xff, 0xfe, 0xfd]),
      ),
    ).rejects.toThrow("Dateiendung und Inhaltstyp");
  });

  test("confirms chat suggestions once as an audited final batch", async () => {
    const repo = await repository();
    let record = await repo.create({ cover, mode: "chat", config });
    record = await repo.saveGateway(record.id, {
      userAnswers: [],
      decisions: config.gateway.questions.map((question, index) => ({
        questionId: question.id,
        decision: index === 0 ? ("yes" as const) : ("no" as const),
        confidence: 90,
        rationale: "Test",
        evidence: [],
        assumptions: [],
      })),
      followUpQuestion: null,
      followUpAnswer: null,
      followUpsUsed: 0,
      final: true,
      hasClearAiSignal: true,
      operation,
    });
    record = await repo.applyAiCriteria(
      record.id,
      record.criteria.map((item, index) => ({
        ...item,
        value:
          item.criterionId === "absolute-necessity"
            ? false
            : index < 4
              ? 1_000
              : 1,
        source: "ai" as const,
        confirmation: "pending" as const,
        rationale: "Aus dem Testkontext abgeleitet",
        evidence: ["Testkontext"],
        assumptions: ["Fiktive Annahme"],
        confidence: 75,
        updatedBy: "ai" as const,
        updatedAt: new Date().toISOString(),
      })),
      operation,
    );
    expect(record.state).toBe("ready_for_review");
    expect(
      record.criteria.every((item) => item.confirmation === "pending"),
    ).toBe(true);
    expect(record.criteria[0]?.assumptions).toEqual(["Fiktive Annahme"]);
    record = await repo.saveReview(record.id, {
      id: crypto.randomUUID(),
      status: "current",
      reviewedCriteriaUpdatedAt: record.updatedAt,
      deterministicWarnings: [],
      findings: [],
      chatMessagesUsed: 0,
      operation,
      createdAt: new Date().toISOString(),
    });
    record = await repo.confirmAssessment(record.id);
    expect(
      record.criteria.every((item) => item.confirmation === "confirmed"),
    ).toBe(true);
    expect(await repo.history(record.id)).toContainEqual(
      expect.objectContaining({
        event: "assessment-confirmed",
        detail: expect.objectContaining({
          confirmation: expect.objectContaining({
            type: "batch",
            criterionIds: expect.arrayContaining(["annual-savings"]),
          }),
        }),
      }),
    );
  });
});
