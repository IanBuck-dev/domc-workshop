import ReactMarkdown from "react-markdown";
import type { UIMessage } from "ai";
import type {
  ChatMention,
  ProcessUnderstanding,
  UploadRecord,
} from "../lib/process-types";
import {
  ChatMentionToken,
  resolveChatMention,
  type ChatMentionTarget,
} from "./chat-mention";
import { ChatDocumentGate } from "./chat-document-gate";
import {
  CompletionProcessChatMilestoneCard,
  InitialProcessChatMilestoneCard,
} from "./process-chat-milestone-card";
import { Message, MessageContent } from "./ui/message";
import { Marker, MarkerContent, MarkerIcon } from "./ui/marker";
import { Skeleton } from "./ui/skeleton";
import { Spinner } from "./ui/spinner";
import {
  MessageScrollerContent,
  MessageScrollerItem,
} from "./ui/message-scroller";

export type ProcessChatMessageMetadata = {
  action:
    | "initial"
    | "message"
    | "analyze_documents"
    | "skip_documents"
    | "confirmation";
  status: "complete" | "aborted";
  mentions: ChatMention[];
};
export type ProcessChatDisplayMessage = UIMessage<ProcessChatMessageMetadata>;

export function classifyChatMilestone(message: ProcessChatDisplayMessage) {
  const metadata = message.metadata;
  if (message.role !== "assistant" || metadata?.status !== "complete")
    return null;
  return metadata.action === "initial" || metadata.action === "confirmation"
    ? metadata.action
    : null;
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

export function withoutLegacyMentionPrefix(
  text: string,
  mentions: ChatMention[],
) {
  let remainder = text;
  for (const mention of mentions) {
    const prefix = `@${mention.label}`;
    if (
      remainder.startsWith(prefix) &&
      (remainder.length === prefix.length ||
        /^\s/u.test(remainder[prefix.length]!))
    )
      remainder = remainder.slice(prefix.length).replace(/^\s+/u, "");
  }
  return remainder;
}

export function ProcessChatTranscriptSkeleton({
  chatClassName,
}: {
  chatClassName: string;
}) {
  return (
    <MessageScrollerContent
      role="status"
      aria-busy="true"
      aria-label="Gespräch wird geladen"
      className="gap-6 pb-[calc(var(--chat-composer-height,0px)+1.5rem)] pt-2"
    >
      <span className="sr-only">Gespräch wird geladen</span>
      {[
        { align: "start", width: "w-3/4" },
        { align: "end", width: "w-1/2" },
        { align: "start", width: "w-2/3" },
      ].map((bubble, index) => (
        <MessageScrollerItem key={index} className="grid grid-cols-12">
          <div className={chatClassName}>
            <div
              className={`flex flex-col gap-2 ${bubble.align === "end" ? "items-end" : "items-start"}`}
            >
              <Skeleton className={`h-4 ${bubble.width}`} />
              <Skeleton
                className={`h-4 ${bubble.align === "end" ? "w-1/3" : "w-1/2"}`}
              />
            </div>
          </div>
        </MessageScrollerItem>
      ))}
    </MessageScrollerContent>
  );
}

export function ProcessChatTranscript({
  messages,
  busy,
  activity,
  processingDocuments,
  chatClassName,
  processId,
  understanding,
  selectedUploads,
  missingSelectedCount,
  documentGate,
  onPreview,
  onActivateMention,
}: {
  messages: ProcessChatDisplayMessage[];
  busy: boolean;
  activity: string | null;
  processingDocuments: boolean;
  chatClassName: string;
  processId: string;
  understanding: ProcessUnderstanding | null;
  selectedUploads: UploadRecord[];
  missingSelectedCount: number;
  documentGate?: React.ComponentProps<typeof ChatDocumentGate>;
  onPreview: (upload: UploadRecord) => void;
  onActivateMention: (target: ChatMentionTarget) => void;
}) {
  const visibleMessages = messages.filter(
    (message) =>
      !(
        message.role === "user" &&
        (message.metadata?.action === "analyze_documents" ||
          message.metadata?.action === "skip_documents")
      ),
  );
  const coverageByUploadId = Object.fromEntries(
    (understanding?.documentCoverage ?? []).map((coverage) => [
      coverage.uploadId,
      coverage,
    ]),
  );
  return (
    <MessageScrollerContent
      role="log"
      aria-busy={busy}
      className="gap-6 pb-[calc(var(--chat-composer-height,0px)+1.5rem)] pt-2"
    >
      {visibleMessages.map((message) => {
        const milestone = classifyChatMilestone(message);
        const mentions = message.metadata?.mentions ?? [];
        const text = withoutLegacyMentionPrefix(messageText(message), mentions);
        const initialGate =
          milestone === "initial" && documentGate ? (
            <ChatDocumentGate {...documentGate} />
          ) : undefined;
        return (
          <MessageScrollerItem
            key={message.id}
            scrollAnchor={
              message.role === "user" || milestone === "confirmation"
            }
            className="grid grid-cols-12"
          >
            <div className={chatClassName}>
              {milestone === "initial" ? (
                <InitialProcessChatMilestoneCard
                  text={text}
                  selectedUploads={selectedUploads}
                  missingSelectedCount={missingSelectedCount}
                  onPreview={onPreview}
                  documentGate={initialGate}
                  coverageByUploadId={coverageByUploadId}
                  processing={processingDocuments}
                />
              ) : milestone === "confirmation" ? (
                <CompletionProcessChatMilestoneCard
                  text={text}
                  processId={processId}
                />
              ) : (
                <Message align={message.role === "user" ? "end" : "start"}>
                  <MessageContent
                    className={
                      message.role === "user"
                        ? "max-w-[85%] rounded-xl bg-muted px-4 py-3 text-body text-foreground"
                        : "max-w-full text-body"
                    }
                  >
                    {mentions.length > 0 && (
                      <div className="mb-2 flex flex-wrap gap-1">
                        {mentions.map((mention) => (
                          <ChatMentionToken
                            key={
                              mention.kind === "step"
                                ? mention.stepId
                                : `${mention.fromStepId}:${mention.toStepId}`
                            }
                            mention={mention}
                            resolved={resolveChatMention(
                              mention,
                              understanding,
                            )}
                            onActivate={onActivateMention}
                          />
                        ))}
                      </div>
                    )}
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
                      {text}
                    </ReactMarkdown>
                  </MessageContent>
                </Message>
              )}
            </div>
          </MessageScrollerItem>
        );
      })}
      {activity && (
        <MessageScrollerItem className="grid grid-cols-12">
          <div className={chatClassName}>
            <Marker role="status">
              <MarkerIcon>
                <Spinner aria-hidden="true" />
              </MarkerIcon>
              <MarkerContent>{activity}</MarkerContent>
            </Marker>
          </div>
        </MessageScrollerItem>
      )}
    </MessageScrollerContent>
  );
}
