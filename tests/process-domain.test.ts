import { describe, expect, test } from "bun:test";
import {
  assertExactlyFiveAnswers,
  processCaptureConfigSchema,
  processCaptureRecordSchema,
  processUnderstandingStorageSchema,
  processUnderstandingSchema,
  topicIds,
  workCharacteristicAnswersSchema,
} from "../packages/domain/src/process-understanding.ts";
import {
  answers,
  legacyUnderstanding,
  processConfig,
  understanding,
  workCharacteristicAnswers,
} from "./process-fixtures.ts";

describe("compact-v1 process domain", () => {
  test("locks exactly five configured topics", async () => {
    const config = await processConfig();
    expect(config.topics.map((topic) => topic.id)).toEqual([...topicIds]);
    expect(config.uploads.allowedExtensions).toEqual([
      ".pdf",
      ".xlsx",
      ".csv",
      ".docx",
      ".pptx",
      ".txt",
      ".md",
      ".png",
      ".jpg",
      ".jpeg",
    ]);
    expect(config.ai.timeoutMs).toBe(300_000);
    expect(() =>
      processCaptureConfigSchema.parse({
        ...config,
        topics: config.topics.slice(0, 4),
      }),
    ).toThrow();
  });

  test("requires exactly one answer per topic", () => {
    expect(assertExactlyFiveAnswers(answers())).toHaveLength(5);
    expect(() => assertExactlyFiveAnswers(answers().slice(0, 4))).toThrow();
    const duplicate = answers();
    duplicate[4] = { ...duplicate[4]!, topicId: duplicate[0]!.topicId };
    expect(() => assertExactlyFiveAnswers(duplicate)).toThrow();
  });

  test("requires four valid work characteristics with exclusive sentinels", () => {
    expect(
      workCharacteristicAnswersSchema.parse(workCharacteristicAnswers()),
    ).toHaveLength(4);
    expect(() =>
      workCharacteristicAnswersSchema.parse(
        workCharacteristicAnswers().slice(0, 3),
      ),
    ).toThrow();
    const conflicting = workCharacteristicAnswers();
    conflicting[1]!.selectedOptionIds = ["none", "free-text"];
    expect(() => workCharacteristicAnswersSchema.parse(conflicting)).toThrow(
      "nur einzeln",
    );
    const unknown = workCharacteristicAnswers();
    unknown[2]!.selectedOptionIds = ["unknown-option"];
    expect(() => workCharacteristicAnswersSchema.parse(unknown)).toThrow(
      "unbekannten Wert",
    );
  });

  test("keeps profile version 1 valid without inventing work characteristics", async () => {
    const current = await processConfig();
    const legacyConfigInput: Record<string, unknown> = structuredClone(current);
    delete legacyConfigInput.workCharacteristics;
    legacyConfigInput.profile = { id: "compact-v1", version: 1 };
    const legacyConfig = processCaptureConfigSchema.parse(legacyConfigInput);
    const now = new Date().toISOString();
    const legacy = processCaptureRecordSchema.parse({
      schemaVersion: 1,
      id: "PROC-0001",
      state: "capture_in_progress",
      profile: legacyConfig.profile,
      configHash: "a".repeat(64),
      cover: {
        department: "Vertrieb",
        participantName: "Test Person",
        participantEmail: "test@example.invalid",
        processName: "Legacy-Prozess",
      },
      configSnapshot: legacyConfig,
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
    expect(legacy.profile.version).toBe(1);
    expect(legacy.workCharacteristicAnswers).toEqual([]);
  });

  test("keeps config snapshots from before PowerPoint support readable", async () => {
    const current = await processConfig();
    const legacyInput: Record<string, unknown> = structuredClone(current);
    const uploads = legacyInput.uploads as { allowedExtensions: string[] };
    uploads.allowedExtensions = uploads.allowedExtensions.filter(
      (extension) => extension !== ".pptx",
    );
    const legacy = processCaptureConfigSchema.parse(legacyInput);
    expect(legacy.uploads.allowedExtensions).not.toContain(".pptx");
  });

  test("locks work-characteristic semantics while allowing wording changes", async () => {
    const config = await processConfig();
    expect(
      processCaptureConfigSchema.parse({
        ...config,
        workCharacteristics: config.workCharacteristics.map((item) =>
          item.id === "content-types"
            ? { ...item, question: "Welche Inhalte kommen vor?" }
            : item,
        ),
      }),
    ).toBeTruthy();
    expect(() =>
      processCaptureConfigSchema.parse({
        ...config,
        workCharacteristics: config.workCharacteristics.map((item) =>
          item.id === "content-types"
            ? { ...item, options: item.options.slice(0, -1) }
            : item,
        ),
      }),
    ).toThrow("immutable");
  });

  test("requires five to eight contiguous unique steps", () => {
    expect(
      processUnderstandingSchema.parse(understanding(5)).steps,
    ).toHaveLength(5);
    expect(
      processUnderstandingSchema.parse(understanding(8)).steps,
    ).toHaveLength(8);
    expect(() =>
      processUnderstandingSchema.parse({
        ...understanding(5),
        steps: understanding(5).steps.slice(0, 4),
      }),
    ).toThrow();
    expect(() =>
      processUnderstandingSchema.parse({
        ...understanding(8),
        steps: [
          ...understanding(8).steps,
          { ...understanding(8).steps[0], id: "step-9", order: 9 },
        ],
      }),
    ).toThrow();
    const reordered = structuredClone(understanding(5));
    reordered.steps[2]!.order = 4;
    expect(() => processUnderstandingSchema.parse(reordered)).toThrow();
  });

  test("requires every v2 step area and accepts explicit unknown states", () => {
    const missing = structuredClone(understanding());
    delete (missing.steps[0] as unknown as Record<string, unknown>).inputs;
    expect(() => processUnderstandingSchema.parse(missing)).toThrow();

    const unknown = structuredClone(understanding());
    unknown.steps[0]!.inputs = [];
    unknown.steps[0]!.outputs = [];
    unknown.steps[0]!.informationItems = [];
    unknown.steps[0]!.decisions = [];
    unknown.steps[0]!.miscellaneous = null;
    expect(processUnderstandingSchema.parse(unknown).steps[0]).toMatchObject({
      inputs: [],
      outputs: [],
      informationItems: [],
      decisions: [],
      miscellaneous: null,
    });
  });

  test("rejects duplicate nested IDs, unknown enums, and foreign next steps", () => {
    const duplicateInformation = structuredClone(understanding());
    duplicateInformation.steps[1]!.informationItems[0]!.id =
      duplicateInformation.steps[0]!.informationItems[0]!.id;
    expect(() =>
      processUnderstandingSchema.parse(duplicateInformation),
    ).toThrow("Information IDs must be unique");

    const duplicateDecision = structuredClone(understanding());
    duplicateDecision.steps[1]!.decisions = [
      structuredClone(duplicateDecision.steps[0]!.decisions[0]!),
    ];
    expect(() => processUnderstandingSchema.parse(duplicateDecision)).toThrow(
      "Decision IDs must be unique",
    );

    const duplicateOption = structuredClone(understanding());
    duplicateOption.steps[0]!.decisions[0]!.options[1]!.id =
      duplicateOption.steps[0]!.decisions[0]!.options[0]!.id;
    expect(() => processUnderstandingSchema.parse(duplicateOption)).toThrow(
      "Decision option IDs must be unique",
    );

    const invalidType = structuredClone(understanding());
    (invalidType.steps[0]!.informationItems[0] as { type: string }).type =
      "pdf_property";
    expect(() => processUnderstandingSchema.parse(invalidType)).toThrow();

    const invalidMode = structuredClone(understanding());
    (invalidMode.steps[0]!.decisions[0] as { mode: string }).mode = "automatic";
    expect(() => processUnderstandingSchema.parse(invalidMode)).toThrow();

    const danglingNextStep = structuredClone(understanding());
    danglingNextStep.steps[0]!.decisions[0]!.options[0]!.nextStepId =
      "step-missing";
    expect(() => processUnderstandingSchema.parse(danglingNextStep)).toThrow(
      "Unknown next step ID",
    );
  });

  test("migrates legacy steps deterministically without inventing detail", () => {
    const legacy = legacyUnderstanding();
    const migrated = processUnderstandingStorageSchema.parse(legacy);
    const first = migrated.steps[0]!;
    expect(migrated.schemaVersion).toBe(2);
    expect(first.inputs).toEqual(["Lead ist fällig"]);
    expect(first.outputs).toEqual(["Ergebnis 1"]);
    expect(first.informationItems).toEqual([
      {
        id: "info-1-1",
        name: "CRM-Angaben",
        source: null,
        type: "unknown",
      },
    ]);
    expect(first.decisions).toEqual([
      {
        id: "decision-1-1",
        question: "Ist die Kontaktaufnahme erlaubt?",
        mode: "unknown",
        options: [],
      },
    ]);
    expect(first.miscellaneous).toContain("Verantwortlich: Vertrieb");
    expect(first.miscellaneous).toContain("Systeme: CRM");
    expect(processUnderstandingStorageSchema.parse(legacy)).toEqual(migrated);
  });

  test("rejects dangling evidence references", () => {
    const value = structuredClone(understanding());
    value.purpose.evidenceIds = ["missing"];
    expect(() => processUnderstandingSchema.parse(value)).toThrow(
      "Unknown evidence ID",
    );
    const duplicateEvidence = structuredClone(understanding());
    duplicateEvidence.evidence.push({ ...duplicateEvidence.evidence[0]! });
    expect(() => processUnderstandingSchema.parse(duplicateEvidence)).toThrow(
      "Evidence IDs must be unique",
    );
    const duplicateCoverage = structuredClone(understanding());
    duplicateCoverage.documentCoverage = [
      {
        uploadId: "00000000-0000-4000-8000-000000000001",
        name: "prozess.txt",
        status: "complete",
        processedCharacters: 100,
        limitation: null,
      },
      {
        uploadId: "00000000-0000-4000-8000-000000000001",
        name: "prozess.txt",
        status: "partial",
        processedCharacters: 50,
        limitation: "Nur teilweise lesbar.",
      },
    ];
    expect(() => processUnderstandingSchema.parse(duplicateCoverage)).toThrow(
      "Document coverage upload IDs must be unique",
    );
  });

  test("rejects canonical records whose state and content disagree", async () => {
    const config = await processConfig();
    const now = new Date().toISOString();
    const base = {
      schemaVersion: 1 as const,
      id: "PROC-0001",
      state: "capture_in_progress" as const,
      profile: config.profile,
      configHash: "a".repeat(64),
      cover: {
        department: "Vertrieb",
        participantName: "Test Person",
        participantEmail: "test@example.invalid",
        processName: "Testprozess",
      },
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
    };
    expect(processCaptureRecordSchema.parse(base).state).toBe(
      "capture_in_progress",
    );
    expect(() =>
      processCaptureRecordSchema.parse({ ...base, state: "synthesis_ready" }),
    ).toThrow("requires all five main answers");
    expect(() =>
      processCaptureRecordSchema.parse({
        ...base,
        state: "review_required",
        mainAnswers: answers(),
      }),
    ).toThrow("requires a synthesized result");
    expect(() =>
      processCaptureRecordSchema.parse({
        ...base,
        state: "confirmed",
        mainAnswers: answers(),
        understanding: understanding(),
      }),
    ).toThrow("Confirmation timestamp");
  });
});
