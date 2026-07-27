import type { ProcessOperationStatus } from "./process-operation-manager.ts";

/**
 * Ereignisse, die der Server an offene Oberflächen schickt. "operations" trägt
 * die vollständige Warteschlange, "process-changed" meldet nur, dass sich ein
 * Prozess geändert hat; die Oberfläche lädt die betroffene Ansicht dann neu.
 */
export type ProcessEvent =
  | { type: "operations"; operations: ProcessOperationStatus[] }
  | { type: "process-changed"; processId: string };

type ProcessEventListener = (event: ProcessEvent) => void;

const listeners = new Set<ProcessEventListener>();

export function subscribeProcessEvents(listener: ProcessEventListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function publishProcessEvent(event: ProcessEvent) {
  for (const listener of [...listeners])
    try {
      listener(event);
    } catch (error) {
      // Eine abgebrochene Verbindung darf die übrigen nicht mitreißen.
      console.error("[process-events] listener failed:", error);
    }
}

export function publishProcessChanged(processId: string) {
  publishProcessEvent({ type: "process-changed", processId });
}
