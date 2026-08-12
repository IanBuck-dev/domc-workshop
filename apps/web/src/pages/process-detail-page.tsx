import {
  ArrowLeft,
  ArrowRight,
  EllipsisVertical,
  FileSpreadsheet,
  Sparkles,
  Trash2,
  Workflow,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ProcessDeleteDialog } from "../components/process-delete-dialog";
import { Badge } from "../components/ui/badge";
import { api } from "../lib/api-client";
import type { OpportunityDiscoverySummary } from "../lib/opportunity-types";
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

export function ProcessDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [process, setProcess] = useState<ProcessCaptureRecord | null>(null);
  const [opportunity, setOpportunity] = useState<OpportunityDiscoverySummary>();
  const [opportunityLoaded, setOpportunityLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

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
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {process && navigation ? (
          <ProcessModuleCard
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
            title="PDD-Export"
            description="Eine schreibgeschützte Excel-Arbeitsmappe aus dem bestätigten Prozessbild."
            icon={<FileSpreadsheet />}
            state={navigation.pdd}
            action={pddAction(navigation.pdd)}
          />
        ) : (
          <ProcessModuleCardSkeleton />
        )}
        {process && navigation && opportunityLoaded ? (
          <ProcessModuleCard
            title="KI-Potenziale"
            description="Potenzialhypothesen und drei Szenarien für den Einsatz von KI."
            icon={<Sparkles />}
            state={navigation.opportunity}
            action={opportunityAction(navigation.opportunity)}
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
        className="grid min-h-52 grid-cols-[auto_minmax(0,1fr)] gap-4 p-5"
        role="status"
        aria-busy="true"
        aria-label="Modul wird geladen"
      >
        <span className="sr-only">Modul wird geladen</span>
        <Skeleton className="size-11 rounded-lg" />
        <div className="flex min-w-0 flex-col">
          <div className="flex items-start justify-between gap-3">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <Skeleton className="mt-3 h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-2/3" />
          <div className="mt-auto flex min-h-11 items-center justify-end pt-4">
            <Skeleton className="h-9 w-28" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ProcessModuleCard({
  title,
  description,
  icon,
  state,
  action,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  state: ModuleNavigationState;
  action: React.ReactNode;
}) {
  return (
    <Card className="py-0">
      <CardContent className="grid min-h-52 grid-cols-[auto_minmax(0,1fr)] gap-4 p-5">
        <div className="grid size-11 place-items-center rounded-lg bg-secondary text-primary">
          {icon}
        </div>
        <div className="flex min-w-0 flex-col">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-heading">{title}</h2>
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
          <p className="mt-3 text-muted-foreground">{description}</p>
          <div className="mt-auto flex min-h-11 items-center justify-end pt-4">
            {action ?? (
              <span className="mr-auto text-ui text-muted-foreground">
                {state.blockedReason}
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
