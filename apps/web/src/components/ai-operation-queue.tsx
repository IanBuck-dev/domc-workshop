import { AlertTriangle, LoaderCircle, X } from "lucide-react";
import { api } from "../lib/api-client";
import { useAiOperations } from "../lib/process-events";
import { Button } from "./ui/button";

export function AiOperationQueue() {
  const operations = useAiOperations();
  if (!operations.length) return null;
  return (
    <aside
      className="fixed bottom-4 right-4 z-40 w-[min(26rem,calc(100vw-2rem))] space-y-2 rounded-lg border border-border bg-card p-3 shadow-lg"
      aria-live="polite"
    >
      <b className="text-ui">KI-Aktionen</b>
      {operations.map((operation) => (
        <div
          key={operation.operationId}
          className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-ui"
        >
          {operation.state === "failed" ? (
            <AlertTriangle className="size-4 shrink-0 text-destructive" />
          ) : (
            <LoaderCircle
              className={`size-4 shrink-0 text-primary ${operation.state === "running" ? "animate-spin" : ""}`}
            />
          )}
          <span className="min-w-0 flex-1">
            {operationLabel(operation.operationName)} ·{" "}
            {operation.state === "failed"
              ? "fehlgeschlagen"
              : operation.state === "running"
                ? "wird ausgeführt"
                : `Warteplatz ${operation.position}`}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={`${operationLabel(operation.operationName)} abbrechen`}
            onClick={async () => {
              // Die aktualisierte Warteschlange kommt über den Ereignisstrom.
              await api.cancelOperation(operation.operationId);
            }}
          >
            <X className="size-4" />
          </Button>
        </div>
      ))}
    </aside>
  );
}

function operationLabel(value: string) {
  return (
    {
      "process-follow-ups": "Prozessangaben prüfen",
      "process-synthesis": "Prozessbild erstellen",
      "opportunity-discovery": "KI-Potenziale entdecken",
    }[value] ?? "KI-Unterstützung"
  );
}
