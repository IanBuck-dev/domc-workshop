import {
  ArrowLeft,
  ArrowRight,
  EllipsisVertical,
  LoaderCircle,
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

export function ProcessDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [process, setProcess] = useState<ProcessCaptureRecord | null>(null);
  const [opportunity, setOpportunity] = useState<OpportunityDiscoverySummary>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([api.process(id), api.opportunitySummaries()])
      .then(([nextProcess, summaries]) => {
        if (!active) return;
        setProcess(nextProcess);
        setOpportunity(summaries.find((item) => item.processId === id));
      })
      .catch((reason: Error) => active && setError(reason.message));
    return () => {
      active = false;
    };
  }, [id]);

  if (error && !process)
    return (
      <p
        className="m-6 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm font-medium text-destructive"
        role="alert"
      >
        {error}
      </p>
    );
  if (!process)
    return <main className="app-loading">Prozess wird geladen …</main>;

  const navigation = processNavigationModel(process, opportunity);
  return (
    <section className="mx-auto w-full max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <Link
        className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
        to="/"
      >
        <ArrowLeft className="size-4" /> Zur Prozessübersicht
      </Link>
      <div className="flex items-start justify-between gap-5">
        <div>
          <p className="mb-2 text-sm font-bold uppercase tracking-[0.14em] text-primary">
            Prozess
          </p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
            {process.cover.processName}
          </h1>
          <p className="mt-3 text-muted-foreground">
            {process.cover.department} · {process.id} · aktualisiert{" "}
            {new Date(process.updatedAt).toLocaleString("de-DE", {
              dateStyle: "short",
              timeStyle: "short",
            })}
          </p>
        </div>
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
      </div>
      {error && (
        <p
          className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm font-medium text-destructive"
          role="alert"
        >
          {error}
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-2">
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
        <ProcessModuleCard
          title="KI-Potenziale"
          description="Potenzialhypothesen und drei Szenarien für den Einsatz von KI."
          icon={<Sparkles />}
          state={navigation.opportunity}
          action={opportunityAction(navigation.opportunity)}
        />
      </div>
      {process.interactionMode === "chat" &&
        process.confirmationQuality === "with_gaps" && (
          <p className="rounded-md border border-amber-500/30 bg-amber-50 p-3 text-sm text-amber-950">
            Der Prozess wurde mit offenen Punkten bestätigt.
          </p>
        )}
      <ProcessDeleteDialog
        open={deleteOpen}
        processName={process.cover.processName}
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
              <LoaderCircle className="animate-spin" /> Startet …
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
            <h2 className="text-xl font-semibold">{title}</h2>
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
              <span className="mr-auto text-sm text-muted-foreground">
                {state.blockedReason}
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
