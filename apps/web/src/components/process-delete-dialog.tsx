import { AlertTriangle, LoaderCircle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";

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
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !busy) onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <div
            className="mb-1 grid size-11 place-items-center rounded-full bg-destructive/10 text-destructive"
            aria-hidden="true"
          >
            <AlertTriangle className="size-5" />
          </div>
          <AlertDialogTitle>Prozessaufnahme löschen?</AlertDialogTitle>
          <AlertDialogDescription>
            „{processName}“ und alle zugehörigen KI-Analysen werden dauerhaft
            gelöscht. Dies kann nicht rückgängig gemacht werden.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p
            className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-label text-destructive"
            role="alert"
          >
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy} onClick={onClose}>
            Abbrechen
          </AlertDialogCancel>
          <AlertDialogAction
            type="button"
            className="bg-destructive text-white hover:bg-destructive/90"
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? (
              <>
                <LoaderCircle className="animate-spin" /> Wird gelöscht …
              </>
            ) : (
              "Endgültig löschen"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
