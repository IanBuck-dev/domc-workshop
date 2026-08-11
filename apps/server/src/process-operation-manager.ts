import { publishProcessEvent } from "./process-events.ts";
import type {
  MemoryConsolidationStatus,
  ProcessOperationName,
  ProcessOperationStatus,
} from "../../../packages/domain/src/process-events.ts";
import type { MemoryConsolidationSummary } from "../../../packages/domain/src/memory.ts";

interface ManagedOperation extends Omit<ProcessOperationStatus, "position"> {
  controller: AbortController;
  onQueuedCancel?: () => Promise<void>;
}
export interface EnqueueProcessOperationOptions {
  /** Allows exactly one explicitly chained operation after an active process operation. */
  allowSameProcessFollowup?: boolean;
}

const operations = new Map<string, ManagedOperation>();
let queueTail: Promise<void> = Promise.resolve();
let memoryConsolidation: MemoryConsolidationStatus = { state: "idle" };

export class MemoryConsolidationConflictError extends Error {
  constructor() {
    super("Ein Lauf zum Aufräumen des Unternehmenswissens läuft bereits.");
  }
}

function publicError(error: unknown, operationName: ProcessOperationName) {
  if (operationName === "documentation-sync")
    return error instanceof DOMException && error.name === "AbortError"
      ? "Die Dokumentationsaktualisierung wurde abgebrochen. Sie kann erneut gestartet werden."
      : "Die Dokumentation konnte nicht aktualisiert werden. Die Bestätigung bleibt erhalten und der nächste Abgleich holt die Änderung nach.";
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

function publishMemoryConsolidation() {
  publishProcessEvent({
    type: "memory-consolidation",
    ...memoryConsolidation,
  });
}

export function memoryConsolidationStatus(): MemoryConsolidationStatus {
  return structuredClone(memoryConsolidation);
}

export function enqueueMemoryConsolidation(
  action: (signal: AbortSignal) => Promise<MemoryConsolidationSummary>,
) {
  if (["queued", "running"].includes(memoryConsolidation.state))
    throw new MemoryConsolidationConflictError();
  const controller = new AbortController();
  const operationId = crypto.randomUUID();
  memoryConsolidation = { operationId, state: "queued" };
  publishMemoryConsolidation();
  const previous = queueTail;
  queueTail = (async () => {
    await previous.catch(() => undefined);
    memoryConsolidation = { operationId, state: "running" };
    publishMemoryConsolidation();
    try {
      const summary = await action(controller.signal);
      memoryConsolidation = { operationId, state: "completed", summary };
      publishMemoryConsolidation();
    } catch (error) {
      console.error(`[memory-consolidation] ${operationId} failed:`, error);
      memoryConsolidation = {
        operationId,
        state: "failed",
        error:
          "Das Unternehmenswissen konnte nicht aufgeräumt werden. Der vorherige Stand ist im Änderungsverlauf gesichert.",
      };
      publishMemoryConsolidation();
    }
  })();
  return { operationId, state: "queued" as const };
}

export function hasActiveProcessOperation(processId: string) {
  return [...operations.values()].some(
    (operation) =>
      operation.processId === processId &&
      operation.state !== "failed" &&
      operation.operationName !== "documentation-sync",
  );
}

/** Löschen muss auch den deterministischen Dokumentationsschreibjob abwarten. */
export function hasActiveWriteOperation(processId: string) {
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
  options: EnqueueProcessOperationOptions = {},
) {
  // Die Dokumentationssynchronisation ist deterministisch und braucht keine
  // Claude-Session. Sie konkurriert deshalb in keiner Richtung mit den
  // KI-Aktionen eines Prozesses — weder blockiert sie, noch wird sie blockiert.
  const activeForProcess =
    operationName === "documentation-sync"
      ? []
      : [...operations.values()].filter(
          (operation) =>
            operation.processId === processId &&
            operation.state !== "failed" &&
            operation.operationName !== "documentation-sync",
        );
  if (
    activeForProcess.length &&
    (!options.allowSameProcessFollowup || activeForProcess.length > 1)
  )
    throw new Error("Für diesen Prozess läuft bereits eine KI-Aktion.");
  for (const [id, operation] of operations)
    if (
      operation.processId === processId &&
      operation.state === "failed" &&
      operation.operationName === operationName
    )
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
      operation.error = publicError(error, operation.operationName);
      publishOperations();
    }
  })();
  return { operationId, state: "queued" as const };
}

/**
 * Deterministische globale Jobs teilen dieselbe Reihenfolge, erscheinen aber nicht
 * als künstlicher Prozess im Operations-Panel.
 */
export function runGlobalOperation<T>(
  action: (signal: AbortSignal) => Promise<T>,
) {
  const controller = new AbortController();
  const previous = queueTail;
  const result = (async () => {
    await previous.catch(() => undefined);
    return action(controller.signal);
  })();
  queueTail = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}
