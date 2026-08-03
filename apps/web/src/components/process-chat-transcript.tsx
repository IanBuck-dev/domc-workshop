import ReactMarkdown from "react-markdown";
import type { UIMessage } from "ai";
import { Message, MessageContent } from "./ui/message";
import { Marker, MarkerContent, MarkerIcon } from "./ui/marker";
import { Spinner } from "./ui/spinner";
import {
  MessageScrollerContent,
  MessageScrollerItem,
} from "./ui/message-scroller";

function messageText(message: UIMessage) {
  return message.parts
    .filter(
      (part): part is Extract<typeof part, { type: "text" }> =>
        part.type === "text",
    )
    .map((part) => part.text)
    .join("");
}

export function ProcessChatTranscript({
  messages,
  busy,
  activity,
  children,
  chatClassName,
}: {
  messages: UIMessage[];
  busy: boolean;
  activity: string | null;
  children?: React.ReactNode;
  chatClassName: string;
}) {
  return (
    <MessageScrollerContent
      role="log"
      aria-busy={busy}
      className="gap-6 pb-[calc(var(--chat-composer-height,0px)+1.5rem)] pt-2"
    >
      {messages.map((message) => (
        <MessageScrollerItem
          key={message.id}
          scrollAnchor={message.role === "user"}
          className="grid grid-cols-12"
        >
          <div className={chatClassName}>
            <Message align={message.role === "user" ? "end" : "start"}>
              <MessageContent
                className={
                  message.role === "user"
                    ? "max-w-[85%] rounded-xl bg-muted px-3 py-2 text-foreground"
                    : "max-w-full text-base leading-7"
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
              </MessageContent>
            </Message>
          </div>
        </MessageScrollerItem>
      ))}
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
      {children && (
        <MessageScrollerItem className="grid grid-cols-12">
          <div className={chatClassName}>{children}</div>
        </MessageScrollerItem>
      )}
    </MessageScrollerContent>
  );
}
