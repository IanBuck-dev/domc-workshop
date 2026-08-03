import { FileText, Paperclip } from "lucide-react";
import { useState } from "react";
import { api } from "../lib/api-client";
import type { UploadRecord } from "../lib/process-types";
import { DocumentAttachmentList } from "./document-attachment-list";
import { Button } from "./ui/button";

export function ChatDocumentGate({
  processId,
  uploads,
  selected,
  onSelected,
  busy,
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
  onChanged: () => Promise<void> | void;
  onPreview: (upload: UploadRecord) => void;
  onAnalyze: () => Promise<void>;
  onSkip: () => Promise<void>;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const disabled = busy || uploading;
  const report = (reason: unknown, fallback: string) =>
    setError(reason instanceof Error ? reason.message : fallback);
  return (
    <section className="mt-4" aria-labelledby="document-gate-title">
      <div className="flex items-start gap-3">
        <span className="rounded-lg bg-secondary p-2 text-primary">
          <FileText className="size-5" />
        </span>
        <div>
          <p id="document-gate-title" className="font-semibold">
            Unterlagen bereitstellen
          </p>
          <p className="mt-1 text-ui text-muted-foreground">
            Bis zu fünf Arbeitsanweisungen, Präsentationen oder
            Beispieldokumente gemeinsam auswählen.
          </p>
        </div>
      </div>
      {error && (
        <p
          role="alert"
          className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-ui text-destructive"
        >
          {error}
        </p>
      )}
      <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-label hover:bg-muted">
        <Paperclip className="size-4" /> Dateien auswählen
        <input
          className="sr-only"
          type="file"
          multiple
          disabled={disabled || uploads.length >= 5}
          onChange={async (event) => {
            const files = [...(event.target.files ?? [])].slice(
              0,
              5 - uploads.length,
            );
            if (!files.length) return;
            setError("");
            setUploading(true);
            try {
              for (const file of files) await api.upload(processId, file);
              await onChanged();
            } catch (reason) {
              report(reason, "Die Dateien konnten nicht hochgeladen werden.");
            } finally {
              setUploading(false);
              event.target.value = "";
            }
          }}
        />
      </label>
      <DocumentAttachmentList
        mode="selectable"
        uploads={uploads}
        selectedIds={selected}
        disabled={disabled}
        onSelected={onSelected}
        onPreview={onPreview}
        onRemove={(upload) => {
          setError("");
          void api
            .removeUpload(processId, upload.id)
            .then(async () => {
              onSelected(selected.filter((id) => id !== upload.id));
              await onChanged();
            })
            .catch((reason) =>
              report(reason, "Die Datei konnte nicht entfernt werden."),
            );
        }}
      />
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          disabled={disabled || !selected.length}
          onClick={() =>
            void onAnalyze().catch((reason) =>
              report(
                reason,
                "Die Unterlagen konnten nicht ausgewertet werden.",
              ),
            )
          }
        >
          Unterlagen auswerten
        </Button>
        <Button
          variant="outline"
          disabled={disabled}
          onClick={() =>
            void onSkip().catch((reason) =>
              report(reason, "Der Vorgang konnte nicht fortgesetzt werden."),
            )
          }
        >
          Ohne Unterlagen fortfahren
        </Button>
      </div>
    </section>
  );
}
