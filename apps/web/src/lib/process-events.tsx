import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { ProcessOperationStatus } from "./process-types";

type ProcessChangeHandler = (processId: string) => void;
type Subscribe = (handler: ProcessChangeHandler) => () => void;

const OperationsContext = createContext<ProcessOperationStatus[]>([]);
const SubscribeContext = createContext<Subscribe>(() => () => undefined);

/**
 * Hält eine Verbindung zum Ereignisstrom des Servers offen. Der Server meldet
 * von sich aus, wenn sich die KI-Warteschlange oder ein Prozess ändert; die
 * Oberfläche fragt nichts in festen Abständen ab.
 */
export function ProcessEventsProvider({ children }: { children: ReactNode }) {
  const [operations, setOperations] = useState<ProcessOperationStatus[]>([]);
  const handlers = useRef(new Set<ProcessChangeHandler>());
  const subscribe = useRef<Subscribe>((handler) => {
    handlers.current.add(handler);
    return () => {
      handlers.current.delete(handler);
    };
  }).current;

  useEffect(() => {
    const source = new EventSource("/api/events");
    source.addEventListener("operations", (event) => {
      const payload = JSON.parse(event.data) as {
        operations: ProcessOperationStatus[];
      };
      setOperations(payload.operations);
    });
    source.addEventListener("process-changed", (event) => {
      const payload = JSON.parse(event.data) as { processId: string };
      for (const handler of [...handlers.current]) handler(payload.processId);
    });
    return () => source.close();
  }, []);

  return (
    <SubscribeContext.Provider value={subscribe}>
      <OperationsContext.Provider value={operations}>
        {children}
      </OperationsContext.Provider>
    </SubscribeContext.Provider>
  );
}

/** Die laufenden und wartenden KI-Aktionen, so wie der Server sie zuletzt meldete. */
export function useAiOperations() {
  return useContext(OperationsContext);
}

/** Ruft onChange auf, sobald der Server eine Änderung an diesem Prozess meldet. */
export function useProcessChanged(processId: string, onChange: () => void) {
  const subscribe = useContext(SubscribeContext);
  const latest = useRef(onChange);
  useEffect(() => {
    latest.current = onChange;
  });
  useEffect(
    () =>
      subscribe((changed) => {
        if (changed === processId) latest.current();
      }),
    [subscribe, processId],
  );
}
