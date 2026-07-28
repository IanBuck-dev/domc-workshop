import { FileText, Paperclip, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { api } from "../lib/api-client";
import type { ProcessCaptureRecord, UploadRecord } from "../lib/process-types";
import { Button, IconButton } from "./ui/button";
import { Kicker } from "./ui/kicker";
import { Card } from "./ui/card";

export function ProcessUploadPicker({
  processId,
  uploads,
  selectedIds,
  disabled,
  onUploadsChange,
  onSelectionChange,
  onError,
}: {
  processId: string;
  uploads: UploadRecord[];
  selectedIds: string[];
  disabled?: boolean;
  onUploadsChange: (uploads: UploadRecord[]) => void;
  onSelectionChange: (ids: string[]) => void;
  onError: (message: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const configLimit = 5;

  async function add(file: File) {
    setBusy(true);
    onError("");
    try {
      const upload = await api.upload(processId, file);
      onUploadsChange([...uploads, upload]);
      onSelectionChange([...selectedIds, upload.id]);
    } catch (error) {
      onError((error as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  async function remove(upload: ProcessCaptureRecord["uploads"][number]) {
    setBusy(true);
    onError("");
    try {
      await api.removeUpload(processId, upload.id);
      onUploadsChange(uploads.filter((item) => item.id !== upload.id));
      onSelectionChange(selectedIds.filter((id) => id !== upload.id));
    } catch (error) {
      onError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card as="section" className="upload-panel" aria-labelledby="upload-title">
      <div className="section-head compact">
        <div>
          <Kicker>Freiwillig</Kicker>
          <h2 id="upload-title">Vorhandene Unterlagen</h2>
        </div>
        <span>
          {uploads.length} von {configLimit}
        </span>
      </div>
      <p>
        Gute, aktuelle Unterlagen helfen beim Einordnen. Wählen Sie aus, welche
        Dateien für diese Prozessaufnahme berücksichtigt werden sollen.
      </p>
      {uploads.length > 0 && (
        <ul className="upload-list">
          {uploads.map((upload) => (
            <li key={upload.id}>
              <label>
                <input
                  name={`upload-${upload.id}-selected`}
                  type="checkbox"
                  checked={selectedIds.includes(upload.id)}
                  disabled={disabled || busy}
                  onChange={(event) =>
                    onSelectionChange(
                      event.target.checked
                        ? [...selectedIds, upload.id]
                        : selectedIds.filter((id) => id !== upload.id),
                    )
                  }
                />
                <FileText />
                <span>
                  <b>{upload.name}</b>
                  <small>{formatBytes(upload.size)}</small>
                </span>
              </label>
              <IconButton
                label={`Datei ${upload.name} entfernen`}
                tone="danger"
                disabled={disabled || busy}
                onClick={() => void remove(upload)}
              >
                <Trash2 />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
      <input
        ref={input}
        name="process-upload"
        hidden
        type="file"
        accept=".pdf,.xlsx,.csv,.docx,.pptx,.txt,.md,.png,.jpg,.jpeg"
        disabled={disabled || busy || uploads.length >= configLimit}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void add(file);
        }}
      />
      <Button
        type="button"
        variant="secondary"
        disabled={disabled || busy || uploads.length >= configLimit}
        onClick={() => input.current?.click()}
      >
        {busy ? <Paperclip className="spin" /> : <Upload />}
        {busy ? "Datei wird verarbeitet …" : "Unterlage hinzufügen"}
      </Button>
      <small>
        PDF, Word, PowerPoint, Excel, CSV, Text oder Bild · höchstens 20 MB je
        Datei
      </small>
    </Card>
  );
}

function formatBytes(value: number) {
  if (value < 1024 * 1024) return `${Math.ceil(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}
