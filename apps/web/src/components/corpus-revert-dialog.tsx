import { useState } from "react";
import { Undo2 } from "lucide-react";
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
import { Spinner } from "./ui/spinner";
import { api } from "../lib/api-client";
import {
  anlassLabel,
  formatChangeDate,
  type CorpusLogEntry,
} from "../lib/corpus-types";

/**
 * Die einzige Schreibaktion im Dokumentations-Viewer. Sie löscht nichts: die
 * Rücknahme erzeugt einen zusätzlichen Eintrag im Verlauf, der den vorherigen
 * Stand wiederherstellt. Der Dialog sagt das ausdrücklich, damit die Aktion
 * nicht als Löschung missverstanden wird.
 */
export function CorpusRevertDialog({
  open,
  entry,
  onClose,
  onReverted,
}: {
  open: boolean;
  entry: CorpusLogEntry;
  onClose: () => void;
  onReverted: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function revert() {
    setBusy(true);
    setError("");
    try {
      await api.corpus.revert(entry.sha);
      onReverted();
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }

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
            className="mb-1 grid size-11 place-items-center rounded-full bg-secondary text-secondary-foreground"
            aria-hidden="true"
          >
            <Undo2 className="size-5" />
          </div>
          <AlertDialogTitle>Änderung zurücknehmen?</AlertDialogTitle>
          <AlertDialogDescription>
            Die Änderung vom {formatChangeDate(entry.datum)} (
            {anlassLabel(entry.anlass).toLowerCase()}) wird rückgängig gemacht.
            Der Verlauf bleibt vollständig erhalten — die Rücknahme erscheint
            als zusätzlicher Eintrag.
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
            disabled={busy}
            aria-busy={busy}
            onClick={(event) => {
              event.preventDefault();
              void revert();
            }}
          >
            {busy ? "Wird zurückgenommen …" : "Zurücknehmen"}
            {busy && <Spinner />}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
