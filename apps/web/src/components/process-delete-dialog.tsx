import { AlertTriangle, LoaderCircle, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button, IconButton } from "./ui/button";

export function ProcessDeleteDialog({
  open,
  processName,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  open: boolean;
  processName: string;
  busy: boolean;
  error: string;
  onClose: () => void;
  onConfirm: () => void;
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
      className="confirmation-dialog process-delete-dialog"
      aria-labelledby="process-delete-title"
      aria-describedby="process-delete-description"
      onCancel={(event) => {
        if (busy) event.preventDefault();
      }}
      onClose={onClose}
    >
      <header>
        <div className="confirmation-dialog-icon" aria-hidden="true">
          <AlertTriangle />
        </div>
        <IconButton
          label="Löschen abbrechen"
          disabled={busy}
          onClick={() => dialog.current?.close()}
        >
          <X />
        </IconButton>
      </header>
      <div className="confirmation-dialog-content">
        <h2 id="process-delete-title">Prozessaufnahme löschen?</h2>
        <p id="process-delete-description">
          „{processName}“ und alle zugehörigen KI-Analysen werden dauerhaft
          gelöscht. Dies kann nicht rückgängig gemacht werden.
        </p>
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
      </div>
      <footer>
        <Button
          type="button"
          variant="secondary"
          disabled={busy}
          autoFocus
          onClick={() => dialog.current?.close()}
        >
          Abbrechen
        </Button>
        <Button
          type="button"
          variant="danger"
          disabled={busy}
          onClick={onConfirm}
        >
          {busy ? (
            <>
              <LoaderCircle className="spin" /> Wird gelöscht …
            </>
          ) : (
            "Endgültig löschen"
          )}
        </Button>
      </footer>
    </dialog>
  );
}
