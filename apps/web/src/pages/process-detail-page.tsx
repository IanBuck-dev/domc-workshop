import {
  ArrowLeft,
  ArrowRight,
  EllipsisVertical,
  FileSpreadsheet,
  ClipboardCheck,
  LockKeyhole,
  Sparkles,
  Trash2,
  Workflow,
} from "lucide-react";
import { useEffect, useId, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ProcessDeleteDialog } from "../components/process-delete-dialog";
import { Badge } from "../components/ui/badge";
import { api } from "../lib/api-client";
import type { OpportunityDiscoverySummary } from "../lib/opportunity-types";
import type { AgenticPotentialAssessmentDetail } from "../lib/agentic-potential-assessment-types";
import {
  opportunityEntryPhase,
  processNavigationModel,
  type ModuleNavigationState,
} from "../lib/process-navigation-model";
import type { ProcessCaptureRecord } from "../lib/process-types";
import { Button, buttonVariants } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { Skeleton } from "../components/ui/skeleton";
import { Spinner } from "../components/ui/spinner";
import { useAiOperations, useProcessChanged } from "../lib/process-events";

export function ProcessDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [process, setProcess] = useState<ProcessCaptureRecord | null>(null);
  const [opportunity, setOpportunity] = useState<OpportunityDiscoverySummary>();
  const [opportunityLoaded, setOpportunityLoaded] = useState(false);
  const [assessment, setAssessment] =
    useState<AgenticPotentialAssessmentDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const operations = useAiOperations();

  // Der Kopfbereich braucht nur `process` — er wartet nicht auf die
  // Potenzial-Übersicht, die für ihre eigene Kachel getrennt lädt.
  useEffect(() => {
    let active = true;
    api
      .process(id)
      .then((nextProcess) => active && setProcess(nextProcess))
      .catch((reason: Error) => active && setError(reason.message));
    return () => {
      active = false;
    };
  }, [id]);

  useProcessChanged(id, () => {
    void Promise.all([
      api.process(id).then(setProcess),
      api.opportunitySummaries().then((summaries) => {
        setOpportunity(summaries.find((item) => item.processId === id));
        setOpportunityLoaded(true);
      }),
      api
        .agenticAssessment(id)
        .then(setAssessment)
        .catch(() => setAssessment(null)),
    ]).catch((reason: Error) => setError(reason.message));
  });

  // The queue stream is a second server-pushed completion signal. Refreshing
  // from it closes the small gap when a process-changed event was emitted
  // before this page's subscriber was registered or while SSE reconnected.
  useEffect(() => {
    void Promise.all([
      api.opportunitySummaries().then((summaries) => {
        setOpportunity(summaries.find((item) => item.processId === id));
        setOpportunityLoaded(true);
      }),
      api
        .agenticAssessment(id)
        .then(setAssessment)
        .catch(() => setAssessment(null)),
    ]).catch((reason: Error) => setError(reason.message));
  }, [id, operations]);

  useEffect(() => {
    let active = true;
    api
      .agenticAssessment(id)
      .then((value) => active && setAssessment(value))
      .catch(() => active && setAssessment(null));
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    let active = true;
    api
      .opportunitySummaries()
      .then((summaries) => {
        if (!active) return;
        setOpportunity(summaries.find((item) => item.processId === id));
        setOpportunityLoaded(true);
      })
      .catch((reason: Error) => active && setError(reason.message));
    return () => {
      active = false;
    };
  }, [id]);

  if (error && !process)
    return (
      <p
        className="m-6 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-label text-destructive"
        role="alert"
      >
        {error}
      </p>
    );

  const navigation = process
    ? processNavigationModel(process, opportunity)
    : null;
  return (
    <section className="mx-auto w-full max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <Link
        className="inline-flex items-center gap-2 text-label text-primary hover:underline"
        to="/"
      >
        <ArrowLeft className="size-4" /> Zur Prozessübersicht
      </Link>
      <div className="flex items-start justify-between gap-5">
        <div>
          <p className="mb-2 text-eyebrow uppercase text-primary">Prozess</p>
          {process ? (
            <>
              <h1 className="text-title sm:text-display">
                {process.cover.processName}
              </h1>
              <p className="mt-3 text-muted-foreground">
                {process.cover.department} · {process.id} · aktualisiert{" "}
                {new Date(process.updatedAt).toLocaleString("de-DE", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </p>
            </>
          ) : (
            <div
              className="space-y-3"
              role="status"
              aria-busy="true"
              aria-label="Prozess wird geladen"
            >
              <span className="sr-only">Prozess wird geladen</span>
              <Skeleton className="h-9 w-72 max-w-full" />
              <Skeleton className="h-5 w-56 max-w-full" />
            </div>
          )}
        </div>
        {process ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Weitere Aktionen">
                <EllipsisVertical />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => {
                  setDeleteError("");
                  setDeleteOpen(true);
                }}
              >
                <Trash2 /> Prozess löschen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Skeleton className="size-9 shrink-0 rounded-md" />
        )}
      </div>
      {error && (
        <p
          className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-label text-destructive"
          role="alert"
        >
          {error}
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {process && navigation ? (
          <ProcessModuleCard
            step="01"
            title="Prozessaufnahme"
            description="Erfasste Angaben, Rückfragen und das bestätigte Prozessbild."
            icon={<Workflow />}
            state={navigation.capture}
            action={
              <Link
                className={buttonVariants({ variant: "secondary" })}
                to={`/processes/${id}/${process.interactionMode === "chat" ? "chat" : "capture"}`}
              >
                {navigation.capture.actionLabel} <ArrowRight />
              </Link>
            }
          />
        ) : (
          <ProcessModuleCardSkeleton />
        )}
        {process && navigation ? (
          <ProcessModuleCard
            step="02"
            title="PDD-Export"
            description="Schreibgeschützte Excel-Arbeitsmappe aus dem bestätigten Prozessbild."
            icon={<FileSpreadsheet />}
            state={navigation.pdd}
            action={pddAction(navigation.pdd)}
            disabledActionLabel="Excel erstellen"
          />
        ) : (
          <ProcessModuleCardSkeleton />
        )}
        {process && navigation && opportunityLoaded ? (
          <ProcessModuleCard
            step="03"
            title="KI-Potenziale"
            description="Potenzialhypothesen und drei Szenarien für den Einsatz von KI."
            icon={<Sparkles />}
            state={navigation.opportunity}
            action={opportunityAction(navigation.opportunity)}
            disabledActionLabel="Starten"
          />
        ) : (
          <ProcessModuleCardSkeleton />
        )}
        {process && opportunityLoaded ? (
          <ProcessModuleCard
            step="04"
            title="Potenzialbewertung"
            description="Kriterienprüfung des ausgewählten agentischen Szenarios."
            icon={<ClipboardCheck />}
            state={{
              status:
                assessment?.record.state === "completed"
                  ? "Bewertet"
                  : assessment?.record.state === "failed"
                    ? "Unterbrochen"
                    : assessment
                      ? "Läuft"
                      : opportunity?.state === "completed" &&
                          opportunity.isStale
                        ? "Prozessstand veraltet"
                        : opportunity?.state === "completed"
                          ? "Bereit zur Bewertung"
                          : "Nach Szenarien",
              tone:
                assessment?.record.state === "failed"
                  ? "danger"
                  : assessment?.record.state === "completed"
                    ? "success"
                    : assessment
                      ? "info"
                      : opportunity?.state === "completed" &&
                          opportunity.isStale
                        ? "warning"
                        : "neutral",
              actionLabel:
                opportunity?.state === "completed" && !opportunity.isStale
                  ? "Öffnen"
                  : null,
              action: null,
              blockedReason:
                opportunity?.state !== "completed"
                  ? "Erst nach Abschluss der Szenarien verfügbar."
                  : opportunity.isStale
                    ? "Die Szenarioanalyse muss zum bestätigten Prozessstand passen."
                    : null,
            }}
            action={
              opportunity?.state === "completed" && !opportunity.isStale ? (
                <Link
                  className={buttonVariants({ variant: "secondary" })}
                  to={`/processes/${id}/opportunities/agentic-assessment`}
                >
                  Öffnen <ArrowRight />
                </Link>
              ) : null
            }
            disabledActionLabel="Bewertung starten"
          />
        ) : (
          <ProcessModuleCardSkeleton />
        )}
      </div>
      {process &&
        process.interactionMode === "chat" &&
        process.confirmationQuality === "with_gaps" && (
          <p className="rounded-md border border-amber-500/30 bg-amber-50 p-3 text-ui text-amber-950">
            Der Prozess wurde mit offenen Punkten bestätigt.
          </p>
        )}
      <ProcessDeleteDialog
        open={deleteOpen}
        processName={process?.cover.processName ?? ""}
        busy={deleting}
        error={deleteError}
        onClose={() => {
          if (!deleting) setDeleteOpen(false);
        }}
        onConfirm={() => void deleteProcess()}
      />
    </section>
  );

  async function deleteProcess() {
    setDeleting(true);
    setDeleteError("");
    try {
      await api.deleteProcess(id);
      navigate("/");
    } catch (reason) {
      const message = (reason as Error).message;
      setDeleteError(
        message === "Failed to fetch"
          ? "Die Prozessaufnahme konnte nicht gelöscht werden. Bitte versuchen Sie es erneut."
          : message,
      );
      setDeleting(false);
    }
  }

  function opportunityAction(state: ModuleNavigationState) {
    if (state.action === "start_opportunity")
      return (
        <Button
          disabled={busy}
          aria-busy={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await api.startOpportunity(id);
              navigate(`/processes/${id}/opportunities/hypotheses`);
            } catch (reason) {
              setError((reason as Error).message);
              setBusy(false);
            }
          }}
        >
          {busy ? (
            <>
              <Spinner /> Startet …
            </>
          ) : (
            <>
              {state.actionLabel} <ArrowRight />
            </>
          )}
        </Button>
      );
    if (state.action === "view_opportunity")
      return (
        <Link
          className={buttonVariants({ variant: "secondary" })}
          to={`/processes/${id}/opportunities/${opportunityEntryPhase(opportunity)}`}
        >
          {state.actionLabel} <ArrowRight />
        </Link>
      );
    return null;
  }

  function pddAction(state: ModuleNavigationState) {
    if (state.action !== "export_pdd") return null;
    return (
      <Button
        disabled={exporting}
        aria-busy={exporting}
        onClick={async () => {
          setExporting(true);
          setError("");
          try {
            const result = await api.exportPdd(id);
            const url = URL.createObjectURL(result.blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = result.filename;
            link.style.display = "none";
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.setTimeout(() => URL.revokeObjectURL(url), 0);
          } catch (reason) {
            setError((reason as Error).message);
          } finally {
            setExporting(false);
          }
        }}
      >
        {exporting ? (
          <>
            <Spinner /> Wird erstellt …
          </>
        ) : (
          <>
            {state.actionLabel} <FileSpreadsheet />
          </>
        )}
      </Button>
    );
  }
}

function ProcessModuleCardSkeleton() {
  return (
    <Card className="py-0">
      <CardContent
        className="relative flex min-h-72 flex-col px-5 pt-4 pb-17"
        role="status"
        aria-busy="true"
        aria-label="Modul wird geladen"
      >
        <span className="sr-only">Modul wird geladen</span>
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-4 w-6" />
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
        <div className="mt-5 flex items-center gap-3">
          <Skeleton className="size-11 shrink-0 rounded-lg" />
          <Skeleton className="h-6 w-36" />
        </div>
        <div className="mt-4 space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        <div className="mt-auto pt-5">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="absolute right-5 bottom-4 h-9 w-28" />
        </div>
      </CardContent>
    </Card>
  );
}

function ProcessModuleCard({
  step,
  title,
  description,
  icon,
  state,
  action,
  disabledActionLabel,
}: {
  step: `0${1 | 2 | 3 | 4}`;
  title: string;
  description: string;
  icon: React.ReactNode;
  state: ModuleNavigationState;
  action: React.ReactNode;
  disabledActionLabel?: string;
}) {
  const blockedReasonId = useId();

  return (
    <Card className="py-0">
      <CardContent className="relative flex min-h-72 flex-col px-5 pt-4 pb-17">
        <div className="flex min-w-0 items-center justify-between gap-4">
          <span
            className="text-overline text-muted-foreground"
            aria-hidden="true"
          >
            {step}
          </span>
          <Badge
            variant={
              state.tone === "danger"
                ? "destructive"
                : state.tone === "warning"
                  ? "outline"
                  : "secondary"
            }
          >
            {state.status}
          </Badge>
        </div>
        <div className="mt-5 flex min-w-0 items-center gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-lg bg-secondary text-primary">
            {icon}
          </div>
          <h2 className="min-w-0 text-heading">{title}</h2>
        </div>
        <p className="mt-4 text-muted-foreground">{description}</p>
        <div className="mt-auto pt-5">
          <p
            id={state.blockedReason ? blockedReasonId : undefined}
            className="text-ui text-muted-foreground"
          >
            {state.blockedReason}
          </p>
          <div className="absolute right-5 bottom-4 flex h-9 justify-end">
            {action ??
              (disabledActionLabel ? (
                <Button
                  variant="secondary"
                  disabled
                  aria-describedby={
                    state.blockedReason ? blockedReasonId : undefined
                  }
                >
                  <LockKeyhole /> {disabledActionLabel}
                </Button>
              ) : null)}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
