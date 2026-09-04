import { ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, Outlet, useLocation, useParams } from "react-router-dom";
import { OpportunityProgress } from "../components/opportunity-progress";
import { Skeleton } from "../components/ui/skeleton";
import { api } from "../lib/api-client";
import type { AgenticPotentialAssessmentDetail } from "../lib/agentic-potential-assessment-types";
import type { OpportunityDiscoveryDetail } from "../lib/opportunity-types";
import type { ProcessCaptureRecord } from "../lib/process-types";
import { useProcessChanged } from "../lib/process-events";
import type { OpportunityWorkspaceContext } from "../lib/opportunity-workspace";

export function OpportunityWorkspacePage() {
  const { id = "" } = useParams();
  const location = useLocation();
  const [process, setProcess] = useState<ProcessCaptureRecord | null>(null);
  const [opportunity, setOpportunity] =
    useState<OpportunityDiscoveryDetail | null>(null);
  const [assessment, setAssessment] =
    useState<AgenticPotentialAssessmentDetail | null>(null);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    const [nextProcess, nextOpportunity, nextAssessment] = await Promise.all([
      api.process(id),
      api.opportunity(id),
      api.agenticAssessment(id),
    ]);
    setProcess(nextProcess);
    setOpportunity(nextOpportunity);
    setAssessment(nextAssessment);
    setError("");
  }, [id]);

  useEffect(() => {
    void reload().catch((reason) => setError((reason as Error).message));
  }, [reload]);
  useProcessChanged(id, () => {
    void reload().catch((reason) => setError((reason as Error).message));
  });

  if (error && (!process || !opportunity))
    return (
      <section className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <BackLink id={id} />
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-ui text-destructive"
        >
          {error}
        </p>
      </section>
    );
  if (!process || !opportunity) return <OpportunityWorkspaceSkeleton id={id} />;

  const active = location.pathname.endsWith("/agentic-assessment")
    ? "assessment"
    : location.pathname.endsWith("/scenarios")
      ? "scenarios"
      : "hypotheses";

  return (
    <section className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <BackLink id={id} />
      <div className="flex flex-col justify-between gap-6 xl:flex-row xl:items-end">
        <div className="min-w-0">
          <p className="text-eyebrow uppercase text-primary">KI-Potenziale</p>
          <h1 className="mt-1 text-title sm:text-display">
            {process.cover.processName}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {process.cover.department}
          </p>
        </div>
        <OpportunityProgress
          record={opportunity.record}
          processId={id}
          active={active}
        />
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-ui text-destructive"
        >
          {error}
        </p>
      )}
      <Outlet
        context={
          {
            process,
            opportunity,
            assessment,
            reload,
          } satisfies OpportunityWorkspaceContext
        }
      />
    </section>
  );
}

function BackLink({ id }: { id: string }) {
  return (
    <Link
      className="inline-flex items-center gap-2 text-label text-primary hover:underline"
      to={`/processes/${id}`}
    >
      <ArrowLeft /> Zum Prozess
    </Link>
  );
}

function OpportunityWorkspaceSkeleton({ id }: { id: string }) {
  return (
    <section className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <BackLink id={id} />
      <div
        className="flex flex-col justify-between gap-6 xl:flex-row xl:items-end"
        role="status"
        aria-busy="true"
        aria-label="KI-Potenziale werden geladen"
      >
        <span className="sr-only">KI-Potenziale werden geladen</span>
        <div className="space-y-2">
          <p className="text-eyebrow uppercase text-primary">KI-Potenziale</p>
          <Skeleton className="mt-1 h-9 w-72 sm:h-11" />
          <Skeleton className="mt-2 h-4 w-56" />
        </div>
        <Skeleton className="h-14 w-full sm:w-[30rem]" />
      </div>
      <Skeleton className="h-64 w-full rounded-lg" />
    </section>
  );
}
