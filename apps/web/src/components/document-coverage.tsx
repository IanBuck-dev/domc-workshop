import { Eye } from "lucide-react";
import { useState } from "react";
import type { ProcessUnderstanding, UploadRecord } from "../lib/process-types";
import { DocumentPreviewDialog } from "./document-preview-dialog";
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
    <section className="brief-section">
      <h2>Unterlagen und offene Punkte</h2>
      {understanding.documentCoverage.length ? (
        <ul className="coverage-list">
          {understanding.documentCoverage.map((file) => {
            const upload = uploads.find((item) => item.id === file.uploadId);
            return (
              <li key={file.uploadId}>
                <div className="coverage-file">
                  <b>{file.name}</b>
                  <span className={`coverage-${file.status}`}>
                    {copy[file.status]}
                  </span>
                </div>
                {upload && (
                  <button
                    type="button"
                    className="button secondary coverage-preview-button"
                    onClick={() => setPreview(upload)}
                  >
                    <Eye /> Vorschau öffnen
                  </button>
                )}
                {file.limitation && <small>{file.limitation}</small>}
              </li>
            );
          })}
        </ul>
      ) : (
        <p>Keine Unterlagen ausgewählt.</p>
      )}
      {!!understanding.knowledgeGaps.length && (
        <>
          <h3>Noch unbekannt</h3>
          <ul>
            {understanding.knowledgeGaps.map((gap) => (
              <li key={gap}>{gap}</li>
            ))}
          </ul>
        </>
      )}
      {!!understanding.conflicts.length && (
        <>
          <h3>Widersprüche</h3>
          <ul>
            {understanding.conflicts.map((conflict) => (
              <li key={conflict}>{conflict}</li>
            ))}
          </ul>
        </>
      )}
      <DocumentPreviewDialog
        processId={processId}
        upload={preview}
        onClose={() => setPreview(null)}
      />
    </section>
  );
}
