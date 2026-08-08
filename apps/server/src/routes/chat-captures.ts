import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { Hono } from "hono";
import { z } from "zod";
import {
  chatActivityEventSchema,
  chatUnderstandingEventSchema,
} from "../../../../packages/domain/src/chat-capture.ts";
import type { ProcessCaptureRepository } from "../../../../packages/storage/src/process-capture-repository.ts";
import type { ChatCaptureService } from "../chat-capture-service.ts";
import { ChatTurnRunner } from "../chat-turn-runner.ts";
import type { OpportunityDiscoveryService } from "../opportunity-discovery-service.ts";
import { publishProcessChanged } from "../process-events.ts";

const confirmSchema = z.object({ override: z.boolean() }).strict();
const skipSchema = z.object({ id: z.string().uuid() }).strict();

export function chatCaptureRoutes(
  service: ChatCaptureService,
  processes: ProcessCaptureRepository,
  opportunities: OpportunityDiscoveryService,
  runner: ChatTurnRunner = new ChatTurnRunner(service, processes),
) {
  const app = new Hono();
  app.get("/:id/chat", async (c) => {
    try {
      const id = c.req.param("id");
      return c.json({
        ...(await service.view(id)),
        activeTurn: runner.snapshot(id),
      });
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error ? error.message : "Chat nicht verfügbar.",
        },
        409,
      );
    }
  });
  app.post("/:id/chat/skip-documents", async (c) => {
    try {
      const body = skipSchema.parse(await c.req.json());
      const id = c.req.param("id");
      const result = await service.skipDocuments(id, body.id);
      publishProcessChanged(id);
      return c.json(result);
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Der Vorgang konnte nicht fortgesetzt werden.",
        },
        409,
      );
    }
  });
  app.post("/:id/chat/stop", async (c) => {
    const stopped = await runner.stop(c.req.param("id"));
    return stopped
      ? c.json({ stopped: true })
      : c.json({ error: "Es läuft keine Antwort." }, 409);
  });
  app.post("/:id/chat", async (c) => {
    let active: Awaited<ReturnType<ChatTurnRunner["start"]>>;
    try {
      active = await runner.start(c.req.param("id"), await c.req.json());
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Die Antwort konnte nicht begonnen werden.",
        },
        409,
      );
    }
    if (active.duplicate) {
      const stream = createUIMessageStream({
        async execute({ writer }) {
          const record = await processes.required(c.req.param("id"));
          const reconciliation = await service.chats.reconcile(record);
          writer.write({
            type: "data-understanding-state",
            data: chatUnderstandingEventSchema.parse({
              status: reconciliation.status,
              ...(reconciliation.status === "valid"
                ? { revision: reconciliation.revision }
                : {}),
              timestamp: new Date().toISOString(),
            }),
            transient: true,
          });
          writer.write({
            type: "data-chat-activity",
            data: chatActivityEventSchema.parse({
              schemaVersion: 1,
              state: "idle",
              timestamp: new Date().toISOString(),
            }),
            transient: true,
          });
        },
      });
      return createUIMessageStreamResponse({ stream });
    }
    // Der Zug selbst läuft im Runner und überlebt diese Verbindung. Hier wird
    // nur zugehört: Fortschritt weiterreichen, am Ende den Antworttext
    // schreiben. Bricht die Verbindung ab (Neuladen), fällt allein der Zuhörer
    // weg.
    const turn = active.turn;
    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        const detach = runner.attach(turn, (event) => {
          if (event.type === "activity")
            writer.write({
              type: "data-chat-activity",
              data: chatActivityEventSchema.parse({
                schemaVersion: 1,
                state: "active",
                kind: event.kind,
                timestamp: new Date().toISOString(),
              }),
              transient: true,
            });
          else
            writer.write({
              type: "data-understanding-state",
              data: event.data,
              transient: true,
            });
        });
        try {
          const outcome = await turn.done;
          // Ein ausdrücklich gestoppter Zug ist kein Fehler: Die Stopp-Meldung
          // steht bereits im Transkript, die Oberfläche lädt es nach.
          if (!outcome.ok) {
            if (outcome.aborted) return;
            throw new Error(outcome.message);
          }
          const textId = crypto.randomUUID();
          writer.write({ type: "text-start", id: textId });
          writer.write({
            type: "text-delta",
            id: textId,
            delta: outcome.text,
          });
          writer.write({ type: "text-end", id: textId });
        } finally {
          detach();
          writer.write({
            type: "data-chat-activity",
            data: chatActivityEventSchema.parse({
              schemaVersion: 1,
              state: "idle",
              timestamp: new Date().toISOString(),
            }),
            transient: true,
          });
        }
      },
      onError: () =>
        "Die Antwort konnte nicht abgeschlossen werden. Ihre Angaben bleiben erhalten.",
    });
    return createUIMessageStreamResponse({ stream });
  });
  app.post("/:id/chat/confirm", async (c) => {
    try {
      const body = confirmSchema.parse(await c.req.json());
      const record = await processes.required(c.req.param("id"));
      if (record.interactionMode !== "chat")
        return c.json(
          { error: "Dieser Prozess wird im Formular erfasst." },
          409,
        );
      const finalized = await service.chats.finalize(record, body.override);
      if (finalized.overrideRequired)
        return c.json(
          {
            error: "Offene Punkte müssen ausdrücklich bestätigt werden.",
            code: "confirmation_override_required",
            knowledgeGaps: finalized.understanding.knowledgeGaps,
            conflicts: finalized.understanding.conflicts,
          },
          409,
        );
      const next = await processes.finalizeChatCapture(
        record.id,
        finalized.understanding,
        finalized.quality,
      );
      await service.chats.append(record.id, {
        schemaVersion: 2,
        id: crypto.randomUUID(),
        turnId: null,
        at: new Date().toISOString(),
        role: "assistant",
        status: "complete",
        text: "Vielen Dank. Der Prozess wurde übermittelt und fachlich bestätigt. Die Ermittlung möglicher KI-Potenziale startet im Hintergrund.",
        mentions: [],
        action: "confirmation",
      });
      let opportunityStart: "started" | "failed" = "started";
      try {
        await opportunities.start(record.id);
      } catch (error) {
        opportunityStart = "failed";
        await processes.appendHistory(
          record.id,
          "opportunity-auto-start-failed",
          {
            message:
              error instanceof Error ? error.message : "Start fehlgeschlagen",
          },
        );
      }
      publishProcessChanged(record.id);
      return c.json({ record: next, opportunityStart });
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Bestätigung nicht möglich.",
        },
        409,
      );
    }
  });
  return app;
}
