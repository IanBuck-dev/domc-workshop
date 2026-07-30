import { Eye } from "lucide-react";
import { useState } from "react";
import type { ProcessUnderstanding, UploadRecord } from "../lib/process-types";
import { DocumentPreviewDialog } from "./document-preview-dialog";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Card } from "./ui/card";
const copy = {
  complete: "Vollständig berücksichtigt",
  partial: "Teilweise berücksichtigt",
  failed: "Nicht verarbeitet",
} as const;
export function DocumentCoverage({
  understanding,
  processId,
  uploads,
}: {
  understanding: ProcessUnderstanding;
  processId: string;
  uploads: UploadRecord[];
}) {
  const [preview, setPreview] = useState<UploadRecord | null>(null);
  return (
    <Card as="section" className="gap-5 p-6 sm:p-8">
      <h2 className="text-2xl font-bold tracking-tight">
        Unterlagen und offene Punkte
      </h2>
      {understanding.documentCoverage.length ? (
        <ul className="divide-y rounded-lg border">
          {understanding.documentCoverage.map((file) => {
            const upload = uploads.find((item) => item.id === file.uploadId);
            return (
              <li
                className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start"
                key={file.uploadId}
              >
                <div className="grid gap-2">
                  <b>{file.name}</b>
                  <Badge
                    tone={
                      file.status === "complete"
                        ? "success"
                        : file.status === "partial"
                          ? "warning"
                          : "danger"
                    }
                  >
                    {copy[file.status]}
                  </Badge>
                  {file.limitation && (
                    <small className="text-sm text-muted-foreground">
                      {file.limitation}
                    </small>
                  )}
                </div>
                {upload && (
                  <Button
                    type="button"
                    variant="secondary"
                    className="justify-self-start sm:justify-self-end"
                    onClick={() => setPreview(upload)}
                  >
                    <Eye /> Vorschau öffnen
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-muted-foreground">Keine Unterlagen ausgewählt</p>
      )}
      <div className="grid gap-2 rounded-lg border bg-muted/20 p-4">
        <h3 className="font-semibold">Erkannte Widersprüche</h3>
        {understanding.conflicts.length ? (
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            {understanding.conflicts.map((conflict) => (
              <li key={conflict}>{conflict}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Keine Widersprüche erkannt
          </p>
        )}
      </div>
      <DocumentPreviewDialog
        processId={processId}
        upload={preview}
        onClose={() => setPreview(null)}
      />
    </Card>
  );
}
