import { describe, expect, test } from "bun:test";
import {
  chatCaptureStateSchema,
  chatActivityEventSchema,
  chatUnderstandingEventSchema,
  chatMentionSchema,
  chatMessageRequestSchema,
  chatTranscriptEventSchema,
} from "../packages/domain/src/chat-capture.ts";
import { processCaptureRecordSchema } from "../packages/domain/src/process-understanding.ts";
import { cover, processConfig } from "./process-fixtures.ts";

describe("chat capture domain", () => {
  test("validates stable step and transition mentions and rejects duplicates", () => {
    expect(
      chatMentionSchema.parse({
        kind: "step",
        stepId: "step-1",
        label: "Schritt-1",
      }),
    ).toEqual({
      kind: "step",
      stepId: "step-1",
      label: "Schritt-1",
      nameSnapshot: null,
      understandingRevision: null,
    });
    expect(
      chatMentionSchema.parse({
        kind: "transition",
        fromStepId: "step-1",
        toStepId: "step-2",
        label: "Übergang-1-2",
      }),
    ).toMatchObject({
      kind: "transition",
      nameSnapshot: null,
      understandingRevision: null,
    });
    expect(() =>
      chatMessageRequestSchema.parse({
        id: crypto.randomUUID(),
        text: "Bitte ändern.",
        action: "message",
        mentions: [
          { kind: "step", stepId: "step-1", label: "Schritt-1" },
          { kind: "step", stepId: "step-1", label: "Schritt-1" },
        ],
      }),
    ).toThrow("Mentions must be unique");
  });

  test("defaults legacy mention snapshots and bounds new snapshots", () => {
    const legacy = chatTranscriptEventSchema.parse({
      schemaVersion: 1,
      id: crypto.randomUUID(),
      turnId: null,
      at: new Date().toISOString(),
      role: "user",
      status: "complete",
      text: "Bitte prüfen.",
      mentions: [{ kind: "step", stepId: "step-1", label: "Schritt-1" }],
      action: "message",
    });
    expect(legacy.mentions[0]).toMatchObject({
      nameSnapshot: null,
      understandingRevision: null,
    });
    expect(() =>
      chatMentionSchema.parse({
        kind: "step",
        stepId: "step-1",
        label: "Schritt-1",
        nameSnapshot: "x".repeat(241),
        understandingRevision: "a".repeat(64),
      }),
    ).toThrow();
  });

  test("keeps confirmation quality mode-aware", async () => {
    const config = await processConfig();
    const base = {
      schemaVersion: 1 as const,
      id: "PROC-0001",
      state: "capture_in_progress" as const,
      profile: config.profile,
      configHash: "a".repeat(64),
      interactionMode: "chat" as const,
      confirmationQuality: null,
      cover,
      configSnapshot: config,
      mainAnswers: [],
      workCharacteristicAnswers: [],
      followUps: [],
      followUpAnswers: [],
      validationRuns: [],
      selectedUploadIds: [],
      understanding: null,
      uploads: [],
      confirmedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    expect(processCaptureRecordSchema.parse(base).interactionMode).toBe("chat");
    expect(() =>
      processCaptureRecordSchema.parse({
        ...base,
        confirmationQuality: "complete",
      }),
    ).toThrow();
  });

  test("requires bounded state and message data", () => {
    const now = new Date().toISOString();
    expect(
      chatCaptureStateSchema.parse({
        schemaVersion: 1,
        documentGate: "pending",
        selectedUploadIds: [],
        lastValidRevision: null,
        lastValidAt: null,
        lastTurnOutcome: null,
        createdAt: now,
        updatedAt: now,
      }).documentGate,
    ).toBe("pending");
    expect(() =>
      chatMessageRequestSchema.parse({
        id: crypto.randomUUID(),
        text: "x".repeat(20_001),
        action: "message",
      }),
    ).toThrow();
  });
});

test("validates safe activity and understanding stream events", () => {
  const now = new Date().toISOString();
  expect(
    chatActivityEventSchema.parse({
      schemaVersion: 1,
      state: "active",
      kind: "reading_documents",
      timestamp: now,
    }),
  ).toMatchObject({ kind: "reading_documents" });
  expect(
    chatActivityEventSchema.parse({
      schemaVersion: 1,
      state: "idle",
      timestamp: now,
    }).state,
  ).toBe("idle");
  expect(() =>
    chatActivityEventSchema.parse({
      schemaVersion: 1,
      state: "active",
      kind: "Bash",
      timestamp: now,
    }),
  ).toThrow();
  expect(() =>
    chatActivityEventSchema.parse({
      schemaVersion: 1,
      state: "idle",
      timestamp: "yesterday",
      extra: true,
    }),
  ).toThrow();
  expect(
    chatUnderstandingEventSchema.parse({
      status: "valid",
      revision: "a".repeat(64),
      timestamp: now,
    }).status,
  ).toBe("valid");
  expect(() =>
    chatUnderstandingEventSchema.parse({ status: "valid", timestamp: now }),
  ).toThrow();
});
