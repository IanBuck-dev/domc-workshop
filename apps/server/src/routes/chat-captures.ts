import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { Hono } from "hono";
import { z } from "zod";
import type { ProcessCaptureRepository } from "../../../../packages/storage/src/process-capture-repository.ts";
import type { ChatCaptureService } from "../chat-capture-service.ts";
import type { OpportunityDiscoveryService } from "../opportunity-discovery-service.ts";
import { publishProcessChanged } from "../process-events.ts";

const confirmSchema = z.object({ override: z.boolean() }).strict();

export function chatCaptureRoutes(
  service: ChatCaptureService,
  processes: ProcessCaptureRepository,
  opportunities: OpportunityDiscoveryService,
) {
  const app = new Hono();
  app.get("/:id/chat", async (c) => {
    try {
      return c.json(await service.view(c.req.param("id")));
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
  app.post("/:id/chat", async (c) => {
    let active: Awaited<ReturnType<ChatCaptureService["startTurn"]>>;
    try {
      active = await service.startTurn(
        c.req.param("id"),
        await c.req.json(),
        c.req.raw.signal,
      );
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
            data: {
              status: reconciliation.status,
              ...(reconciliation.status === "valid"
                ? { revision: reconciliation.revision }
                : {}),
              timestamp: new Date().toISOString(),
            },
          });
        },
      });
      return createUIMessageStreamResponse({ stream });
    }
    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        let lastKey = "";
        let scanning = false;
        const scan = async () => {
          if (scanning) return;
          scanning = true;
          try {
            const value = await service.chats.reconcile(
              await processes.required(active.record.id),
            );
            const key = `${value.status}:${value.status === "valid" ? value.revision : ""}`;
            if (key === lastKey) return;
            lastKey = key;
            writer.write({
              type: "data-understanding-state",
              data: {
                status: value.status,
                ...(value.status === "valid"
                  ? { revision: value.revision }
                  : {}),
                timestamp: new Date().toISOString(),
              },
            });
          } finally {
            scanning = false;
          }
        };
        const watcher = setInterval(() => void scan(), 350);
        try {
          // Claude may emit internal pre-tool narration before it updates the
          // working file. Consume that provider stream for completion and
          // cancellation, but expose only the successfully persisted assistant
          // reply. Validated understanding revisions still reach the UI live
          // through the watcher above.
          void active.result.consumeStream({ onError: () => {} });
          const completed = await service.finishTurn(active);
          const textId = crypto.randomUUID();
          writer.write({ type: "text-start", id: textId });
          writer.write({
            type: "text-delta",
            id: textId,
            delta: completed.assistant.text,
          });
          writer.write({ type: "text-end", id: textId });
          writer.write({
            type: "data-understanding-state",
            data: {
              status: completed.understanding.status,
              ...(completed.understanding.status === "valid"
                ? { revision: completed.understanding.revision }
                : {}),
              timestamp: new Date().toISOString(),
            },
          });
          publishProcessChanged(active.record.id);
        } catch (error) {
          await service.failTurn(active, c.req.raw.signal.aborted);
          throw error;
        } finally {
          clearInterval(watcher);
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
        schemaVersion: 1,
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
