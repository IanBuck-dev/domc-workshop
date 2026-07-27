import { Download, FileText, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api-client";
import type { UploadRecord } from "../lib/process-types";
import { IconButton, buttonClassName } from "./ui/button";
import { Kicker } from "./ui/kicker";

const textTypes = new Set(["text/plain", "text/markdown", "text/csv"]);
const officeTypes = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
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
  const dialog = useRef<HTMLDialogElement>(null);
  const [source, setSource] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!upload || !dialog.current) return;
    if (!dialog.current.open) dialog.current.showModal();
    if (officeTypes.has(upload.mediaType)) return;
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
    <dialog
      ref={dialog}
      className="preview-dialog document-preview-dialog"
      aria-labelledby="document-preview-title"
      onClose={onClose}
    >
      <header>
        <div>
          <Kicker>Unterlage</Kicker>
          <h2 id="document-preview-title">{upload.name}</h2>
          <small>
            {friendlyType(upload.mediaType)} · {formatBytes(upload.size)}
          </small>
        </div>
        <IconButton
          label="Vorschau schließen"
          onClick={() => dialog.current?.close()}
        >
          <X />
        </IconButton>
      </header>
      <div
        className="preview-dialog-content document-preview-content"
        aria-live="polite"
      >
        {office && (
          <div className="document-preview-fallback">
            <FileText />
            <h3>Vorschau nicht verfügbar</h3>
            <p>
              Word- und Excel-Dateien können in diesem Prototyp nicht direkt
              angezeigt werden. Laden Sie die Originaldatei zum Öffnen herunter.
            </p>
          </div>
        )}
        {!office && loading && <p>Datei wird geladen …</p>}
        {!office && error && <p className="error-banner">{error}</p>}
        {!office && text !== null && (
          <pre className="document-text-preview">{text}</pre>
        )}
        {!office && source && upload.mediaType === "application/pdf" && (
          <iframe src={source} title={`Vorschau von ${upload.name}`} />
        )}
        {!office && source && upload.mediaType.startsWith("image/") && (
          <img src={source} alt={`Vorschau von ${upload.name}`} />
        )}
      </div>
      <footer>
        <a
          className={buttonClassName()}
          href={api.uploadDownloadUrl(processId, upload.id)}
          download={upload.name}
        >
          <Download /> Originaldatei herunterladen
        </a>
      </footer>
    </dialog>
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
  return "Office-Datei";
}
