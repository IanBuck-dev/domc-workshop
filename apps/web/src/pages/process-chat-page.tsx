import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { FileText, Paperclip, Send, Square, X } from "lucide-react";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ReactMarkdown from "react-markdown";
import { Link, useParams } from "react-router-dom";
import { ChatCaptureTutorial } from "../components/chat-capture-tutorial";
import { DocumentPreviewDialog } from "../components/document-preview-dialog";
import { ProcessFlowDiagram } from "../components/process-flow-diagram";
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
import { Card } from "../components/ui/card";
import { Checkbox } from "../components/ui/checkbox";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import { Textarea } from "../components/ui/textarea";
import { api, ApiError } from "../lib/api-client";
import {
  chatTutorialCompleted,
  completeChatTutorial,
} from "../lib/chat-tutorial-preference";
import type {
  ChatMention,
  ChatTranscriptEvent,
  ProcessUnderstanding,
  UploadRecord,
} from "../lib/process-types";

type View = {
  cover: { processName: string; department: string };
  processState: "capture_in_progress" | "confirmed";
  state: {
    documentGate: "pending" | "documents_selected" | "skipped";
    selectedUploadIds: string[];
    lastTurnOutcome: "completed" | "failed" | "aborted" | null;
  };
  transcript: ChatTranscriptEvent[];
  uploads: UploadRecord[];
  understanding: ProcessUnderstanding | null;
  understandingStatus: "missing" | "invalid" | "valid";
  confirmationAllowed: boolean;
  confirmationQuality: "complete" | "with_gaps" | null;
};

const desktopLayoutQuery = "(min-width: 1024px)";

function useDesktopLayout() {
  const [desktop, setDesktop] = useState(
    () => window.matchMedia(desktopLayoutQuery).matches,
  );

  useEffect(() => {
    const media = window.matchMedia(desktopLayoutQuery);
    const update = () => setDesktop(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return desktop;
}

function transcriptMessages(transcript: ChatTranscriptEvent[]): UIMessage[] {
  return transcript.map((event) => {
    const mentionPrefix = event.mentions
      .map((mention) => `@${mention.label}`)
      .join(" ");
    const text =
      mentionPrefix && !event.text.startsWith(`${mentionPrefix}\n`)
        ? `${mentionPrefix}\n${event.text}`
        : event.text;
    return {
      id: event.id,
      role: event.role,
      parts: [{ type: "text" as const, text }],
    };
  });
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

export function ProcessChatPage() {
  const { id = "" } = useParams();
  const [view, setView] = useState<View | null>(null);
  const [text, setText] = useState("");
  const [mentions, setMentions] = useState<ChatMention[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [turnUploadIds, setTurnUploadIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [tutorial, setTutorial] = useState(!chatTutorialCompleted());
  const [tab, setTab] = useState<"chat" | "diagram">("chat");
  const [diagramUnread, setDiagramUnread] = useState(false);
  const [overrideData, setOverrideData] = useState<{
    knowledgeGaps: string[];
    conflicts: string[];
  } | null>(null);
  const [preview, setPreview] = useState<UploadRecord | null>(null);
  const [uploading, setUploading] = useState(false);
  const desktopLayout = useDesktopLayout();
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const lastRevision = useRef<string | null>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport<UIMessage>({
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
  const chat = useChat({
    id: `capture-${id}`,
    transport,
    resume: false,
    onError(reason) {
      setError(reason.message);
    },
  });
  const setChatMessages = chat.setMessages;
  const busy = chat.status === "submitted" || chat.status === "streaming";

  const reload = useCallback(async () => {
    try {
      const data = await api.chat(id);
      setView((current) => {
        const revision = data.state.lastValidRevision;
        if (
          current &&
          revision &&
          revision !== lastRevision.current &&
          tab !== "diagram"
        )
          setDiagramUnread(true);
        lastRevision.current = revision;
        return data as View;
      });
      setSelected((current) =>
        data.state.documentGate === "documents_selected"
          ? data.state.selectedUploadIds
          : current.filter((uploadId) =>
              data.uploads.some((upload) => upload.id === uploadId),
            ),
      );
      setChatMessages(transcriptMessages(data.transcript));
    } catch (reason) {
      setError((reason as Error).message);
    }
  }, [id, tab, setChatMessages]);

  useEffect(() => {
    void reload();
  }, [reload]);
  useEffect(() => {
    if (chat.status === "ready") void reload();
  }, [chat.status, reload]);

  const addMention = useCallback((mention: ChatMention) => {
    setMentions((current) => {
      const key = mentionKey(mention);
      return current.some((item) => mentionKey(item) === key) ||
        current.length >= 5
        ? current
        : [...current, mention];
    });
    setTab("chat");
    requestAnimationFrame(() => composerRef.current?.focus());
  }, []);

  if (!view)
    return <main className="app-loading">Gespräch wird geladen …</main>;

  async function send(
    action: "message" | "analyze_documents" | "skip_documents",
  ) {
    if (busy) return;
    setError("");
    const content =
      action === "skip_documents"
        ? "Ich möchte ohne Unterlagen fortfahren."
        : action === "analyze_documents"
          ? "Bitte werten Sie die ausgewählten Unterlagen aus."
          : text.trim();
    if (!content) return;
    const visible = content;
    setText("");
    const sentMentions = mentions;
    setMentions([]);
    try {
      await chat.sendMessage(
        {
          id: crypto.randomUUID(),
          role: "user",
          parts: [{ type: "text", text: visible }],
        },
        {
          body: {
            action,
            selectedUploadIds:
              action === "skip_documents"
                ? []
                : action === "analyze_documents"
                  ? selected
                  : turnUploadIds,
            mentions: sentMentions,
          },
        },
      );
      if (action === "message") setTurnUploadIds([]);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Die Nachricht konnte nicht gesendet werden.",
      );
    }
  }

  async function confirm(override = false) {
    try {
      await api.confirmChat(id, override);
      setOverrideData(null);
      await reload();
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

  const confirmed = view.processState === "confirmed";
  return (
    <section className="flex min-h-[calc(100vh-4rem)] flex-col bg-muted/20 px-4 py-4 sm:px-6">
      <ChatCaptureTutorial
        open={tutorial && !confirmed}
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
          <div className="max-h-56 space-y-3 overflow-auto text-sm">
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

      <header className="mx-auto mb-4 flex w-full max-w-[1600px] items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
            Prozesserfassung · Chat
          </p>
          <h1 className="mt-1 text-2xl font-bold">{view.cover.processName}</h1>
          <p className="text-sm text-muted-foreground">
            {view.cover.department} · {id}
          </p>
        </div>
        {view.confirmationQuality === "with_gaps" && (
          <Badge variant="outline">Mit offenen Punkten bestätigt</Badge>
        )}
      </header>

      <Tabs
        value={tab}
        activationMode="manual"
        onValueChange={(value) => {
          if (value !== "chat" && value !== "diagram") return;
          setTab(value);
          if (value === "diagram") setDiagramUnread(false);
        }}
        className="mx-auto min-h-0 w-full max-w-[1600px] flex-1"
      >
        <TabsList className="mb-3 grid h-10 w-full grid-cols-2 lg:hidden">
          <TabsTrigger value="chat">Gespräch</TabsTrigger>
          <TabsTrigger value="diagram">
            Prozessbild
            <span aria-hidden="true" className="w-2 text-center">
              {diagramUnread ? "•" : ""}
            </span>
          </TabsTrigger>
        </TabsList>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[42fr_58fr]">
          <TabsContent
            value="chat"
            forceMount={desktopLayout || undefined}
            className="min-h-0 data-[state=inactive]:hidden lg:data-[state=inactive]:block"
          >
            <Card className="h-full min-h-[650px] flex-col overflow-hidden">
              <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-card px-5 py-4">
                <div>
                  <h2 className="font-semibold">Gespräch</h2>
                  <p className="text-xs text-muted-foreground">
                    {busy
                      ? "KI arbeitet …"
                      : confirmed
                        ? "Abgeschlossen"
                        : "Bereit für Ihre Ergänzung"}
                  </p>
                </div>
              </div>
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
                <div className="space-y-3" aria-live="polite">
                  {chat.messages.map((message) => (
                    <article
                      key={message.id}
                      className={
                        message.role === "user"
                          ? "ml-8 rounded-xl bg-primary px-4 py-3 text-primary-foreground"
                          : "mr-8 rounded-xl bg-muted px-4 py-3"
                      }
                    >
                      <ReactMarkdown
                        allowedElements={[
                          "p",
                          "strong",
                          "em",
                          "ul",
                          "ol",
                          "li",
                          "br",
                          "code",
                        ]}
                      >
                        {messageText(message)}
                      </ReactMarkdown>
                    </article>
                  ))}
                  {view.state.documentGate === "pending" && (
                    <DocumentGate
                      processId={id}
                      uploads={view.uploads}
                      selected={selected}
                      onSelected={setSelected}
                      busy={busy || uploading}
                      onUploading={setUploading}
                      onChanged={() => void reload()}
                      onPreview={setPreview}
                      onAnalyze={() => void send("analyze_documents")}
                      onSkip={() => void send("skip_documents")}
                    />
                  )}
                  {view.state.documentGate === "pending" && error && (
                    <p className="text-sm text-destructive">{error}</p>
                  )}
                </div>
              </div>
              {view.state.documentGate !== "pending" && !confirmed && (
                <form
                  className="border-t bg-card p-4"
                  onSubmit={(event: FormEvent) => {
                    event.preventDefault();
                    void send("message");
                  }}
                >
                  {mentions.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-1">
                      {mentions.map((mention) => (
                        <button
                          type="button"
                          key={mentionKey(mention)}
                          className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-1 text-xs"
                          onClick={() =>
                            setMentions((current) =>
                              current.filter(
                                (item) =>
                                  mentionKey(item) !== mentionKey(mention),
                              ),
                            )
                          }
                        >
                          @{mention.label} <X className="size-3" />
                        </button>
                      ))}
                    </div>
                  )}
                  {turnUploadIds.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-1">
                      {turnUploadIds.map((uploadId) => {
                        const upload = view.uploads.find(
                          (item) => item.id === uploadId,
                        );
                        return (
                          <button
                            type="button"
                            key={uploadId}
                            className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-1 text-xs"
                            onClick={() =>
                              setTurnUploadIds((current) =>
                                current.filter((item) => item !== uploadId),
                              )
                            }
                          >
                            {upload?.name ?? "Unterlage"}{" "}
                            <X className="size-3" />
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <div className="flex items-end gap-2">
                    <label
                      className="inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-md border hover:bg-muted"
                      title="Unterlage anhängen"
                    >
                      <Paperclip className="size-4" />
                      <input
                        className="sr-only"
                        type="file"
                        name="chatAttachment"
                        disabled={busy || view.uploads.length >= 5}
                        onChange={async (event) => {
                          const file = event.target.files?.[0];
                          if (!file) return;
                          try {
                            const upload = await api.upload(id, file);
                            setView((current) =>
                              current
                                ? {
                                    ...current,
                                    uploads: [...current.uploads, upload],
                                  }
                                : current,
                            );
                            setTurnUploadIds((current) => [
                              ...current,
                              upload.id,
                            ]);
                          } catch (reason) {
                            setError((reason as Error).message);
                          } finally {
                            event.target.value = "";
                          }
                        }}
                      />
                    </label>
                    <Textarea
                      ref={composerRef}
                      id="chat-composer"
                      name="message"
                      value={text}
                      placeholder="Antwort oder Korrektur beschreiben …"
                      rows={3}
                      disabled={busy}
                      onChange={(event) => setText(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          if (text.trim()) void send("message");
                        }
                      }}
                    />
                    {busy ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void chat.stop()}
                      >
                        <Square className="size-4" /> Stoppen
                      </Button>
                    ) : (
                      <Button type="submit" disabled={!text.trim()}>
                        <Send className="size-4" /> Senden
                      </Button>
                    )}
                  </div>
                  {error && (
                    <p className="mt-2 text-sm text-destructive">{error}</p>
                  )}
                </form>
              )}
            </Card>
          </TabsContent>

          <TabsContent
            value="diagram"
            forceMount={desktopLayout || undefined}
            className="min-h-0 data-[state=inactive]:hidden lg:data-[state=inactive]:block"
          >
            <Card className="h-full min-h-[650px] flex-col overflow-hidden">
              <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-card px-5 py-4">
                <div>
                  <h2 className="font-semibold">Prozessbild</h2>
                  <p className="text-xs text-muted-foreground">
                    {confirmed
                      ? "Fachlich bestätigt"
                      : busy
                        ? "Wird aktualisiert …"
                        : view.understandingStatus === "valid"
                          ? "Aktueller Stand"
                          : "Noch kein gültiger Stand"}
                  </p>
                </div>
              </div>
              <div className="min-h-0 flex-1">
                <ProcessFlowDiagram
                  understanding={view.understanding}
                  status={view.understandingStatus}
                  updating={busy && Boolean(view.understanding)}
                  onMention={confirmed ? undefined : addMention}
                />
              </div>
              <div className="border-t bg-card p-4">
                {confirmed ? (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm">
                      Der Prozess wurde fachlich bestätigt.
                    </p>
                    <div className="flex gap-2">
                      <Button asChild variant="outline">
                        <Link to={`/processes/${id}`}>Zum Prozess</Link>
                      </Button>
                      <Button asChild>
                        <Link to={`/processes/${id}/opportunities`}>
                          KI-Potenziale ansehen
                        </Link>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-xs text-muted-foreground">
                      Bestätigen Sie erst, wenn der Hauptablauf stimmt.
                    </p>
                    <Button
                      disabled={!view.confirmationAllowed || busy}
                      onClick={() => void confirm(false)}
                    >
                      Prozessbild bestätigen
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          </TabsContent>
        </div>
      </Tabs>
    </section>
  );
}

function DocumentGate({
  processId,
  uploads,
  selected,
  onSelected,
  busy,
  onUploading,
  onChanged,
  onPreview,
  onAnalyze,
  onSkip,
}: {
  processId: string;
  uploads: UploadRecord[];
  selected: string[];
  onSelected: (ids: string[]) => void;
  busy: boolean;
  onUploading: (value: boolean) => void;
  onChanged: () => void;
  onPreview: (upload: UploadRecord) => void;
  onAnalyze: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="rounded-xl border bg-background p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="rounded-lg bg-secondary p-2 text-primary">
          <FileText className="size-5" />
        </span>
        <div>
          <p className="font-semibold">Unterlagen bereitstellen</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Bis zu fünf Arbeitsanweisungen, Präsentationen oder
            Beispieldokumente gemeinsam auswählen.
          </p>
        </div>
      </div>
      <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted">
        <Paperclip className="size-4" /> Dateien auswählen
        <input
          className="sr-only"
          type="file"
          name="initialDocuments"
          multiple
          disabled={busy || uploads.length >= 5}
          onChange={async (event) => {
            const files = [...(event.target.files ?? [])].slice(
              0,
              5 - uploads.length,
            );
            if (!files.length) return;
            onUploading(true);
            try {
              for (const file of files) await api.upload(processId, file);
              onChanged();
            } finally {
              onUploading(false);
              event.target.value = "";
            }
          }}
        />
      </label>
      {uploads.length > 0 && (
        <div className="mt-3 space-y-2">
          {uploads.map((upload) => (
            <div
              key={upload.id}
              className="flex items-center gap-2 rounded-lg border p-2"
            >
              <Checkbox
                checked={selected.includes(upload.id)}
                onCheckedChange={() =>
                  onSelected(
                    selected.includes(upload.id)
                      ? selected.filter((item) => item !== upload.id)
                      : [...selected, upload.id],
                  )
                }
                aria-label={`${upload.name} auswählen`}
              />
              <button
                type="button"
                className="min-w-0 flex-1 truncate text-left text-sm hover:text-primary hover:underline"
                onClick={() => onPreview(upload)}
              >
                {upload.name}
              </button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={busy}
                aria-label={`${upload.name} entfernen`}
                onClick={async () => {
                  await api.removeUpload(processId, upload.id);
                  onSelected(selected.filter((item) => item !== upload.id));
                  onChanged();
                }}
              >
                <X className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button disabled={busy || !selected.length} onClick={onAnalyze}>
          Unterlagen auswerten
        </Button>
        <Button variant="outline" disabled={busy} onClick={onSkip}>
          Ohne Unterlagen fortfahren
        </Button>
      </div>
    </div>
  );
}

function mentionKey(mention: ChatMention) {
  return mention.kind === "step"
    ? `step:${mention.stepId}`
    : `transition:${mention.fromStepId}:${mention.toStepId}`;
}
