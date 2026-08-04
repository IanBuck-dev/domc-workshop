import { FileText, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { api } from "../lib/api-client";
import type { ProcessCaptureRecord, UploadRecord } from "../lib/process-types";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Checkbox } from "./ui/checkbox";
import { Spinner } from "./ui/spinner";

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
    <Card as="section" className="gap-0" aria-labelledby="upload-title">
      <CardHeader className="flex-row items-start justify-between px-5 pb-4 sm:px-6">
        <div className="space-y-1">
          <p className="text-eyebrow uppercase text-primary">Freiwillig</p>
          <CardTitle id="upload-title">Vorhandene Unterlagen</CardTitle>
        </div>
        <span className="rounded-full bg-secondary px-2.5 py-1 text-label text-secondary-foreground">
          {uploads.length} von {configLimit}
        </span>
      </CardHeader>
      <CardContent className="space-y-4 px-5 sm:px-6">
        <p className="text-ui text-muted-foreground">
          Gute, aktuelle Unterlagen helfen beim Einordnen. Wählen Sie aus,
          welche Dateien für diese Prozessaufnahme berücksichtigt werden sollen.
        </p>
        {uploads.length > 0 && (
          <ul className="divide-y rounded-lg border border-border">
            {uploads.map((upload) => (
              <li key={upload.id} className="flex items-center gap-3 p-3">
                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                  <Checkbox
                    name={`upload-${upload.id}-selected`}
                    checked={selectedIds.includes(upload.id)}
                    disabled={disabled || busy}
                    onCheckedChange={(checked) =>
                      onSelectionChange(
                        checked === true
                          ? [...selectedIds, upload.id]
                          : selectedIds.filter((id) => id !== upload.id),
                      )
                    }
                  />
                  <FileText className="size-5 shrink-0 text-primary" />
                  <span className="min-w-0">
                    <b className="block truncate text-ui">{upload.name}</b>
                    <small className="block text-caption text-muted-foreground">
                      {formatBytes(upload.size)}
                    </small>
                  </span>
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Datei ${upload.name} entfernen`}
                  disabled={disabled || busy}
                  onClick={() => void remove(upload)}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
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
          aria-busy={busy}
          onClick={() => input.current?.click()}
        >
          {busy ? <Spinner /> : <Upload />}
          {busy ? "Datei wird verarbeitet …" : "Unterlage hinzufügen"}
        </Button>
        <small className="block text-caption text-muted-foreground">
          PDF, Word, PowerPoint, Excel, CSV, Text oder Bild · höchstens 20 MB je
          Datei
        </small>
      </CardContent>
    </Card>
  );
}

function formatBytes(value: number) {
  if (value < 1024 * 1024) return `${Math.ceil(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}
