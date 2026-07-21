import { LoaderCircle, X } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../lib/api-client";

type Operation = Awaited<ReturnType<typeof api.aiOperations>>[number];

export function AiOperationQueue() {
  const [operations, setOperations] = useState<Operation[]>([]);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const next = await api.aiOperations();
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
          <LoaderCircle
            className={operation.state === "running" ? "spin" : ""}
          />
          <span>
            {operationLabel(operation.operationName)} ·{" "}
            {operation.state === "running"
              ? "wird ausgeführt"
              : `Warteplatz ${operation.position}`}
          </span>
          <button
            type="button"
            aria-label={`${operationLabel(operation.operationName)} abbrechen`}
            onClick={async () => {
              await api.cancelAiOperation(operation.operationId);
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
      gateway: "Einstiegsprüfung",
      "gateway-prepare": "Gespräch vorbereiten",
      "gateway-evaluate": "Einstiegsprüfung",
      "gateway-reevaluate": "Rückfrage am Einstieg",
      "gateway-follow-up": "Rückfrage am Einstieg",
      "form-prefill": "Formularvorschläge",
      chat: "KI-Gespräch",
      "chat-turn": "KI-Gespräch",
      "criterion-discussion": "Kriterium besprechen",
      review: "Abschlussprüfung",
      reviewer: "Abschlussprüfung",
      "review-chat": "Rückfrage zur Prüfung",
      "reviewer-chat": "Rückfrage zur Prüfung",
    }[value] ?? "KI-Unterstützung"
  );
}
