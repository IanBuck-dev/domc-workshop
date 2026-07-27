import { publishProcessEvent } from "./process-events.ts";
import type {
  ProcessOperationName,
  ProcessOperationStatus,
} from "../../../packages/domain/src/process-events.ts";

interface ManagedOperation extends Omit<ProcessOperationStatus, "position"> {
  controller: AbortController;
  onQueuedCancel?: () => Promise<void>;
}

const operations = new Map<string, ManagedOperation>();
let queueTail: Promise<void> = Promise.resolve();

function publicError(error: unknown) {
  if (error instanceof DOMException && error.name === "AbortError")
    return "Die KI-Aktion wurde abgebrochen. Sie können sie erneut starten.";
  return "Die KI-Aktion konnte nicht abgeschlossen werden. Ihre Angaben bleiben erhalten und die Aktion kann erneut gestartet werden.";
}

export function listProcessOperations(): ProcessOperationStatus[] {
  let position = 0;
  return [...operations.values()].map((operation) => ({
    operationId: operation.operationId,
    processId: operation.processId,
    operationName: operation.operationName,
    state: operation.state,
    position:
      operation.state === "running" || operation.state === "failed"
        ? 0
        : ++position,
    createdAt: operation.createdAt,
    ...(operation.error ? { error: operation.error } : {}),
  }));
}
/** Nach jeder Änderung an der Warteschlange melden, damit niemand pollen muss. */
function publishOperations() {
  publishProcessEvent({
    type: "operations",
    operations: listProcessOperations(),
  });
}

export function hasActiveProcessOperation(processId: string) {
  return [...operations.values()].some(
    (operation) =>
      operation.processId === processId && operation.state !== "failed",
  );
}
export async function cancelProcessOperation(operationId: string) {
  const operation = operations.get(operationId);
  if (!operation || operation.state === "failed") return false;
  operation.controller.abort();
  if (operation.state === "queued") {
    operations.delete(operationId);
    await operation.onQueuedCancel?.();
    publishOperations();
  }
  return true;
}
export function dismissFailedOperation(operationId: string) {
  const operation = operations.get(operationId);
  if (!operation || operation.state !== "failed") return false;
  operations.delete(operationId);
  publishOperations();
  return true;
}

export function dismissFailedProcessOperations(processId: string) {
  let dismissed = 0;
  for (const [operationId, operation] of operations) {
    if (operation.processId !== processId || operation.state !== "failed")
      continue;
    operations.delete(operationId);
    dismissed += 1;
  }
  if (dismissed) publishOperations();
  return dismissed;
}

export function enqueueProcessOperation(
  processId: string,
  operationName: ProcessOperationName,
  action: (signal: AbortSignal) => Promise<void>,
  onQueuedCancel?: () => Promise<void>,
) {
  if (hasActiveProcessOperation(processId))
    throw new Error("Für diesen Prozess läuft bereits eine KI-Aktion.");
  for (const [id, operation] of operations)
    if (operation.processId === processId && operation.state === "failed")
      operations.delete(id);
  const operationId = crypto.randomUUID();
  const controller = new AbortController();
  const operation: ManagedOperation = {
    operationId,
    processId,
    operationName,
    state: "queued",
    createdAt: new Date().toISOString(),
    controller,
    onQueuedCancel,
  };
  operations.set(operationId, operation);
  publishOperations();
  const previous = queueTail;
  queueTail = (async () => {
    await previous.catch(() => undefined);
    if (controller.signal.aborted) {
      operations.delete(operationId);
      publishOperations();
      return;
    }
    operation.state = "running";
    publishOperations();
    try {
      await action(controller.signal);
      operations.delete(operationId);
      publishOperations();
    } catch (error) {
      if (controller.signal.aborted) {
        operations.delete(operationId);
        publishOperations();
        return;
      }
      console.error(
        `[${operation.operationName}] ${operation.operationId} failed for ${operation.processId}:`,
        error,
      );
      operation.state = "failed";
      operation.error = publicError(error);
      publishOperations();
    }
  })();
  return { operationId, state: "queued" as const };
}
