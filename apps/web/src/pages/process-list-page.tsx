import { useEffect, useState } from "react";
import { Workflow } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "../components/ui/card";
import {
  ProcessListTable,
  ProcessListTableSkeleton,
} from "../components/process-list-table";
import { Button } from "../components/ui/button";
import { api } from "../lib/api-client";
import type { OpportunityDiscoverySummary } from "../lib/opportunity-types";
import type { ProcessCaptureRecord } from "../lib/process-types";

export function ProcessListPage() {
  const [records, setRecords] = useState<ProcessCaptureRecord[]>([]);
  const [opportunities, setOpportunities] = useState<
    OpportunityDiscoverySummary[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let isCurrent = true;
    Promise.all([api.processes(), api.opportunitySummaries()])
      .then(([processes, summaries]) => {
        if (!isCurrent) return;
        setRecords(processes);
        setOpportunities(summaries);
      })
      .catch((reason: Error) => {
        if (isCurrent) setError(reason.message);
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });
    return () => {
      isCurrent = false;
    };
  }, []);
  const header = (
    <div>
      <h1 className="text-title sm:text-display">Prozesse</h1>
    </div>
  );
  return (
    <section className="mx-auto w-full max-w-7xl space-y-7 px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      {error && (
        <p
          className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-label text-destructive"
          role="alert"
        >
          {error}
        </p>
      )}
      {isLoading ? (
        <ProcessListTableSkeleton header={header} />
      ) : !records.length ? (
        <>
          {header}
          <Card>
            <CardContent className="grid place-items-center gap-3 p-10 text-center">
              <Workflow className="size-8 text-primary" />
              <h2 className="text-heading">Noch kein Prozess erfasst</h2>
              <p className="text-muted-foreground">
                Starten Sie mit einem fiktiven oder anonymisierten Prozess.
              </p>
              <Button asChild>
                <Link to="/processes/new">Prozess erfassen</Link>
              </Button>
            </CardContent>
          </Card>
        </>
      ) : (
        <ProcessListTable
          records={records}
          opportunities={opportunities}
          header={header}
        />
      )}
    </section>
  );
}
