import { describe, expect, test } from "bun:test";
import {
  classifyChatMilestone,
  withoutLegacyMentionPrefix,
} from "../apps/web/src/components/process-chat-transcript.tsx";
import {
  isChatMentionTargetAvailable,
  resolveChatMention,
} from "../apps/web/src/components/chat-mention.tsx";
import {
  getAttachmentCoveragePresentation,
  formatUploadSize,
  formatUploadType,
  truncateMiddle,
  uploadIconKind,
} from "../apps/web/src/components/document-attachment-list.tsx";
import { understanding } from "./process-fixtures.ts";

const revision = "a".repeat(64);

describe("chat milestone presentation", () => {
  test("formats persisted attachment metadata for compact rows", () => {
    expect(formatUploadSize(900)).toBe("900 B");
    expect(formatUploadSize(1_536)).toBe("1.5 KB");
    expect(formatUploadSize(2_621_440)).toBe("2.5 MB");
    expect(formatUploadType("application/pdf")).toBe("PDF");
    expect(formatUploadType("image/png")).toBe("PNG");
    expect(formatUploadType("text/markdown")).toBe("Markdown");
    expect(formatUploadType("application/x-custom", "anhang.xyz")).toBe("XYZ");
    expect(formatUploadType("application/x-custom")).toBe("Datei");
  });

  test("keeps both ends of long attachment names visible", () => {
    expect(truncateMiddle("arbeitsanweisung.pdf", 12)).toBe("arbeit…g.pdf");
    expect(truncateMiddle("kurz.pdf", 12)).toBe("kurz.pdf");
  });

  test("maps supported attachment types to distinct Lucide icon families", () => {
    expect(uploadIconKind("application/pdf")).toBe("text");
    expect(
      uploadIconKind(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ),
    ).toBe("document");
    expect(uploadIconKind("text/csv")).toBe("spreadsheet");
    expect(
      uploadIconKind(
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      ),
    ).toBe("presentation");
    expect(uploadIconKind("image/png")).toBe("image");
    expect(uploadIconKind("application/octet-stream")).toBe("file");
  });

  test("presents persisted document coverage without treating selection as analysis", () => {
    expect(getAttachmentCoveragePresentation(undefined, true)).toMatchObject({
      label: "Wird ausgewertet …",
      tone: "processing",
      limitation: null,
    });
    expect(getAttachmentCoveragePresentation(undefined, false)).toMatchObject({
      label: "Noch nicht ausgewertet",
      tone: "pending",
      limitation: null,
    });
    expect(
      getAttachmentCoveragePresentation(
        {
          uploadId: "00000000-0000-4000-8000-000000000001",
          name: "prozess.pdf",
          status: "complete",
          processedCharacters: null,
          limitation: null,
        },
        false,
      ),
    ).toMatchObject({ label: "Ausgewertet", tone: "complete" });
    expect(
      getAttachmentCoveragePresentation(
        {
          uploadId: "00000000-0000-4000-8000-000000000001",
          name: "prozess.pdf",
          status: "partial",
          processedCharacters: 120,
          limitation: "Nur die ersten Seiten wurden geprüft.",
        },
        false,
      ),
    ).toMatchObject({
      label: "Teilweise ausgewertet",
      tone: "partial",
      limitation: "Nur die ersten Seiten wurden geprüft.",
    });
    expect(
      getAttachmentCoveragePresentation(
        {
          uploadId: "00000000-0000-4000-8000-000000000001",
          name: "prozess.pdf",
          status: "failed",
          processedCharacters: null,
          limitation: "Die Datei ist nicht lesbar.",
        },
        false,
      ),
    ).toMatchObject({ label: "Nicht auswertbar", tone: "failed" });
  });

  test("removes only legacy prefixes backed by structured mentions", () => {
    const mention = {
      kind: "step" as const,
      stepId: "step-1",
      label: "Schritt-1",
      nameSnapshot: "Eingang prüfen",
      understandingRevision: revision,
    };
    expect(
      withoutLegacyMentionPrefix("@Schritt-1 Bitte prüfen.", [mention]),
    ).toBe("Bitte prüfen.");
    expect(withoutLegacyMentionPrefix("@freier-text", [mention])).toBe(
      "@freier-text",
    );
  });

  test("classifies only completed assistant milestones by persisted action", () => {
    const message = (
      action: "initial" | "confirmation" | "message",
      status: "complete" | "aborted" = "complete",
    ) => ({
      id: crypto.randomUUID(),
      role: "assistant" as const,
      parts: [],
      metadata: { action, status, mentions: [] },
    });
    expect(classifyChatMilestone(message("initial"))).toBe("initial");
    expect(classifyChatMilestone(message("confirmation"))).toBe("confirmation");
    expect(classifyChatMilestone(message("initial", "aborted"))).toBeNull();
    expect(classifyChatMilestone(message("message"))).toBeNull();
  });

  test("keeps step and transition mentions live only for current stable targets", () => {
    const current = understanding();
    const [first, second] = current.steps;
    if (!first || !second) throw new Error("Fixture requires two steps.");
    const step = {
      kind: "step" as const,
      stepId: first.id,
      label: "Schritt-1",
      nameSnapshot: first.name,
      understandingRevision: revision,
    };
    expect(resolveChatMention(step, current)).toMatchObject({
      target: { kind: "step", stepId: first.id },
      currentLabel: `Jetzt Schritt ${first.order} · ${first.name}`,
    });
    expect(
      resolveChatMention({ ...step, stepId: "removed" }, current)
        .historicalLabel,
    ).toBe("Schritt existiert nur in einer früheren Version");
    const transition = {
      kind: "transition" as const,
      fromStepId: first.id,
      toStepId: second.id,
      label: "Übergang-1-2",
      nameSnapshot: `Von ${first.name} zu ${second.name}`,
      understandingRevision: revision,
    };
    expect(resolveChatMention(transition, current).target).toEqual({
      kind: "transition",
      fromStepId: first.id,
      toStepId: second.id,
    });
    const reordered = structuredClone(current);
    [reordered.steps[0], reordered.steps[1]] = [
      reordered.steps[1]!,
      reordered.steps[0]!,
    ];
    expect(resolveChatMention(transition, reordered).historicalLabel).toBe(
      "Übergang existiert nur in einer früheren Version",
    );
    expect(
      isChatMentionTargetAvailable(
        {
          kind: "transition",
          fromStepId: first.id,
          toStepId: second.id,
        },
        reordered,
      ),
    ).toBe(false);
    expect(
      isChatMentionTargetAvailable(
        { kind: "step", stepId: "removed" },
        current,
      ),
    ).toBe(false);
  });
});
