import { Download, FileText } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../lib/api-client";
import type { UploadRecord } from "../lib/process-types";
import { buttonVariants } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Skeleton } from "./ui/skeleton";

const textTypes = new Set(["text/plain", "text/markdown", "text/csv"]);
const officeTypes = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/zip",
]);

export function DocumentPreviewDialog({
  processId,
  upload,
  onClose,
}: {
  processId: string;
  upload: UploadRecord | null;
  onClose: () => void;
}) {
  const [source, setSource] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!upload || officeTypes.has(upload.mediaType)) return;
    let active = true;
    let objectUrl: string | null = null;
    setLoading(true);
    setError("");
    setSource(null);
    setText(null);
    api
      .uploadBlob(processId, upload.id)
      .then(async (blob) => {
        if (!active) return;
        if (textTypes.has(upload.mediaType)) {
          const nextText = await blob.text();
          if (active) setText(nextText);
        } else {
          objectUrl = URL.createObjectURL(blob);
          setSource(objectUrl);
        }
      })
      .catch((reason: Error) => active && setError(reason.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [processId, upload]);

  if (!upload) return null;
  const office = officeTypes.has(upload.mediaType);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <p className="text-eyebrow uppercase text-primary">Unterlage</p>
          <DialogTitle>{upload.name}</DialogTitle>
          <DialogDescription>
            {friendlyType(upload.mediaType)} · {formatBytes(upload.size)}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-56 space-y-4" aria-live="polite">
          {office && (
            <div className="grid place-items-center gap-3 rounded-lg bg-muted p-8 text-center">
              <FileText className="size-8 text-primary" />
              <h3 className="font-semibold">Vorschau nicht verfügbar</h3>
              <p className="max-w-lg text-ui text-muted-foreground">
                Word-, PowerPoint- und Excel-Dateien können in diesem Prototyp
                nicht direkt angezeigt werden. Laden Sie die Originaldatei zum
                Öffnen herunter.
              </p>
            </div>
          )}
          {!office && loading && (
            <div
              className="space-y-3"
              role="status"
              aria-busy="true"
              aria-label="Datei wird geladen"
            >
              <span className="sr-only">Datei wird geladen</span>
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-48 w-full rounded-md" />
            </div>
          )}
          {!office && error && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-ui text-destructive">
              {error}
            </p>
          )}
          {!office && text !== null && (
            <pre className="max-h-[55vh] overflow-auto rounded-md bg-muted p-4 text-left text-caption whitespace-pre-wrap">
              {text}
            </pre>
          )}
          {!office && source && upload.mediaType === "application/pdf" && (
            <iframe
              className="h-[60vh] w-full rounded-md border"
              src={source}
              title={`Vorschau von ${upload.name}`}
            />
          )}
          {!office && source && upload.mediaType.startsWith("image/") && (
            <img
              className="max-h-[60vh] w-full rounded-md object-contain"
              src={source}
              alt={`Vorschau von ${upload.name}`}
            />
          )}
        </div>
        <DialogFooter>
          <a
            className={buttonVariants()}
            href={api.uploadDownloadUrl(processId, upload.id)}
            download={upload.name}
          >
            <Download className="size-4" /> Originaldatei herunterladen
          </a>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} Byte`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
function friendlyType(mediaType: string) {
  if (mediaType === "application/pdf") return "PDF";
  if (mediaType.startsWith("image/")) return "Bild";
  if (mediaType === "text/csv") return "CSV";
  if (mediaType === "text/markdown") return "Markdown";
  if (mediaType === "text/plain") return "Text";
  if (mediaType.includes("wordprocessingml")) return "Word";
  if (mediaType.includes("spreadsheetml")) return "Excel";
  if (mediaType.includes("presentationml")) return "PowerPoint";
  return "Office-Datei";
}
