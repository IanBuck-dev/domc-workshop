import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";

export interface InstructionPreview {
  base: string;
  followUps: string;
  synthesis: string;
}

export function InstructionPreviewDialog({
  open,
  loading,
  error,
  preview,
  onClose,
}: {
  open: boolean;
  loading: boolean;
  error: string;
  preview: InstructionPreview | null;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open && dialog.current && !dialog.current.open)
      dialog.current.showModal();
  }, [open]);
  if (!open) return null;
  return (
    <dialog
      ref={dialog}
      className="preview-dialog instruction-preview-dialog"
      aria-labelledby="instruction-preview-title"
      onClose={onClose}
    >
      <header>
        <div>
          <span className="kicker">KI-UNTERSTÜTZUNG</span>
          <h2 id="instruction-preview-title">Vollständige Anweisungen</h2>
          <small>
            Feste Leitplanken und Ihre aktuell eingetragenen Zusatzhinweise
          </small>
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label="Anweisungsvorschau schließen"
          onClick={() => dialog.current?.close()}
        >
          <X />
        </button>
      </header>
      <div className="preview-dialog-content instruction-preview-content">
        {loading && <p aria-live="polite">Anweisungen werden geladen …</p>}
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        {preview && !loading && !error && (
          <>
            <InstructionMarkdown
              title="Gemeinsame globale Rolle"
              markdown={preview.base}
            />
            <InstructionMarkdown
              title="Materielle Rückfragen"
              markdown={preview.followUps}
            />
            <InstructionMarkdown
              title="Prozessbild erstellen"
              markdown={preview.synthesis}
            />
          </>
        )}
      </div>
    </dialog>
  );
}

function InstructionMarkdown({
  title,
  markdown,
}: {
  title: string;
  markdown: string;
}) {
  return (
    <section className="instruction-markdown" aria-label={title}>
      <h3>{title}</h3>
      <ReactMarkdown
        skipHtml
        components={{
          h1: ({ children }) => <h4>{children}</h4>,
          h2: ({ children }) => <h5>{children}</h5>,
          h3: ({ children }) => <h5>{children}</h5>,
        }}
      >
        {markdown}
      </ReactMarkdown>
    </section>
  );
}
