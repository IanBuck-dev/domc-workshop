import { Eraser, Info, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type {
  MemoryOverviewDetail,
  MemoryTopicOverviewDetail,
} from "../../../../packages/domain/src/memory";
import type { MemoryConsolidationStatus } from "../../../../packages/domain/src/process-events";
import { ApiError, api } from "../lib/api-client";
import { useMemoryConsolidation } from "../lib/process-events";
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
import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Skeleton } from "./ui/skeleton";
import { Spinner } from "./ui/spinner";

const dateFormat = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

/** „2026-08-10“ → „10.08.2026“. Ohne Uhrzeit, das Datum genügt hier. */
function formatLearnedAt(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return dateFormat.format(new Date(year, month - 1, day));
}

function countLabel(count: number) {
  return count === 1 ? "1 Eintrag" : `${count} Einträge`;
}

/** Änderungen als ein Satz in Alltagssprache, ohne Aufräum-Vokabular. */
export function summarySentence(
  summary: NonNullable<MemoryConsolidationStatus["summary"]>,
) {
  const parts = [
    summary.mergedCount && `${countLabel(summary.mergedCount)} zusammengeführt`,
    summary.deletedCount && `${countLabel(summary.deletedCount)} entfernt`,
    summary.movedCount &&
      `${countLabel(summary.movedCount)} zu den offenen Fragen verschoben`,
  ].filter((part): part is string => Boolean(part));
  if (!parts.length) return "Es gab nichts aufzuräumen.";
  return `${parts.join(", ")}.`;
}

export function CompanyKnowledgeSection() {
  const consolidation = useMemoryConsolidation();
  const [overview, setOverview] = useState<MemoryOverviewDetail | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [forgetOpen, setForgetOpen] = useState(false);
  const [forgetBusy, setForgetBusy] = useState(false);
  const [forgetError, setForgetError] = useState("");
  const [starting, setStarting] = useState(false);
  const lastCompleted = useRef<string | null>(null);

  const load = useCallback(async () => {
    try {
      setOverview(await api.memory());
      setError("");
    } catch (reason) {
      setError((reason as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Nach einem abgeschlossenen Lauf steht neues Wissen in den Dateien.
  useEffect(() => {
    if (consolidation.state !== "completed") return;
    const id = consolidation.operationId ?? "";
    if (lastCompleted.current === id) return;
    lastCompleted.current = id;
    void load();
  }, [consolidation.state, consolidation.operationId, load]);

  const running =
    consolidation.state === "queued" || consolidation.state === "running";

  async function startConsolidation() {
    setStarting(true);
    setNotice("");
    setError("");
    try {
      await api.consolidateMemory();
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 409)
        setNotice(
          "Das Aufräumen läuft bereits. Sobald es fertig ist, sehen Sie hier, was sich geändert hat.",
        );
      else setError((reason as Error).message);
    } finally {
      setStarting(false);
    }
  }

  async function forgetEverything() {
    setForgetBusy(true);
    setForgetError("");
    try {
      setOverview(await api.forgetMemory());
      setForgetOpen(false);
      setNotice(
        "Alles vergessen. Die Anwendung lernt ab der nächsten bestätigten Prozessaufnahme neu.",
      );
    } catch (reason) {
      setForgetError((reason as Error).message);
    } finally {
      setForgetBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <p className="text-ui text-muted-foreground">
        Die Anwendung merkt sich aus bestätigten Prozessaufnahmen, wie im
        Unternehmen gearbeitet und gesprochen wird. Dieser Stand lässt sich hier
        nachlesen, aufräumen oder vollständig verwerfen.
      </p>
      {error && (
        <p
          className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-label text-destructive"
          role="alert"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          className="rounded-md border border-primary/20 bg-secondary p-3 text-label text-secondary-foreground"
          role="status"
        >
          {notice}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          disabled={running || starting}
          aria-busy={running}
          onClick={() => void startConsolidation()}
        >
          {running ? <Spinner /> : <Sparkles />} Wissen aufräumen
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          disabled={running || overview?.isEmpty !== false}
          onClick={() => {
            setForgetError("");
            setForgetOpen(true);
          }}
        >
          <Eraser /> Alles vergessen
        </Button>
      </div>
      <ConsolidationStatus status={consolidation} running={running} />
      {!overview && !error ? (
        <KnowledgeSkeleton />
      ) : overview?.isEmpty ? (
        <div className="rounded-lg border border-border bg-muted p-5">
          <p className="text-subheading">Noch nichts gelernt</p>
          <p className="mt-2 text-ui text-muted-foreground">
            Die Anwendung lernt aus bestätigten Prozessaufnahmen. Sobald die
            erste Aufnahme bestätigt ist, sammeln sich hier Fachbegriffe,
            Systeme, Zuständigkeiten, wiederkehrende Muster und offene Fragen.
          </p>
        </div>
      ) : (
        overview && (
          <div className="space-y-4">
            <p className="text-label text-muted-foreground">
              {countLabel(overview.entryCount)} insgesamt
              {overview.lastLearnedAt
                ? `, zuletzt gelernt am ${formatLearnedAt(overview.lastLearnedAt)}`
                : ""}
              .
            </p>
            {overview.topics.map((topic) => (
              <KnowledgeTopic key={topic.id} topic={topic} />
            ))}
          </div>
        )
      )}
      <AlertDialog
        open={forgetOpen}
        onOpenChange={(next) => {
          if (!next && !forgetBusy) setForgetOpen(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Wirklich alles vergessen?</AlertDialogTitle>
            <AlertDialogDescription>
              Die Anwendung verliert alles, was sie bisher über das Unternehmen
              gelernt hat. Bestätigte Prozessaufnahmen bleiben erhalten — die
              Anwendung lernt daraus aber erst wieder mit der nächsten
              Bestätigung.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {forgetError && (
            <p
              className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-label text-destructive"
              role="alert"
            >
              {forgetError}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={forgetBusy}
              onClick={() => setForgetOpen(false)}
            >
              Abbrechen
            </AlertDialogCancel>
            <AlertDialogAction
              type="button"
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={forgetBusy}
              aria-busy={forgetBusy}
              onClick={() => void forgetEverything()}
            >
              {forgetBusy ? (
                <>
                  <Spinner /> Wird vergessen …
                </>
              ) : (
                "Alles vergessen"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ConsolidationStatus({
  status,
  running,
}: {
  status: MemoryConsolidationStatus;
  running: boolean;
}) {
  if (running)
    return (
      <p
        className="flex items-center gap-2 rounded-md border border-primary/20 bg-secondary p-3 text-label text-secondary-foreground"
        role="status"
      >
        <Spinner />
        {status.state === "queued"
          ? "Das Aufräumen ist eingereiht und startet gleich."
          : "Das Wissen wird gerade aufgeräumt. Das dauert einen Moment."}
      </p>
    );
  if (status.state === "failed")
    return (
      <p
        className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-label text-destructive"
        role="alert"
      >
        {status.error}
      </p>
    );
  if (status.state !== "completed" || !status.summary) return null;
  return (
    <div
      className="rounded-md border border-primary/20 bg-secondary p-3 text-secondary-foreground"
      role="status"
    >
      <p className="text-label">
        Aufgeräumt: {summarySentence(status.summary)}
      </p>
      {status.summary.deletions.length > 0 && (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-ui">
          {status.summary.deletions.map((deletion) => (
            <li key={deletion.fact}>
              „{deletion.fact}“ — entfernt, weil {deletion.reason}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function KnowledgeTopic({ topic }: { topic: MemoryTopicOverviewDetail }) {
  return (
    <section className="rounded-lg border border-border bg-muted p-4 sm:p-5">
      <h3 className="text-subheading">{topic.title}</h3>
      <p className="mt-1 text-ui text-muted-foreground">{topic.description}</p>
      <p className="mt-2 text-label text-muted-foreground">
        {countLabel(topic.entryCount)}
        {topic.lastLearnedAt
          ? ` · zuletzt gelernt am ${formatLearnedAt(topic.lastLearnedAt)}`
          : ""}
      </p>
      {topic.entries.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {topic.entries.map((entry) => (
            <li
              key={entry.fact}
              className="flex items-start justify-between gap-2 rounded-md border border-border bg-card p-3 text-ui"
            >
              <span className="min-w-0">{entry.fact}</span>
              <EntryOrigin entry={entry} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-ui text-muted-foreground">
          Hier hat die Anwendung noch nichts gelernt.
        </p>
      )}
    </section>
  );
}

/**
 * Herkunft eines Eintrags auf Klick. Bewusst kein Hover: die Angaben sollen
 * auch auf dem Tablet erreichbar bleiben.
 */
function EntryOrigin({
  entry,
}: {
  entry: MemoryTopicOverviewDetail["entries"][number];
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="-my-1 shrink-0 text-muted-foreground hover:text-foreground"
          aria-label="Woher stammt dieser Eintrag?"
        >
          <Info />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-3">
        <p className="text-label text-muted-foreground">
          Woher stammt dieser Eintrag?
        </p>
        {entry.sources.map((source, index) => (
          <div
            key={source.processId}
            className={index > 0 ? "border-t border-border pt-3" : undefined}
          >
            <p className="text-label text-muted-foreground">Gelernt aus</p>
            {source.exists ? (
              <p className="text-ui">
                <Link
                  className="font-semibold text-foreground underline underline-offset-2 focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  to={`/processes/${source.processId}`}
                >
                  {source.processName}
                </Link>{" "}
                <span className="text-muted-foreground">
                  ({source.processId})
                </span>
              </p>
            ) : (
              <p className="text-ui">
                <span className="font-semibold">{source.processId}</span>{" "}
                <span className="text-muted-foreground">
                  — Prozessaufnahme wurde gelöscht.
                </span>
              </p>
            )}
            {source.department && (
              <p className="mt-2 text-label text-muted-foreground">
                Fachbereich
              </p>
            )}
            {source.department && (
              <p className="text-ui">{source.department}</p>
            )}
            {source.participantName && (
              <p className="mt-2 text-label text-muted-foreground">
                Eingereicht von
              </p>
            )}
            {source.participantName && (
              <p className="text-ui">{source.participantName}</p>
            )}
          </div>
        ))}
        <p className="border-t border-border pt-3 text-label text-muted-foreground">
          Bestätigt am {formatLearnedAt(entry.learnedAt)}
        </p>
      </PopoverContent>
    </Popover>
  );
}

function KnowledgeSkeleton() {
  return (
    <div
      className="space-y-4"
      role="status"
      aria-busy="true"
      aria-label="Gelerntes Firmenwissen wird geladen"
    >
      <span className="sr-only">Gelerntes Firmenwissen wird geladen</span>
      <Skeleton className="h-4 w-56" />
      {Array.from({ length: 3 }, (_, index) => (
        <Skeleton key={index} className="h-28 w-full rounded-lg" />
      ))}
    </div>
  );
}
