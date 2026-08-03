import { FormEvent, RefObject } from "react";
import { Paperclip, Send, Square, X } from "lucide-react";
import type { ChatMention, UploadRecord } from "../lib/process-types";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";

export function ProcessChatComposer({
  text,
  onText,
  mentions,
  onRemoveMention,
  uploadIds,
  uploads,
  onRemoveUpload,
  busy,
  error,
  composerRef,
  onSend,
  onStop,
  onUpload,
}: {
  text: string;
  onText: (value: string) => void;
  mentions: ChatMention[];
  onRemoveMention: (mention: ChatMention) => void;
  uploadIds: string[];
  uploads: UploadRecord[];
  onRemoveUpload: (id: string) => void;
  busy: boolean;
  error: string;
  composerRef: RefObject<HTMLTextAreaElement | null>;
  onSend: () => void;
  onStop: () => void;
  onUpload: (file: File) => Promise<void>;
}) {
  const key = (mention: ChatMention) =>
    mention.kind === "step"
      ? `step:${mention.stepId}`
      : `transition:${mention.fromStepId}:${mention.toStepId}`;
  return (
    <form
      className="border-t bg-background p-4"
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        onSend();
      }}
    >
      {mentions.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {mentions.map((mention) => (
            <button
              type="button"
              key={key(mention)}
              className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-1 text-caption"
              onClick={() => onRemoveMention(mention)}
            >
              @{mention.label}
              <X className="size-3" />
            </button>
          ))}
        </div>
      )}
      {uploadIds.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {uploadIds.map((id) => (
            <button
              type="button"
              key={id}
              className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-1 text-caption"
              onClick={() => onRemoveUpload(id)}
            >
              {uploads.find((upload) => upload.id === id)?.name ?? "Unterlage"}
              <X className="size-3" />
            </button>
          ))}
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
            disabled={busy || uploads.length >= 5}
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (file) await onUpload(file);
              event.target.value = "";
            }}
          />
        </label>
        <Textarea
          ref={composerRef}
          id="chat-composer"
          value={text}
          placeholder="Antwort oder Korrektur beschreiben …"
          rows={3}
          disabled={busy}
          onChange={(event) => onText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              if (text.trim()) onSend();
            }
          }}
        />
        {busy ? (
          <Button type="button" variant="outline" onClick={onStop}>
            <Square className="size-4" />
            Stoppen
          </Button>
        ) : (
          <Button type="submit" disabled={!text.trim()}>
            <Send className="size-4" />
            Senden
          </Button>
        )}
      </div>
      {error && <p className="mt-2 text-ui text-destructive">{error}</p>}
    </form>
  );
}
