import { resolve } from "node:path";
import {
  chatUnderstandingEventSchema,
  type ChatActivityKind,
} from "../../../packages/domain/src/chat-capture.ts";
import type { ProcessCaptureRepository } from "../../../packages/storage/src/process-capture-repository.ts";
import type {
  ActiveChatTurn,
  ChatCaptureService,
} from "./chat-capture-service.ts";
import { publishProcessChanged } from "./process-events.ts";

export type ChatUnderstandingEventData = ReturnType<
  typeof chatUnderstandingEventSchema.parse
>;

/**
 * Ereignisse, die ein laufender Zug an angehängte Antwortströme meldet. Sie
 * sind reine Fortschrittsanzeige; der Antworttext kommt am Ende aus `done`.
 */
export type ChatTurnEvent =
  | { type: "activity"; kind: ChatActivityKind }
  | { type: "understanding"; data: ChatUnderstandingEventData };

export type ChatTurnOutcome =
  { ok: true; text: string } | { ok: false; aborted: boolean; message: string };

export type ChatTurnSnapshot = {
  turnId: string;
  action: ActiveChatTurn["action"];
  kind: ChatActivityKind | null;
  startedAt: string;
};

type RunningTurn = {
  processId: string;
  turnId: string;
  action: ActiveChatTurn["action"];
  startedAt: string;
  controller: AbortController;
  kind: ChatActivityKind | null;
  /** Fortschritt zum Nachspielen, falls sich ein Strom erst später anhängt. */
  events: ChatTurnEvent[];
  listeners: Set<(event: ChatTurnEvent) => void>;
  done: Promise<ChatTurnOutcome>;
};

/** Obergrenze des Nachspiel-Puffers; ältere Ereignisse sind ohnehin überholt. */
const maxReplayEvents = 100;

export type StartedChatTurn =
  { duplicate: true } | { duplicate: false; turn: RunningTurn };

/**
 * Führt Chat-Züge unabhängig von der HTTP-Verbindung aus, die sie ausgelöst
 * hat. Ein Neuladen der Seite schließt nur den Antwortstrom — der Zug läuft
 * weiter, schreibt sein Ergebnis ins Transkript und meldet es über den
 * Ereignisstrom. Abgebrochen wird ausschließlich auf ausdrückliche Anforderung
 * (Knopf „Stoppen") oder beim Löschen des Prozesses.
 *
 * Die Registry lebt im Serverspeicher: höchstens ein Zug je Prozess. Ein
 * Serverneustart lässt einen offenen Zug ohne Antwort zurück — dasselbe
 * Verhalten wie vor dieser Änderung.
 */
export class ChatTurnRunner {
  private readonly running = new Map<string, RunningTurn>();

  constructor(
    private readonly service: ChatCaptureService,
    private readonly processes: ProcessCaptureRepository,
  ) {}

  snapshot(id: string): ChatTurnSnapshot | null {
    const entry = this.running.get(id);
    return entry
      ? {
          turnId: entry.turnId,
          action: entry.action,
          kind: entry.kind,
          startedAt: entry.startedAt,
        }
      : null;
  }

  /**
   * Meldet einem frisch angehängten Strom den bisherigen Stand, damit ein
   * zweiter Tab nicht ohne Fortschrittsanzeige dasteht.
   */
  attach(turn: RunningTurn, listener: (event: ChatTurnEvent) => void) {
    for (const event of turn.events) listener(event);
    turn.listeners.add(listener);
    return () => {
      turn.listeners.delete(listener);
    };
  }

  async start(id: string, body: unknown): Promise<StartedChatTurn> {
    if (this.running.has(id))
      throw new Error(
        "Für diesen Prozess läuft bereits eine Antwort. Bitte warten Sie diese ab oder stoppen Sie sie.",
      );
    const controller = new AbortController();
    const active = await this.service.startTurn(id, body, controller.signal);
    if (active.duplicate) return { duplicate: true };
    const entry: RunningTurn = {
      processId: id,
      turnId: active.requestId,
      action: active.action,
      startedAt: new Date().toISOString(),
      controller,
      kind: null,
      events: [],
      listeners: new Set(),
      done: Promise.resolve({ ok: false, aborted: false, message: "" }),
    };
    this.running.set(id, entry);
    entry.done = this.run(entry, active).catch((error) => {
      console.error(
        `[chat-turn] ${id}/${active.requestId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      this.running.delete(id);
      return {
        ok: false as const,
        aborted: false,
        message:
          "Die Antwort konnte nicht abgeschlossen werden. Ihre Angaben bleiben erhalten.",
      };
    });
    // Der Schleusenzustand hat sich bereits geändert (`documentGate`), die
    // Oberfläche soll den Composer sofort zeigen statt erst am Zugende.
    publishProcessChanged(id);
    return { duplicate: false, turn: entry };
  }

  /** Bricht einen laufenden Zug ab und wartet, bis er persistiert ist. */
  async stop(id: string) {
    const entry = this.running.get(id);
    if (!entry) return false;
    entry.controller.abort();
    await entry.done;
    return true;
  }

  private emit(entry: RunningTurn, event: ChatTurnEvent) {
    if (event.type === "activity") {
      if (entry.kind === event.kind) return;
      entry.kind = event.kind;
    }
    entry.events.push(event);
    if (entry.events.length > maxReplayEvents) entry.events.shift();
    for (const listener of [...entry.listeners])
      try {
        listener(event);
      } catch {
        // Ein geschlossener Antwortstrom darf den Zug nicht mitreißen.
      }
  }

  private async run(
    entry: RunningTurn,
    active: Extract<ActiveChatTurn, { duplicate: false }>,
  ): Promise<ChatTurnOutcome> {
    const id = entry.processId;
    const activity = (kind: ChatActivityKind) =>
      this.emit(entry, { type: "activity", kind });
    const understandingState = (
      value: Awaited<ReturnType<ChatCaptureService["chats"]["reconcile"]>>,
    ) =>
      this.emit(entry, {
        type: "understanding",
        data: chatUnderstandingEventSchema.parse({
          status: value.status,
          ...(value.status === "valid" ? { revision: value.revision } : {}),
          timestamp: new Date().toISOString(),
        }),
      });
    let lastKey = "";
    let scanning = false;
    const scan = async () => {
      if (scanning) return;
      scanning = true;
      try {
        const value = await this.service.chats.reconcile(
          await this.processes.required(id),
        );
        const key = `${value.status}:${value.status === "valid" ? value.revision : ""}`;
        if (!lastKey) {
          lastKey = key;
          understandingState(value);
          return;
        }
        if (key === lastKey) return;
        lastKey = key;
        activity("updating_diagram");
        understandingState(value);
      } finally {
        scanning = false;
      }
    };
    if (active.action === "analyze_documents") activity("reading_documents");
    const watcher = setInterval(() => void scan(), 350);
    try {
      for await (const part of active.result.fullStream) {
        const streamPart = part as any;
        if (streamPart.type === "error") throw streamPart.error;
        if (streamPart.type === "abort")
          throw new Error("Chat turn aborted by provider.");
        if (
          streamPart.type === "tool-input-start" &&
          active.action === "analyze_documents" &&
          (streamPart.toolName === "Read" || streamPart.toolName === "Glob")
        ) {
          activity("reading_documents");
          continue;
        }
        if (streamPart.type !== "tool-call") continue;
        const toolName = streamPart.toolName;
        if (
          active.action === "analyze_documents" &&
          (toolName === "Read" || toolName === "Glob")
        ) {
          activity("reading_documents");
          continue;
        }
        if (toolName === "write_process_flow") {
          activity("updating_diagram");
          continue;
        }
        if (toolName !== "Write") continue;
        const input = streamPart.input;
        const target =
          input && typeof input === "object"
            ? ((input as Record<string, unknown>).file_path ??
              (input as Record<string, unknown>).path)
            : undefined;
        if (
          typeof target === "string" &&
          ["process-understanding.json", "process-definition.json"].some(
            (name) =>
              resolve(this.processes.dir(id), target) ===
              resolve(this.processes.dir(id), name),
          )
        )
          activity("updating_diagram");
      }
      activity("checking_open_points");
      const completed = await this.service.finishTurn(active);
      understandingState(completed.understanding);
      return { ok: true, text: completed.assistant.text };
    } catch (error) {
      console.error(
        `[chat-turn] ${id}/${active.requestId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      const aborted = entry.controller.signal.aborted;
      await this.service.failTurn(active, aborted);
      return {
        ok: false,
        aborted,
        message:
          "Die Antwort konnte nicht abgeschlossen werden. Ihre Angaben bleiben erhalten.",
      };
    } finally {
      clearInterval(watcher);
      this.running.delete(id);
      entry.listeners.clear();
      publishProcessChanged(id);
    }
  }
}
