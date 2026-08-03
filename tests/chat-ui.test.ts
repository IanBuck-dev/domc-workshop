import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

describe("chat capture UI contract", () => {
  test("defaults setup to Chat and preserves the Form alternative", async () => {
    const source = await readFile(
      join(process.cwd(), "apps/web/src/pages/process-start-page.tsx"),
      "utf8",
    );
    expect(source).toContain('useState<"chat" | "form">');
    expect(source).toContain('"chat",');
    expect(source).toContain("Empfohlen");
    expect(source).toContain("Formular");
  });

  test("contains the deterministic tutorial and blocking document actions", async () => {
    const tutorial = await readFile(
      join(process.cwd(), "apps/web/src/components/chat-capture-tutorial.tsx"),
      "utf8",
    );
    const gate = await readFile(
      join(process.cwd(), "apps/web/src/components/chat-document-gate.tsx"),
      "utf8",
    );
    const page = await readFile(
      join(process.cwd(), "apps/web/src/pages/process-chat-page.tsx"),
      "utf8",
    );
    expect(tutorial).toContain("Unterlagen bereitstellen");
    expect(tutorial).toContain("In Alltagssprache ergänzen");
    expect(tutorial).toContain("Prozessbild prüfen");
    expect(gate).toContain("Unterlagen auswerten");
    expect(gate).toContain("Ohne Unterlagen fortfahren");
    expect(gate).toContain('role="alert"');
    expect(page).toContain("Trotz offener Punkte bestätigen?");
    expect(page).toContain("useChat");
    expect(page).toContain("DefaultChatTransport");
  });

  test("uses the message scroller and controlled manual-activation responsive tabs", async () => {
    const tabs = await readFile(
      join(process.cwd(), "apps/web/src/components/ui/tabs.tsx"),
      "utf8",
    );
    const page = await readFile(
      join(process.cwd(), "apps/web/src/pages/process-chat-page.tsx"),
      "utf8",
    );
    expect(tabs).toContain('import { Tabs as TabsPrimitive } from "radix-ui"');
    expect(tabs).toContain("TabsPrimitive.Root");
    expect(tabs).toContain("TabsPrimitive.List");
    expect(tabs).toContain("TabsPrimitive.Trigger");
    expect(tabs).toContain("TabsPrimitive.Content");
    expect(page).toContain("value={tab}");
    expect(page).toContain('activationMode="manual"');
    expect(page).toContain("MessageScrollerProvider");
    expect(page).toContain('defaultScrollPosition="last-anchor"');
    expect(page).toContain("scrollPreviousItemPeek={64}");
    expect(page).toContain('aria-label="Zur neuesten Nachricht"');
    expect(page).toContain('const desktopQuery = "(min-width: 1280px)"');
    expect(page).toContain(
      '<TabsList className="mx-4 mb-3 grid h-10 grid-cols-2">',
    );
    expect(page).toContain('<TabsTrigger value="chat">Gespräch</TabsTrigger>');
    expect(page).toContain('<TabsTrigger value="diagram">');
    expect(page).toContain('aria-hidden="true" className="w-2 text-center"');
    expect(page).toContain('if (value === "diagram") setDiagramUnread(false);');
    expect(page).toContain("window.matchMedia(desktopQuery)");
  });

  test("renders a read-only vertical React Flow with directional transitions and mentions", async () => {
    const source = await readFile(
      join(process.cwd(), "apps/web/src/components/process-flow-diagram.tsx"),
      "utf8",
    );
    expect(source).toContain("nodesDraggable={false}");
    expect(source).toContain("nodesConnectable={false}");
    expect(source).toContain("h-48 w-64 overflow-hidden");
    expect(source).toContain(
      'className="line-clamp-3 font-semibold leading-snug"',
    );
    expect(source).toContain(
      'className="mt-1 line-clamp-3 text-sm text-muted-foreground"',
    );
    expect(source).toContain("title={value.name}");
    expect(source).toContain("title={value.activity}");
    expect(source).toContain("position: { x: 80, y: index * 240 }");
    expect(source).toContain("position={Position.Top}");
    expect(source).toContain("position={Position.Bottom}");
    expect(source).toContain("MarkerType.ArrowClosed");
    expect(source).toContain('color: "var(--muted-foreground)"');
    expect(source).toContain('position="top-right"');
    expect(source).toContain('className="!right-3 !top-3"');
    expect(source).toContain("Übergang-");
    expect(source).toContain("Schritt-");
    expect(source).toContain("onMention");
  });

  test("wires milestone cards, structured mentions, shared attachments, and confirmed sidebars", async () => {
    const [page, transcript, gate, attachments, cards, tracker, actions] =
      await Promise.all(
        [
          "apps/web/src/pages/process-chat-page.tsx",
          "apps/web/src/components/process-chat-transcript.tsx",
          "apps/web/src/components/chat-document-gate.tsx",
          "apps/web/src/components/document-attachment-list.tsx",
          "apps/web/src/components/process-chat-milestone-card.tsx",
          "apps/web/src/components/process-tracker.tsx",
          "apps/web/src/components/process-confirmation-actions.tsx",
        ].map((file) => readFile(join(process.cwd(), file), "utf8")),
      );
    expect(transcript).toContain("classifyChatMilestone");
    expect(transcript).toContain("ChatMentionToken");
    expect(transcript).toContain("scrollAnchor={");
    expect(transcript).toContain('milestone === "confirmation"');
    expect(transcript).toContain(
      'message.metadata?.action === "analyze_documents"',
    );
    expect(gate).toContain("DocumentAttachmentList");
    expect(attachments).toContain('mode: "selectable"');
    expect(attachments).toContain('mode: "readonly"');
    expect(attachments).toContain("Collapsible");
    expect(attachments).toContain("1 weitere Unterlage anzeigen");
    expect(attachments).toContain(
      "`${additionalUploads.length} weitere Unterlagen anzeigen`",
    );
    expect(attachments).toContain("visibleUploadCount = 3");
    expect(attachments).toContain("Ausgewertet");
    expect(attachments).toContain("Teilweise ausgewertet");
    expect(attachments).toContain("Nicht auswertbar");
    expect(attachments).toContain("Noch nicht ausgewertet");
    expect(attachments).toContain("Wird ausgewertet …");
    expect(attachments).toContain("getAttachmentCoveragePresentation");
    expect(attachments).toContain('className="flex items-center gap-2 p-3"');
    expect(attachments).toContain('"size-9 shrink-0 text-primary"');
    expect(attachments).not.toContain("coveragePresentation.limitation &&");
    expect(attachments).toContain("title={upload.name}");
    expect(attachments).toContain("max-w-full truncate text-left");
    expect(attachments).toContain("Vorschau öffnen");
    expect(cards).toContain("coverageByUploadId");
    expect(transcript).toContain("documentCoverage");
    expect(transcript).toContain("processingDocuments");
    expect(cards).toContain("Prozesserfassung");
    expect(cards).toContain("Verwendete Unterlagen");
    expect(cards).toContain("Prozess bestätigt");
    expect(cards).toContain("KI-Potenziale ansehen");
    expect(page).toContain("focusedTarget={focusedTarget}");
    expect(page).toContain("!confirmed && (");
    expect(page).toContain('<footer className="border-t p-4"');
    expect(tracker).toContain("onConfirm && (");
    expect(actions).not.toContain("processId");
    expect(actions).not.toContain("confirmed");
  });
});
