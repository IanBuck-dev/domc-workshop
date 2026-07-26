export type ProcessOperationName = "process-follow-ups" | "process-synthesis";
export interface ProcessOperationStatus {
  operationId: string;
  processId: string;
  operationName: ProcessOperationName;
  state: "queued" | "running" | "failed";
  position: number;
  createdAt: string;
  error?: string;
}
interface ManagedOperation extends Omit<ProcessOperationStatus, "position"> {
  controller: AbortController;
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
export function hasActiveProcessOperation(processId: string) {
  return [...operations.values()].some(
    (operation) =>
      operation.processId === processId && operation.state !== "failed",
  );
}
export function cancelProcessOperation(operationId: string) {
  const operation = operations.get(operationId);
  if (!operation || operation.state === "failed") return false;
  operation.controller.abort();
  if (operation.state === "queued") operations.delete(operationId);
  return true;
}
export function dismissFailedOperation(operationId: string) {
  const operation = operations.get(operationId);
  if (!operation || operation.state !== "failed") return false;
  operations.delete(operationId);
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
  return dismissed;
}

export function enqueueProcessOperation(
  processId: string,
  operationName: ProcessOperationName,
  action: (signal: AbortSignal) => Promise<void>,
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
  };
  operations.set(operationId, operation);
  const previous = queueTail;
  queueTail = (async () => {
    await previous.catch(() => undefined);
    if (controller.signal.aborted) {
      operations.delete(operationId);
      return;
    }
    operation.state = "running";
    try {
      await action(controller.signal);
      operations.delete(operationId);
    } catch (error) {
      if (controller.signal.aborted) {
        operations.delete(operationId);
        return;
      }
      console.error(
        `[${operation.operationName}] ${operation.operationId} failed for ${operation.processId}:`,
        error,
      );
      operation.state = "failed";
      operation.error = publicError(error);
    }
  })();
  return { operationId, state: "queued" as const };
}
