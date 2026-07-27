import { AlertTriangle, LoaderCircle, X } from "lucide-react";
import { api } from "../lib/api-client";
import { useAiOperations } from "../lib/process-events";

export function AiOperationQueue() {
  const operations = useAiOperations();
  if (!operations.length) return null;
  return (
    <aside className="ai-operation-queue" aria-live="polite">
      <b>KI-Aktionen</b>
      {operations.map((operation) => (
        <div key={operation.operationId}>
          {operation.state === "failed" ? (
            <AlertTriangle />
          ) : (
            <LoaderCircle
              className={operation.state === "running" ? "spin" : ""}
            />
          )}
          <span>
            {operationLabel(operation.operationName)} ·{" "}
            {operation.state === "failed"
              ? "fehlgeschlagen"
              : operation.state === "running"
                ? "wird ausgeführt"
                : `Warteplatz ${operation.position}`}
          </span>
          <button
            type="button"
            aria-label={`${operationLabel(operation.operationName)} abbrechen`}
            onClick={async () => {
              // Die aktualisierte Warteschlange kommt über den Ereignisstrom.
              await api.cancelOperation(operation.operationId);
            }}
          >
            <X />
          </button>
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
