import { FileUp, Upload } from "lucide-react";
import { useRef } from "react";
import type { AssessmentRecord } from "../lib/assessment-types";

export function AssessmentUploadPicker({
  uploads,
  selectedIds,
  busy,
  onToggle,
  onUpload,
}: {
  uploads: AssessmentRecord["uploads"];
  selectedIds: string[];
  busy: boolean;
  onToggle: (id: string, selected: boolean) => void;
  onUpload: (file: File) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="assessment-uploads">
      {uploads.length ? (
        <ul className="upload-list selectable-uploads">
          {uploads.map((file) => (
            <li key={file.id}>
              <label>
                <input
                  type="checkbox"
                  name={`selected-upload-${file.id}`}
                  checked={selectedIds.includes(file.id)}
                  onChange={(event) => onToggle(file.id, event.target.checked)}
                />
                <FileUp />
                <span>{file.name}</span>
              </label>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">Noch keine Dateien hochgeladen.</p>
      )}
      <input
        ref={input}
        hidden
        type="file"
        name="assessment-upload"
        accept=".pdf,.xlsx,.csv,.docx,.txt,.md,.png,.jpg,.jpeg"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onUpload(file);
          event.target.value = "";
        }}
      />
      <button
        type="button"
        className="small-button wide"
        disabled={busy}
        onClick={() => input.current?.click()}
      >
        <Upload />
        Datei hochladen
      </button>
      {uploads.length > 0 && (
        <small>
          Nur markierte Dateien werden bei der nächsten KI-Aktion verwendet.
        </small>
      )}
    </div>
  );
}
