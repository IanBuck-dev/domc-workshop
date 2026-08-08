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

  test("renders the persisted Flow graph with real mentions and topological gutter edges", async () => {
    const source = await readFile(
      join(process.cwd(), "apps/web/src/components/process-flow-diagram.tsx"),
      "utf8",
    );
    expect(source).toContain("nodesDraggable={false}");
    expect(source).toContain("nodesConnectable={false}");
    // Höhe wächst mit dem Inhalt, Breite reicht für deutsche Komposita.
    expect(source).toContain("grid min-h-28 w-80 gap-2 overflow-hidden");
    // Nummernkreis so hoch wie die Titelzeile — wie in der schmalen Spalte.
    expect(source).toContain(
      "flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-caption",
    );
    expect(source).toContain(
      'className="line-clamp-3 min-w-0 flex-1 hyphens-auto break-words font-semibold leading-snug"',
    );
    expect(source).toContain(
      'className="line-clamp-3 break-words text-ui text-muted-foreground"',
    );
    expect(source).toContain("title={value.name}");
    expect(source).toContain("title={value.activity}");
    // Dagre bestimmt die vertikale Rangfolge statt fester Y-Abstände.
    expect(source).toContain('layout.setGraph({ rankdir: "TB",');
    expect(source).toContain("dagre.layout(layout)");
    // Ereignisse und Gateways kommen aus dem persistierten Graphen.
    expect(source).toContain("bpmnEvent: EventNode");
    expect(source).toContain("gateway: GatewayNode");
    expect(source).toContain("understanding.flow.nodes.map");
    expect(source).toContain("understanding.flow.edges.map");
    expect(source).toContain("understanding.trigger.value");
    expect(source).toContain("understanding.outcome.value");
    // Die Rückkante führt getrennt durch die linke Gutter-Spalte.
    expect(source).toContain(
      "edgeTypes = { mention: MentionEdge, gutter: GutterEdge }",
    );
    // React Flow setzt die Kantenschicht bei elementsSelectable=false auf none.
    expect(source).toContain('style={{ pointerEvents: "stroke" }}');
    expect(source).toContain('hovered ? "opacity-100" : "opacity-0"');
    expect(source).toContain("setTimeout(() => setHovered(false), 120)");
    expect(source).toContain("position={Position.Top}");
    expect(source).toContain("position={Position.Bottom}");
    expect(source).toContain("MarkerType.ArrowClosed");
    expect(source).toContain('color: "var(--muted-foreground)"');
    expect(source).toContain('position="top-right"');
    expect(source).toContain('className="!right-3 !top-3"');
    expect(source).toContain("nodeOrder(edge.target) < nodeOrder(edge.source)");
    expect(source).toContain("edge.id");
    expect(source).toContain("node.id");
    expect(source).not.toContain("PROTOTYP");
    expect(source).not.toContain("prototypeMention");
    expect(source).toContain("onMention");
    expect(source).toContain("onInspect");
    expect(source).toContain(
      "aria-label={`Schritt ${value.order} im Detail ansehen`}",
    );
    expect(source).toContain("DialogContent");
    // React Flow setzt die Knoten auf pointer-events: none — ohne das hier
    // sind Info- und Erwähnen-Knopf mit der Maus nicht erreichbar.
    expect(source).toContain("pointer-events-auto flex shrink-0 items-center");
    expect(source).toContain("step={inspectStep}");
    expect(source).toContain("flow={understanding!.flow}");
  });

  test("uses the shared branching placeholder in both empty process views", async () => {
    const [placeholder, tracker, diagram] = await Promise.all(
      [
        "apps/web/src/components/process-flow-placeholder.tsx",
        "apps/web/src/components/process-tracker.tsx",
        "apps/web/src/components/process-flow-diagram.tsx",
      ].map((file) => readFile(join(process.cwd(), file), "utf8")),
    );
    expect(tracker).toContain('ProcessFlowPlaceholder variant="narrow"');
    expect(diagram).toContain('ProcessFlowPlaceholder variant="wide"');
    expect(placeholder).toContain('aria-hidden="true"');
    expect(placeholder).toContain("Entscheidung");
    expect(placeholder).toContain('label="Ja"');
    expect(placeholder).toContain('label="Nein"');
    expect(tracker).toContain(
      "Vergleichen Sie das Bild mit dem tatsächlichen Prozess.",
    );
    expect(diagram).toContain(
      "Es erscheint automatisch, sobald ein gültiger Zwischenstand",
    );
    expect(diagram).not.toContain("[0, 1, 2].map");
  });

  test("shows the same step details in the narrow column and the node dialog", async () => {
    const [tracker, details] = await Promise.all(
      [
        "apps/web/src/components/process-tracker.tsx",
        "apps/web/src/components/process-step-details.tsx",
      ].map((file) => readFile(join(process.cwd(), file), "utf8")),
    );
    expect(tracker).toContain("<details");
    expect(tracker).toContain("group-open/step:rotate-180");
    expect(tracker).toContain("[&::-webkit-details-marker]:hidden");
    expect(tracker).toContain("{step.activity}");
    expect(tracker).toContain('layout="compact"');
    expect(tracker).toContain("openStepIds.has(step.id)");
    // Der Nummernkreis ist so hoch wie die Namenszeile, die Aktivität steht
    // darunter, und zwischen den Karten steht nur ein zentrierter Pfeil.
    expect(tracker).toContain(
      "flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-caption",
    );
    expect(tracker).toContain(
      'className="mt-1 line-clamp-2 block text-caption text-muted-foreground"',
    );
    expect(tracker).toContain("<ArrowDown");
    expect(tracker).toContain("gatewayEdges.map");
    expect(tracker).toContain("↺ zurück zu Schritt");
    expect(tracker).toContain("→ weiter");
    expect(tracker).toContain("rounded border bg-card px-2 py-1");
    expect(tracker).not.toContain("h-px flex-1");
    for (const heading of [
      "Input",
      "Output",
      "Informationen",
      "Varianten und Entscheidungen",
      "Sonstiges",
    ])
      expect(details).toContain(heading);
    expect(details).toContain('layout === "compact"');
    expect(details).toContain("informationTypeCopy");
    expect(details).toContain("decisionModeCopy");
    // Die kompakte Spalte darf keine Lesetabelle mit Mindestbreite mitbringen.
    expect(details).not.toContain("min-w-[3");
  });

  test("uses Flow gateway fields in process readers and keeps graph structure fixed", async () => {
    const sources = await Promise.all(
      [
        "apps/web/src/components/process-step-card.tsx",
        "apps/web/src/components/process-step-details.tsx",
        "apps/web/src/components/process-step-decisions.tsx",
        "apps/web/src/components/process-brief.tsx",
        "apps/web/src/components/process-step-delete-dialog.tsx",
      ].map((file) => readFile(join(process.cwd(), file), "utf8")),
    );
    const [card, details, decisions, brief, deleteDialog] = sources;
    expect(card).toContain("flow={flow}");
    expect(details).toContain("gatewayForStep(flow, stepId)");
    expect(decisions).toContain("flow.edges.filter");
    expect(decisions).toContain("Knoten und Kanten bleiben unverändert");
    expect(decisions).not.toContain("Entscheidung hinzufügen");
    expect(brief).toContain("updateFlow");
    expect(brief).toContain("knownNodeIds");
    expect(deleteDialog).toContain("sourceLabel");
    for (const source of sources) {
      expect(source).not.toContain("step.decisions");
      expect(source).not.toContain("nextStepId");
    }
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
    // Nutzerblase und Antwort lesen sich gleich groß — `text-foreground`
    // daneben würde `text-body` durch tailwind-merge verdrängen.
    expect(transcript).toContain(
      '"max-w-[85%] rounded-xl bg-muted px-4 py-3 text-body"',
    );
    expect(transcript).toContain("classifyChatMilestone");
    expect(transcript).toContain("ChatMentionToken");
    expect(transcript).toContain("scrollAnchor={");
    expect(transcript).toContain('milestone === "confirmation"');
    expect(transcript).toContain(
      'message.metadata?.action === "analyze_documents"',
    );
    expect(gate).toContain("DocumentAttachmentList");
    expect(attachments).toContain('mode: "removable"');
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
  test("splits the demo sidecar by capture step and calls suggestions Vorschläge", async () => {
    const sidecar = await readFile(
      join(process.cwd(), "apps/web/src/components/demo-sidecar.tsx"),
      "utf8",
    );
    const page = await readFile(
      join(process.cwd(), "apps/web/src/pages/process-chat-page.tsx"),
      "utf8",
    );
    expect(sidecar).toContain("Vorschläge");
    expect(sidecar).not.toContain(">Züge<");
    expect(sidecar).toContain(
      "Vorschlag ${zug.nummer} in den Composer einfügen",
    );
    expect(sidecar).toContain('stage?: "documents" | "chat"');
    expect(sidecar).toContain('const zeigeVorschlaege = stage !== "documents"');
    expect(sidecar).toContain("offeneDokumente");
    expect(sidecar).toContain("Dieses Szenario nutzt keine Unterlagen.");
    // Im erweiterten Prozessbild darf der Griff nicht über der Chatspalte liegen.
    expect(sidecar).toContain("if (suppressed || !szenarien");
    expect(page).toContain("suppressed={expanded}");
    expect(page).toContain(
      'stage={view.state.documentGate === "pending" ? "documents" : "chat"}',
    );
    expect(page).toContain(
      "uploadedFileNames={view.uploads.map((upload) => upload.name)}",
    );
  });

  test("treats skipping documents and stopping a turn as explicit server actions", async () => {
    const page = await readFile(
      join(process.cwd(), "apps/web/src/pages/process-chat-page.tsx"),
      "utf8",
    );
    const service = await readFile(
      join(process.cwd(), "apps/server/src/chat-capture-service.ts"),
      "utf8",
    );
    expect(page).toContain("api.skipChatDocuments(id, crypto.randomUUID())");
    expect(page).toContain("api.stopChatTurn(id)");
    expect(page).not.toContain('send("skip_documents")');
    expect(page).toContain("Boolean(view?.activeTurn)");
    expect(page).toContain("view?.activeTurn?.kind");
    expect(service).toContain("skipDocumentsAssistantText");
    expect(service).toContain("Was löst den Vorgang aus");
  });
});
