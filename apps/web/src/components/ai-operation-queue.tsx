import { AlertTriangle, LoaderCircle, X } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../lib/api-client";
import type { ProcessOperationStatus } from "../lib/process-types";

export function AiOperationQueue() {
  const [operations, setOperations] = useState<ProcessOperationStatus[]>([]);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const next = await api.operations();
        if (active) setOperations(next);
      } catch {
        // The normal page error handling covers expired sessions.
      }
    };
    void refresh();
    const interval = window.setInterval(refresh, 1000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);
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
              await api.cancelOperation(operation.operationId);
              setOperations((current) =>
                current.filter(
                  (item) => item.operationId !== operation.operationId,
                ),
              );
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
