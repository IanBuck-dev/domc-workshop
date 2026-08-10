import { useState } from "react";
import { ChevronDown, Undo2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";
import { Spinner } from "./ui/spinner";
import { CorpusDiff } from "./corpus-diff";
import { CorpusRevertDialog } from "./corpus-revert-dialog";
import { api } from "../lib/api-client";
import {
  anlassLabel,
  formatChangeDate,
  type CorpusLogEntry,
} from "../lib/corpus-types";
import { cn } from "../lib/utils";

/**
 * Änderungsverlauf eines Dokuments in Fachsprache — ohne Git-Vokabular,
 * insbesondere ohne Commit-Kennungen, Zweige oder Autorenzeilen aus dem Repo.
 *
 * Der Vergleich läuft immer gegen den unmittelbar vorherigen Stand desselben
 * Dokuments: die Liste ist bereits nach diesem Dokument gefiltert, der nächste
 * Eintrag ist damit genau der Stand davor. Der älteste Eintrag hat keinen
 * Vorgänger — dort wurde das Dokument angelegt.
 */
export function CorpusHistory({
  entries,
  loading,
  documentPath,
  onReverted,
}: {
  entries: CorpusLogEntry[];
  loading: boolean;
  documentPath: string;
  onReverted: () => void;
}) {
  if (loading) return <CorpusHistorySkeleton />;

  if (entries.length === 0)
    return (
      <p className="rounded-lg border border-border bg-muted p-4 text-ui text-muted-foreground">
        Für dieses Dokument ist noch keine Änderung verzeichnet.
      </p>
    );

  return (
    <ol className="space-y-3">
      {entries.map((entry, index) => (
        <CorpusHistoryEntry
          key={entry.sha}
          entry={entry}
          previous={entries[index + 1] ?? null}
          documentPath={documentPath}
          onReverted={onReverted}
        />
      ))}
    </ol>
  );
}

function CorpusHistoryEntry({
  entry,
  previous,
  documentPath,
  onReverted,
}: {
  entry: CorpusLogEntry;
  previous: CorpusLogEntry | null;
  documentPath: string;
  onReverted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [diff, setDiff] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [revertOpen, setRevertOpen] = useState(false);

  async function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (diff !== null || !previous) return;
    setLoading(true);
    setError("");
    try {
      setDiff(await api.corpus.diff(previous.sha, entry.sha, documentPath));
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <li className="rounded-lg border border-border bg-card">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="text-label text-foreground">
            {anlassLabel(entry.anlass)}
          </p>
          <p className="text-ui text-muted-foreground">
            {formatChangeDate(entry.datum)}
          </p>
          {entry.zusammenfassung && (
            <p className="text-ui text-foreground">{entry.zusammenfassung}</p>
          )}
          {entry.prozessId && (
            <Link
              to={`/processes/${entry.prozessId}`}
              className="inline-block text-ui text-primary underline underline-offset-4"
            >
              Zur Prozessaufnahme
            </Link>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="ghost" size="sm" onClick={() => void toggle()}>
            {open ? "Änderung ausblenden" : "Änderung ansehen"}
            <ChevronDown
              className={cn(
                "size-4 transition-transform",
                open && "rotate-180",
              )}
              aria-hidden="true"
            />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setRevertOpen(true)}>
            <Undo2 className="size-4" aria-hidden="true" />
            Änderung zurücknehmen
          </Button>
        </div>
      </div>
      {open && (
        <div className="border-t border-border p-4">
          {!previous && (
            <p className="rounded-md border border-border bg-muted p-3 text-ui text-muted-foreground">
              Mit dieser Änderung wurde das Dokument angelegt.
            </p>
          )}
          {previous && loading && (
            <p
              className="flex items-center gap-2 text-ui text-muted-foreground"
              role="status"
            >
              <Spinner /> Die Änderung wird geladen …
            </p>
          )}
          {error && (
            <p
              className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-label text-destructive"
              role="alert"
            >
              {error}
            </p>
          )}
          {previous && !loading && !error && diff !== null && (
            <CorpusDiff diff={diff} />
          )}
        </div>
      )}
      <CorpusRevertDialog
        open={revertOpen}
        entry={entry}
        onClose={() => setRevertOpen(false)}
        onReverted={() => {
          setRevertOpen(false);
          onReverted();
        }}
      />
    </li>
  );
}

export function CorpusHistorySkeleton() {
  return (
    <div
      className="space-y-3"
      role="status"
      aria-busy="true"
      aria-label="Änderungsverlauf wird geladen"
    >
      <span className="sr-only">Änderungsverlauf wird geladen</span>
      {Array.from({ length: 3 }, (_, index) => (
        <div
          key={index}
          className="space-y-2 rounded-lg border border-border p-4"
        >
          <Skeleton className="h-4 w-56" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-full max-w-md" />
        </div>
      ))}
    </div>
  );
}
