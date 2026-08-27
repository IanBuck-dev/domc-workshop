import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { ArrowDown, ChevronsRight } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { ChatCaptureTutorial } from "../components/chat-capture-tutorial";
import { DemoSidecar } from "../components/demo-sidecar";
import { DocumentPreviewDialog } from "../components/document-preview-dialog";
import { ProcessChatComposer } from "../components/process-chat-composer";
import {
  ProcessChatTranscript,
  ProcessChatTranscriptSkeleton,
} from "../components/process-chat-transcript";
import type { ProcessChatMessageMetadata } from "../components/process-chat-transcript";
import {
  isChatMentionTargetAvailable,
  type ChatMentionTarget,
} from "../components/chat-mention";
import { ProcessConfirmationActions } from "../components/process-confirmation-actions";
import {
  ProcessFlowDiagram,
  ProcessFlowDiagramSkeleton,
} from "../components/process-flow-diagram";
import {
  ProcessTracker,
  ProcessTrackerSkeleton,
} from "../components/process-tracker";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "../components/ui/message-scroller";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import { api, ApiError } from "../lib/api-client";
import { useProcessChanged } from "../lib/process-events";
import {
  chatTutorialCompleted,
  completeChatTutorial,
} from "../lib/chat-tutorial-preference";
import {
  chatActivityEventSchema,
  chatUnderstandingEventSchema,
  type ChatActivityKind,
  type ChatMention,
  type ChatTranscriptEvent,
  type ChatUnderstandingEvent,
  type ProcessUnderstanding,
  type UploadRecord,
} from "../lib/process-types";

type View = {
  cover: { processName: string; department: string };
  processState: "capture_in_progress" | "confirmed";
  state: {
    documentGate: "pending" | "documents_selected" | "skipped";
    selectedUploadIds: string[];
    lastTurnOutcome: "completed" | "failed" | "aborted" | null;
    lastValidRevision?: string | null;
  };
  transcript: ChatTranscriptEvent[];
  uploads: UploadRecord[];
  understanding: ProcessUnderstanding | null;
  understandingStatus: "missing" | "invalid" | "valid";
  confirmationAllowed: boolean;
  confirmationQuality: "complete" | "with_gaps" | null;
  activeTurn: {
    turnId: string;
    action: "message" | "analyze_documents";
    kind: ChatActivityKind | null;
    startedAt: string;
  } | null;
};
type ProcessChatUIMessage = UIMessage<
  ProcessChatMessageMetadata,
  {
    "chat-activity": ReturnType<typeof chatActivityEventSchema.parse>;
    "understanding-state": ReturnType<
      typeof chatUnderstandingEventSchema.parse
    >;
  }
>;
const desktopQuery = "(min-width: 1280px)";

function useDesktop() {
  const [desktop, setDesktop] = useState(
    () => window.matchMedia(desktopQuery).matches,
  );
  useEffect(() => {
    const media = window.matchMedia(desktopQuery);
    const update = () => setDesktop(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return desktop;
}
function transcriptMessages(
  transcript: ChatTranscriptEvent[],
): ProcessChatUIMessage[] {
  return transcript.map((event) => ({
    id: event.id,
    role: event.role,
    parts: [{ type: "text", text: event.text }],
    metadata: {
      action: event.action,
      status: event.status,
      mentions: event.mentions,
    },
  }));
}
function messageText(message: UIMessage) {
  return message.parts
    .filter(
      (part): part is Extract<typeof part, { type: "text" }> =>
        part.type === "text",
    )
    .map((part) => part.text)
    .join("");
}
function mentionKey(mention: ChatMention) {
  return mention.kind === "node"
    ? `node:${mention.nodeId}`
    : `edge:${mention.edgeId}`;
}
function snapshotMention(
  mention: ChatMention,
  understanding: ProcessUnderstanding | null,
  revision: string | null | undefined,
): ChatMention {
  const node =
    mention.kind === "node"
      ? understanding?.flow.nodes.find((item) => item.id === mention.nodeId)
      : undefined;
  const edge =
    mention.kind === "edge"
      ? understanding?.flow.edges.find((item) => item.id === mention.edgeId)
      : undefined;
  return {
    ...mention,
    nameSnapshot:
      (node?.kind === "step"
        ? understanding?.steps.find((step) => step.id === node.stepId)?.name
        : node?.kind === "gateway"
          ? node.question
          : edge?.label) ?? null,
    understandingRevision: revision ?? null,
  };
}

export function ProcessChatPage() {
  const { id = "" } = useParams();
  const desktop = useDesktop();
  const [view, setView] = useState<View | null>(null);
  const [text, setText] = useState("");
  const [mentions, setMentions] = useState<ChatMention[]>([]);
  const [turnUploadIds, setTurnUploadIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [tutorial, setTutorial] = useState(!chatTutorialCompleted());
  const [tab, setTab] = useState<"chat" | "diagram">("chat");
  const [expanded, setExpanded] = useState(false);
  const [diagramUnread, setDiagramUnread] = useState(false);
  const [streamActivity, setStreamActivity] = useState<ChatActivityKind | null>(
    null,
  );
  const [overrideData, setOverrideData] = useState<{
    knowledgeGaps: string[];
    conflicts: string[];
  } | null>(null);
  const [preview, setPreview] = useState<UploadRecord | null>(null);
  const [focusedTarget, setFocusedTarget] = useState<ChatMentionTarget | null>(
    null,
  );
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const composerSurfaceRef = useRef<HTMLDivElement | null>(null);
  const workspaceRef = useRef<HTMLElement | null>(null);
  const tabRef = useRef(tab);
  const setMessagesRef = useRef<(messages: ProcessChatUIMessage[]) => void>(
    () => {},
  );
  const lastRevision = useRef<string | null>(null);
  const transport = useMemo(
    () =>
      new DefaultChatTransport<ProcessChatUIMessage>({
        api: `/api/processes/${encodeURIComponent(id)}/chat`,
        prepareSendMessagesRequest({ messages, body }) {
          const latest = messages.at(-1);
          return {
            body: {
              id: latest?.id,
              text: latest ? messageText(latest) : "",
              action: body?.action,
              selectedUploadIds: body?.selectedUploadIds ?? [],
              mentions: body?.mentions ?? [],
            },
          };
        },
      }),
    [id],
  );
  // Schleuse: höchstens ein Nachlauf gleichzeitig. Trifft ein Aufruf ein,
  // während einer läuft, wird er nicht gestartet, sondern als Nachlauf-Marke
  // vorgemerkt — das `syncMessages`-Flag der wartenden Aufrufe wird dabei
  // verodert, damit ein Transkript-Abgleich nicht verloren geht. Nach dem
  // Ende läuft die Marke genau einmal nach. Refs statt State, damit die
  // Schleuse selbst kein Rendern auslöst (siehe Ticket 006).
  const reloadRunning = useRef(false);
  const reloadPending = useRef<{ syncMessages: boolean } | null>(null);
  const reloadView = useCallback(
    async ({ syncMessages }: { syncMessages: boolean }) => {
      if (reloadRunning.current) {
        reloadPending.current = {
          syncMessages:
            (reloadPending.current?.syncMessages ?? false) || syncMessages,
        };
        return;
      }
      reloadRunning.current = true;
      try {
        const data = (await api.chat(id)) as View;
        setView((current) => {
          const revision = data.state.lastValidRevision ?? null;
          if (
            current &&
            revision &&
            revision !== lastRevision.current &&
            tabRef.current !== "diagram"
          )
            setDiagramUnread(true);
          lastRevision.current = revision;
          return data;
        });
        if (syncMessages)
          setMessagesRef.current(transcriptMessages(data.transcript));
      } catch (reason) {
        setError((reason as Error).message);
      } finally {
        reloadRunning.current = false;
        const pending = reloadPending.current;
        if (pending) {
          reloadPending.current = null;
          void reloadView(pending);
        }
      }
    },
    [id],
  );
  const syncTranscript = useCallback(
    () => void reloadView({ syncMessages: true }),
    [reloadView],
  );
  const chat = useChat<ProcessChatUIMessage>({
    id: `capture-${id}`,
    transport,
    resume: false,
    onError(reason) {
      setStreamActivity(null);
      setError(reason.message);
      syncTranscript();
    },
    onData(part) {
      if (part.type === "data-chat-activity") {
        const parsed = chatActivityEventSchema.safeParse(part.data);
        if (parsed.success)
          setStreamActivity(
            parsed.data.state === "active" ? parsed.data.kind : null,
          );
        return;
      }
      if (part.type === "data-understanding-state") {
        const parsed = chatUnderstandingEventSchema.safeParse(part.data);
        if (!parsed.success) return;
        const event: ChatUnderstandingEvent = parsed.data;
        if (
          event.status === "valid" &&
          event.revision &&
          event.revision !== lastRevision.current
        ) {
          lastRevision.current = event.revision;
          if (tab !== "diagram") setDiagramUnread(true);
          void reloadView({ syncMessages: false });
        }
      }
    },
    onFinish() {
      setStreamActivity(null);
      syncTranscript();
    },
  });
  setMessagesRef.current = chat.setMessages;
  // Ein Zug läuft serverseitig weiter, auch wenn diese Seite ihn nicht selbst
  // angestoßen hat (Neuladen, zweiter Tab). `activeTurn` hält die Oberfläche
  // deshalb genauso beschäftigt wie der eigene Strom.
  const busy =
    chat.status === "submitted" ||
    chat.status === "streaming" ||
    Boolean(view?.activeTurn);
  // Der Server meldet jede Änderung an diesem Prozess — Zugstart (Schleuse
  // wechselt, Composer erscheint) ebenso wie Zugende (Antwort im Transkript).
  useProcessChanged(id, () =>
    // Während der eigene Strom läuft, nur den Zustand nachziehen: das
    // Transkript würde die gerade eintreffende Antwort überschreiben.
    reloadView({
      syncMessages: chat.status !== "streaming" && chat.status !== "submitted",
    }).catch(() => undefined),
  );
  useEffect(() => {
    tabRef.current = tab;
  }, [tab]);
  useEffect(() => {
    if (chat.status === "ready" || chat.status === "error") {
      setStreamActivity(null);
      // The process-change event can arrive just before the stream reaches its
      // terminal status. Refresh again here so a failed provider turn cannot
      // leave a stale `activeTurn` locking the composer.
      void reloadView({ syncMessages: true });
    }
  }, [chat.status, reloadView]);
  useEffect(() => {
    if (!desktop) setExpanded(false);
  }, [desktop]);
  useEffect(() => {
    if (
      focusedTarget &&
      !isChatMentionTargetAvailable(focusedTarget, view?.understanding ?? null)
    )
      setFocusedTarget(null);
  }, [focusedTarget, view?.understanding]);
  useEffect(() => {
    const workspace = workspaceRef.current;
    const surface = composerSurfaceRef.current;
    if (!workspace) return;
    if (!surface) {
      workspace.style.removeProperty("--chat-composer-height");
      return;
    }
    const update = () =>
      workspace.style.setProperty(
        "--chat-composer-height",
        `${surface.offsetHeight}px`,
      );
    const observer = new ResizeObserver(update);
    observer.observe(surface);
    update();
    return () => {
      observer.disconnect();
      workspace.style.removeProperty("--chat-composer-height");
    };
  }, [desktop, tab, view?.state.documentGate, view?.processState]);
  const addMention = useCallback(
    (mention: ChatMention) => {
      const snapshot = snapshotMention(
        mention,
        view?.understanding ?? null,
        view?.state.lastValidRevision,
      );
      setMentions((current) =>
        current.some((item) => mentionKey(item) === mentionKey(snapshot)) ||
        current.length >= 5
          ? current
          : [...current, snapshot],
      );
      setTab("chat");
      requestAnimationFrame(() => composerRef.current?.focus());
    },
    [view?.state.lastValidRevision, view?.understanding],
  );
  async function stopTurn() {
    try {
      await api.stopChatTurn(id);
    } catch {
      // Ist der Zug bereits fertig, gibt es nichts mehr zu stoppen.
    }
    chat.stop();
    await reloadView({ syncMessages: true });
  }
  // Der Verzicht auf Unterlagen ist kein KI-Zug, sondern ein fester
  // Zustandswechsel mit fester Rückfrage — deshalb kein Strom, kein „Denkt
  // nach …", und der Composer steht sofort bereit.
  async function skipDocuments() {
    if (busy) return;
    setError("");
    try {
      await api.skipChatDocuments(id, crypto.randomUUID());
      await reloadView({ syncMessages: true });
      requestAnimationFrame(() => composerRef.current?.focus());
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Der Vorgang konnte nicht fortgesetzt werden.",
      );
    }
  }
  async function send(action: "message" | "analyze_documents") {
    if (busy) return;
    setError("");
    const content =
      action === "analyze_documents"
        ? "Bitte werten Sie die ausgewählten Unterlagen aus."
        : text.trim();
    if (!content) return;
    setText("");
    const sentMentions = mentions;
    setMentions([]);
    try {
      await chat.sendMessage(
        {
          id: crypto.randomUUID(),
          role: "user",
          parts: [{ type: "text", text: content }],
          metadata: {
            action,
            status: "complete",
            mentions: sentMentions,
          },
        },
        {
          body: {
            action,
            selectedUploadIds:
              action === "analyze_documents"
                ? (view?.uploads.map((upload) => upload.id) ?? [])
                : turnUploadIds,
            mentions: sentMentions,
          },
        },
      );
      // Auch die Schleuse verbraucht ihre Anhänge: Sie schickt ohnehin alle
      // Uploads mit, im Composer darf danach kein Rest-Chip hängen bleiben.
      setTurnUploadIds([]);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Die Nachricht konnte nicht gesendet werden.",
      );
      throw reason;
    }
  }
  async function uploadFile(file: File) {
    try {
      const upload = await api.upload(id, file);
      setView((current) =>
        current
          ? { ...current, uploads: [...current.uploads, upload] }
          : current,
      );
      setTurnUploadIds((current) => [...current, upload.id]);
    } catch (reason) {
      setError((reason as Error).message);
    }
  }
  async function confirm(override = false) {
    try {
      await api.confirmChat(id, override);
      setOverrideData(null);
      await reloadView({ syncMessages: true });
    } catch (reason) {
      if (
        reason instanceof ApiError &&
        reason.code === "confirmation_override_required"
      ) {
        const body = reason.body as {
          knowledgeGaps?: string[];
          conflicts?: string[];
        };
        setOverrideData({
          knowledgeGaps: body.knowledgeGaps ?? [],
          conflicts: body.conflicts ?? [],
        });
      } else setError((reason as Error).message);
    }
  }
  // `useDesktop()` liest `window.matchMedia` synchron — die Layoutbreite
  // steht damit schon vor den Daten fest. Die komplette Hülle zeichnet sich
  // deshalb sofort; nur die datenabhängigen Flächen unten bekommen ein
  // Skelett, `view` bleibt bis dahin optional.
  const confirmed = view?.processState === "confirmed";
  // Nach einem Neuladen kommt der Stand nicht mehr aus dem eigenen Strom,
  // sondern aus dem laufenden Zug auf dem Server.
  const activity = streamActivity ?? view?.activeTurn?.kind ?? null;
  const activityLabel = !busy
    ? null
    : activity === "reading_documents"
      ? "Unterlagen werden ausgewertet …"
      : activity === "updating_diagram"
        ? "Prozessbild wird aktualisiert …"
        : activity === "checking_open_points"
          ? "Offene Punkte werden geprüft …"
          : "Denkt nach …";
  const chatClass =
    desktop && expanded
      ? "col-start-1 col-span-4 px-4 sm:px-6"
      : desktop
        ? "col-span-12 mx-auto w-5/12 max-w-3xl px-4 sm:px-6"
        : "col-span-12 px-4 sm:px-6";
  const transcript = view ? (
    <ProcessChatTranscript
      messages={chat.messages}
      busy={busy}
      activity={activityLabel}
      processingDocuments={busy && activity === "reading_documents"}
      chatClassName={chatClass}
      processId={id}
      understanding={view.understanding}
      selectedUploads={view.uploads.filter((upload) =>
        view.state.selectedUploadIds.includes(upload.id),
      )}
      missingSelectedCount={
        view.state.selectedUploadIds.filter(
          (uploadId) => !view.uploads.some((upload) => upload.id === uploadId),
        ).length
      }
      onPreview={setPreview}
      onActivateMention={(target) => {
        setFocusedTarget(target);
        if (!desktop) {
          setTab("diagram");
          setDiagramUnread(false);
        }
      }}
      documentGate={
        view.state.documentGate === "pending"
          ? {
              processId: id,
              uploads: view.uploads,
              busy,
              onChanged: () => reloadView({ syncMessages: false }),
              onPreview: setPreview,
              onAnalyze: () => send("analyze_documents"),
              onSkip: () => skipDocuments(),
            }
          : undefined
      }
    />
  ) : (
    <ProcessChatTranscriptSkeleton chatClassName={chatClass} />
  );
  return (
    <section
      ref={workspaceRef}
      data-chat-workspace
      className="relative flex h-full min-h-0 flex-col bg-background"
    >
      <ChatCaptureTutorial
        open={tutorial && Boolean(view) && !confirmed}
        onDone={() => {
          completeChatTutorial();
          setTutorial(false);
        }}
      />
      <DocumentPreviewDialog
        processId={id}
        upload={preview}
        onClose={() => setPreview(null)}
      />
      {desktop && view && !confirmed && (
        <DemoSidecar
          processName={view.cover.processName}
          // Solange die Unterlagen-Schleuse offen ist, hilft nur die
          // Dokumentenliste; Antwortvorschläge kommen erst danach.
          stage={view.state.documentGate === "pending" ? "documents" : "chat"}
          // Im erweiterten Prozessbild rückt die Chatspalte an den linken Rand;
          // der Griff läge dann über dem Text.
          suppressed={expanded}
          uploadedFileNames={view.uploads.map((upload) => upload.name)}
          onInsertText={(insertedText) => {
            setText(insertedText);
            requestAnimationFrame(() => composerRef.current?.focus());
          }}
          onUploadFile={uploadFile}
        />
      )}
      <AlertDialog open={Boolean(overrideData)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Trotz offener Punkte bestätigen?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Das Prozessbild kann bestätigt werden, wird dann aber als
              möglicherweise unvollständig gekennzeichnet.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="max-h-56 space-y-3 overflow-auto text-ui">
            {overrideData?.knowledgeGaps.map((gap) => (
              <p key={gap}>• {gap}</p>
            ))}
            {overrideData?.conflicts.map((conflict) => (
              <p key={conflict}>• {conflict}</p>
            ))}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setOverrideData(null)}>
              Weiter prüfen
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirm(true)}>
              Trotzdem bestätigen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <MessageScrollerProvider
        autoScroll
        defaultScrollPosition="last-anchor"
        scrollPreviousItemPeek={64}
      >
        <MessageScroller className="flex-1">
          <MessageScrollerViewport
            className="relative"
            style={{
              scrollPaddingBottom:
                "calc(var(--chat-composer-height, 0px) + 1.5rem)",
            }}
          >
            <div className="grid grid-cols-12 pt-4">
              <header
                className={`${chatClass} mb-4 flex items-end justify-between gap-4`}
              >
                {view ? (
                  <>
                    <div>
                      <p className="text-overline uppercase text-primary">
                        Prozesserfassung · Chat
                      </p>
                      <h1 className="mt-1 text-title">
                        {view.cover.processName}
                      </h1>
                      <p className="text-ui text-muted-foreground">
                        {view.cover.department} · {id}
                      </p>
                    </div>
                    <Badge variant="outline">
                      {view.confirmationQuality === "with_gaps"
                        ? "Mit offenen Punkten bestätigt"
                        : confirmed
                          ? "Abgeschlossen"
                          : busy
                            ? "KI arbeitet …"
                            : "Bereit für Ergänzung"}
                    </Badge>
                  </>
                ) : (
                  <>
                    <div
                      className="space-y-2"
                      role="status"
                      aria-busy="true"
                      aria-label="Gespräch wird geladen"
                    >
                      <span className="sr-only">Gespräch wird geladen</span>
                      <Skeleton className="h-3 w-40" />
                      <Skeleton className="h-6 w-56" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                    <Skeleton className="h-6 w-32 rounded-full" />
                  </>
                )}
              </header>
            </div>
            {desktop ? (
              transcript
            ) : (
              <Tabs
                value={tab}
                activationMode="manual"
                onValueChange={(value) => {
                  if (value === "chat" || value === "diagram") {
                    setTab(value);
                    if (value === "diagram") setDiagramUnread(false);
                  }
                }}
                className="min-h-0"
              >
                <TabsList className="mx-4 mb-3 grid h-10 grid-cols-2">
                  <TabsTrigger value="chat">Gespräch</TabsTrigger>
                  <TabsTrigger value="diagram">
                    Prozessbild
                    <span aria-hidden="true" className="w-2 text-center">
                      {diagramUnread ? "•" : ""}
                    </span>
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="chat" className="m-0">
                  {transcript}
                </TabsContent>
                <TabsContent
                  value="diagram"
                  className="m-0 h-[calc(100dvh-13rem)]"
                >
                  {view ? (
                    <>
                      <ProcessFlowDiagram
                        understanding={view.understanding}
                        status={view.understandingStatus}
                        updating={busy && Boolean(view.understanding)}
                        onMention={confirmed ? undefined : addMention}
                        focusedTarget={focusedTarget}
                      />
                      {!confirmed && (
                        <div className="border-t bg-background p-4">
                          <ProcessConfirmationActions
                            confirmationAllowed={view.confirmationAllowed}
                            busy={busy}
                            label="Prozessbild bestätigen"
                            onConfirm={() => void confirm(false)}
                          />
                        </div>
                      )}
                    </>
                  ) : (
                    <ProcessFlowDiagramSkeleton className="h-full" />
                  )}
                </TabsContent>
              </Tabs>
            )}
          </MessageScrollerViewport>
          <MessageScrollerButton
            aria-label="Zur neuesten Nachricht"
            className={
              desktop && expanded ? "!inset-s-[16.666667%]" : undefined
            }
          >
            <ArrowDown />
            <span className="sr-only">Zur neuesten Nachricht</span>
          </MessageScrollerButton>
          {desktop && (
            <div
              className={`pointer-events-none absolute inset-y-0 right-0 grid w-full grid-cols-12`}
            >
              <div
                className={`pointer-events-auto min-h-0 ${expanded ? "col-start-5 col-span-8" : "col-start-10 col-span-3"}`}
              >
                {!view ? (
                  <ProcessTrackerSkeleton />
                ) : expanded ? (
                  <div className="flex h-full min-h-0 flex-col border-l bg-muted">
                    <header className="flex items-center justify-between border-b px-4 py-3">
                      <div>
                        <h2 className="font-semibold">Prozessbild</h2>
                        <p className="text-caption text-muted-foreground">
                          {busy ? "Wird aktualisiert …" : "Aktueller Stand"}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setExpanded(false)}
                        aria-label="Prozessbild verkleinern"
                      >
                        <ChevronsRight className="size-4" />
                      </Button>
                    </header>
                    <div className="min-h-0 flex-1">
                      <ProcessFlowDiagram
                        understanding={view.understanding}
                        status={view.understandingStatus}
                        updating={busy && Boolean(view.understanding)}
                        onMention={confirmed ? undefined : addMention}
                        focusedTarget={focusedTarget}
                      />
                    </div>
                    {!confirmed && (
                      <footer className="border-t p-4">
                        <ProcessConfirmationActions
                          confirmationAllowed={view.confirmationAllowed}
                          busy={busy}
                          label="Prozessbild bestätigen"
                          onConfirm={() => void confirm(false)}
                        />
                      </footer>
                    )}
                  </div>
                ) : (
                  <ProcessTracker
                    understanding={view.understanding}
                    status={view.understandingStatus}
                    updating={busy}
                    onMention={confirmed ? undefined : addMention}
                    onExpand={() => setExpanded(true)}
                    focusedTarget={focusedTarget}
                    {...(!confirmed
                      ? {
                          confirmationAllowed: view.confirmationAllowed,
                          busy,
                          onConfirm: () => void confirm(false),
                        }
                      : {})}
                  />
                )}
              </div>
            </div>
          )}
          {view &&
            (desktop || tab === "chat") &&
            view.state.documentGate !== "pending" &&
            !confirmed && (
              <div
                ref={composerSurfaceRef}
                className={`absolute bottom-0 z-20 grid w-full grid-cols-12 pointer-events-none`}
              >
                <div className={`pointer-events-auto ${chatClass}`}>
                  <ProcessChatComposer
                    text={text}
                    onText={setText}
                    mentions={mentions}
                    onRemoveMention={(mention) =>
                      setMentions((current) =>
                        current.filter(
                          (item) => mentionKey(item) !== mentionKey(mention),
                        ),
                      )
                    }
                    uploadIds={turnUploadIds}
                    uploads={view.uploads}
                    onRemoveUpload={(uploadId) =>
                      setTurnUploadIds((current) =>
                        current.filter((item) => item !== uploadId),
                      )
                    }
                    busy={busy}
                    error={error}
                    composerRef={composerRef}
                    onSend={() => void send("message").catch(() => {})}
                    // Der Zug läuft im Server, nicht in dieser Verbindung:
                    // Nur ein ausdrücklicher Stopp beendet ihn.
                    onStop={() => void stopTurn()}
                    onUpload={uploadFile}
                  />
                </div>
              </div>
            )}
        </MessageScroller>
      </MessageScrollerProvider>
    </section>
  );
}
