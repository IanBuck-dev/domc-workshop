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
      kind: "node" as const,
      nodeId: "step-1",
      label: 'Schritt 1 „Eingang prüfen"',
      nameSnapshot: "Eingang prüfen",
      understandingRevision: revision,
    };
    expect(
      withoutLegacyMentionPrefix('@Schritt 1 „Eingang prüfen" Bitte prüfen.', [
        mention,
      ]),
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

  test("resolves current graph nodes and edges without linear adjacency", () => {
    const current = understanding();
    const first = current.steps[0];
    if (!first) throw new Error("Fixture requires a step.");
    const node = {
      kind: "node" as const,
      nodeId: "step-1",
      label: 'Schritt 1 „Hauptschritt 1"',
      nameSnapshot: first.name,
      understandingRevision: revision,
    };
    expect(resolveChatMention(node, current)).toMatchObject({
      target: { kind: "node", nodeId: "step-1" },
      currentLabel: `Schritt ${first.order} „${first.name}"`,
    });
    expect(
      resolveChatMention({ ...node, nodeId: "step-99" }, current)
        .historicalLabel,
    ).toBe("Bezug existiert nur in einer früheren Version");
    const edge = {
      kind: "edge" as const,
      edgeId: "edge-2",
      label: "Übergang Schritt 1 → 2",
      nameSnapshot: null,
      understandingRevision: revision,
    };
    expect(resolveChatMention(edge, current).target).toEqual({
      kind: "edge",
      edgeId: "edge-2",
    });
    expect(
      resolveChatMention({ ...edge, edgeId: "edge-99" }, current)
        .historicalLabel,
    ).toBe("Übergang existiert nur in einer früheren Version");
    expect(
      isChatMentionTargetAvailable({ kind: "edge", edgeId: "edge-2" }, current),
    ).toBe(true);
    expect(
      isChatMentionTargetAvailable(
        { kind: "node", nodeId: "step-99" },
        current,
      ),
    ).toBe(false);
  });

  test("uses edge labels and graph order for readable transition tokens", () => {
    const current = structuredClone(understanding());
    current.flow.edges.push({
      id: "edge-7",
      source: "step-3",
      target: "step-1",
      label: "Unterlagen nachfordern",
    });
    const resolved = resolveChatMention(
      {
        kind: "edge",
        edgeId: "edge-7",
        label: "alt",
        nameSnapshot: null,
        understandingRevision: revision,
      },
      current,
    );
    expect(resolved.currentLabel).toBe('Rücksprung „Unterlagen nachfordern"');
    expect(
      resolveChatMention(
        {
          kind: "node",
          nodeId: "start",
          label: "alt",
          nameSnapshot: null,
          understandingRevision: revision,
        },
        current,
      ).currentLabel,
    ).toBe('Start „Ein Lead wurde länger nicht kontaktiert."');
  });
});
