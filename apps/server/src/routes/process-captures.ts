import { Hono } from "hono";
import { z } from "zod";
import {
  followUpAnswerSchema,
  processCaptureConfigSchema,
  processUnderstandingSchema,
  topicAnswerSchema,
  understandingSectionSchema,
  workCharacteristicAnswerSchema,
  workCharacteristicAnswersSchema,
  type ProcessCaptureRecord,
} from "../../../../packages/domain/src/process-understanding.ts";
import {
  ProcessCaptureNotFoundError,
  ProcessUploadIntegrityError,
  ProcessUploadNotFoundError,
  type ProcessCaptureRepository,
} from "../../../../packages/storage/src/process-capture-repository.ts";
import type {
  ProcessAiAdapter,
  ProcessAiModelConfig,
  ProcessSelectedUpload,
} from "../../../../packages/claude/src/process-ai-contracts.ts";
import {
  dismissFailedProcessOperations,
  enqueueProcessOperation,
  hasActiveProcessOperation,
} from "../process-operation-manager.ts";
import { publishProcessChanged } from "../process-events.ts";

const createSchema = z.object({
  cover: z.unknown(),
  config: processCaptureConfigSchema,
  demoDataConfirmed: z.literal(true),
});
const answersSchema = z.object({
  answers: z.array(topicAnswerSchema).length(5),
  workCharacteristicAnswers: z
    .array(workCharacteristicAnswerSchema)
    .max(4)
    .default([]),
  selectedUploadIds: z.array(z.string().uuid()).max(5).default([]),
});
const followUpsSchema = z.object({
  answers: z.array(followUpAnswerSchema).max(5),
});
const correctionSchema = z.object({
  understanding: processUnderstandingSchema,
  note: z.string().trim().min(3).max(2_000),
});
const workCharacteristicCorrectionSchema = z.object({
  answers: workCharacteristicAnswersSchema,
  reason: z.string().trim().min(3).max(2_000),
});

function model(record: ProcessCaptureRecord): ProcessAiModelConfig {
  const ai = record.configSnapshot.ai;
  return {
    model: "claude-opus-4-8",
    effort: "medium",
    timeoutMs: ai.timeoutMs,
    maxOutputTokens: ai.maxOutputTokens,
    maxInputCharacters: ai.maxInputCharacters,
    maxBudgetUsd: ai.maxBudgetUsd,
  };
}
function selectedUploads(
  repo: ProcessCaptureRepository,
  record: ProcessCaptureRecord,
): ProcessSelectedUpload[] {
  return record.selectedUploadIds.map((id) => {
    const upload = record.uploads.find((item) => item.id === id);
    if (!upload)
      throw new Error("Eine ausgewählte Datei gehört nicht zu diesem Prozess.");
    return {
      id,
      name: upload.name,
      path: repo.uploadPath(record.id, id, upload.name),
      size: upload.size,
      sha256: upload.sha256,
    };
  });
}
function workCharacteristicDefinitions(record: ProcessCaptureRecord) {
  return "workCharacteristics" in record.configSnapshot
    ? record.configSnapshot.workCharacteristics
    : [];
}
function conflict(
  c: { json: (value: { error: string }, status: 409) => Response },
  error: unknown,
) {
  return c.json(
    {
      error:
        error instanceof Error
          ? error.message
          : "Die Aktion ist in diesem Status nicht verfügbar.",
    },
    409,
  );
}
function repositoryError(
  c: {
    json: (value: { error: string }, status: 400 | 404 | 409) => Response;
  },
  error: unknown,
) {
  if (error instanceof ProcessCaptureNotFoundError)
    return c.json({ error: error.message }, 404);
  if (error instanceof z.ZodError)
    return c.json(
      {
        error:
          error.issues[0]?.message ??
          "Die übermittelten Angaben sind ungültig.",
      },
      400,
    );
  return conflict(c, error);
}

function contentDisposition(name: string, download: boolean) {
  const ascii = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  const encoded = encodeURIComponent(name).replace(
    /[!'()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `${download ? "attachment" : "inline"}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

export function processCaptureRoutes(
  repo: ProcessCaptureRepository,
  ai: ProcessAiAdapter,
) {
  const app = new Hono();
  app.get("/", async (c) => c.json(await repo.list()));
  app.post("/", async (c) => {
    const body = createSchema.parse(await c.req.json());
    return c.json(await repo.create(body.cover, body.config), 201);
  });
  app.get("/:id", async (c) => {
    const record = await repo.get(c.req.param("id"));
    return record
      ? c.json(record)
      : c.json({ error: "Prozess nicht gefunden." }, 404);
  });
  app.get("/:id/history", async (c) =>
    c.json(await repo.history(c.req.param("id"))),
  );
  app.put("/:id/answers", async (c) => {
    const body = answersSchema.parse(await c.req.json());
    try {
      return c.json(
        await repo.saveMainAnswers(
          c.req.param("id"),
          body.answers,
          body.workCharacteristicAnswers,
          body.selectedUploadIds,
        ),
      );
    } catch (error) {
      return repositoryError(c, error);
    }
  });
  app.post("/:id/uploads", async (c) => {
    const body = await c.req.parseBody();
    if (!(body.file instanceof File))
      return c.json({ error: "Keine Datei ausgewählt." }, 400);
    try {
      return c.json(await repo.saveUpload(c.req.param("id"), body.file), 201);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Datei konnte nicht gespeichert werden.";
      if (/Dateityp|Medientyp|Dateiinhalt|Office-Datei|Textdatei/.test(message))
        return c.json({ error: message }, 415);
      if (message.includes("20 MB")) return c.json({ error: message }, 413);
      if (error instanceof ProcessCaptureNotFoundError)
        return c.json({ error: error.message }, 404);
      return c.json({ error: message }, 409);
    }
  });
  app.get("/:id/uploads/:uploadId", async (c) => {
    try {
      const { upload, bytes } = await repo.readUpload(
        c.req.param("id"),
        c.req.param("uploadId"),
      );
      const download = c.req.query("download") === "1";
      const body = new Uint8Array(new ArrayBuffer(bytes.byteLength));
      body.set(bytes);
      return new Response(body.buffer, {
        headers: {
          "Cache-Control": "private, no-store",
          "Content-Disposition": contentDisposition(upload.name, download),
          "Content-Length": String(bytes.byteLength),
          "Content-Type": upload.mediaType,
          "Cross-Origin-Resource-Policy": "same-origin",
          "X-Content-Type-Options": "nosniff",
        },
      });
    } catch (error) {
      if (
        error instanceof ProcessCaptureNotFoundError ||
        error instanceof ProcessUploadNotFoundError
      )
        return c.json({ error: error.message }, 404);
      if (error instanceof ProcessUploadIntegrityError)
        return c.json(
          { error: "Die Datei kann derzeit nicht bereitgestellt werden." },
          500,
        );
      throw error;
    }
  });
  app.delete("/:id/uploads/:uploadId", async (c) => {
    try {
      await repo.removeUpload(c.req.param("id"), c.req.param("uploadId"));
      return c.json({ removed: true });
    } catch (error) {
      return repositoryError(c, error);
    }
  });
  app.post("/:id/analyze", async (c) => {
    const record = await repo.required(c.req.param("id"));
    if (
      record.state !== "capture_in_progress" ||
      record.mainAnswers.length !== 5 ||
      (record.profile.version === 2 &&
        !workCharacteristicAnswersSchema.safeParse(
          record.workCharacteristicAnswers,
        ).success)
    )
      return c.json(
        {
          error:
            "Bitte speichern Sie zuerst alle fünf Antworten und vier Arbeitsmerkmale.",
        },
        409,
      );
    if (hasActiveProcessOperation(record.id))
      return c.json(
        { error: "Für diesen Prozess läuft bereits eine KI-Aktion." },
        409,
      );
    const queued = enqueueProcessOperation(
      record.id,
      "process-follow-ups",
      async (signal) => {
        try {
          const result = await ai.followUps({
            processId: record.id,
            configHash: record.configHash,
            model: model(record),
            instructions: record.configSnapshot.instructions.followUps,
            selectedUploads: selectedUploads(repo, record),
            cover: record.cover,
            topics: record.configSnapshot.topics,
            mainAnswers: record.mainAnswers,
            workCharacteristicDefinitions:
              workCharacteristicDefinitions(record),
            workCharacteristicAnswers: record.workCharacteristicAnswers,
            signal,
          });
          await repo.saveFollowUps(
            record.id,
            result.value.followUps,
            result.trace,
          );
          publishProcessChanged(record.id);
        } catch (error) {
          await repo.recordAiOperation(
            record.id,
            "process-follow-ups",
            signal.aborted ? "cancelled" : "failed",
            undefined,
            "Die Aktion konnte nicht abgeschlossen werden.",
          );
          publishProcessChanged(record.id);
          throw error;
        }
      },
    );
    return c.json(queued, 202);
  });
  app.put("/:id/follow-ups", async (c) => {
    const body = followUpsSchema.parse(await c.req.json());
    try {
      return c.json(
        await repo.saveFollowUpAnswers(c.req.param("id"), body.answers),
      );
    } catch (error) {
      return repositoryError(c, error);
    }
  });
  app.post("/:id/synthesize", async (c) => {
    const record = await repo.required(c.req.param("id"));
    if (record.state !== "synthesis_ready")
      return c.json(
        { error: "Das Prozessbild ist noch nicht bereit zur Erstellung." },
        409,
      );
    if (hasActiveProcessOperation(record.id))
      return c.json(
        { error: "Für diesen Prozess läuft bereits eine KI-Aktion." },
        409,
      );
    const queued = enqueueProcessOperation(
      record.id,
      "process-synthesis",
      async (signal) => {
        try {
          const result = await ai.synthesize({
            processId: record.id,
            configHash: record.configHash,
            model: model(record),
            instructions: record.configSnapshot.instructions.synthesis,
            selectedUploads: selectedUploads(repo, record),
            cover: record.cover,
            topics: record.configSnapshot.topics,
            mainAnswers: record.mainAnswers,
            workCharacteristicDefinitions:
              workCharacteristicDefinitions(record),
            workCharacteristicAnswers: record.workCharacteristicAnswers,
            followUps: record.followUps,
            followUpAnswers: record.followUpAnswers,
            signal,
          });
          await repo.saveUnderstanding(record.id, result.value, result.trace);
          publishProcessChanged(record.id);
        } catch (error) {
          await repo.recordAiOperation(
            record.id,
            "process-synthesis",
            signal.aborted ? "cancelled" : "failed",
            undefined,
            "Die Aktion konnte nicht abgeschlossen werden.",
          );
          publishProcessChanged(record.id);
          throw error;
        }
      },
    );
    return c.json(queued, 202);
  });
  app.patch("/:id/understanding/:sectionId", async (c) => {
    understandingSectionSchema.parse(c.req.param("sectionId"));
    const body = correctionSchema.parse(await c.req.json());
    try {
      return c.json(
        await repo.correctUnderstanding(
          c.req.param("id"),
          body.understanding,
          body.note,
        ),
      );
    } catch (error) {
      return repositoryError(c, error);
    }
  });
  app.patch("/:id/work-characteristics", async (c) => {
    const body = workCharacteristicCorrectionSchema.parse(await c.req.json());
    try {
      return c.json(
        await repo.correctWorkCharacteristics(
          c.req.param("id"),
          body.answers,
          body.reason,
        ),
      );
    } catch (error) {
      return repositoryError(c, error);
    }
  });
  app.post("/:id/confirm", async (c) => {
    try {
      return c.json(await repo.confirm(c.req.param("id")));
    } catch (error) {
      return repositoryError(c, error);
    }
  });
  app.delete("/:id", async (c) => {
    try {
      const id = c.req.param("id");
      const result = await repo.deleteCapture(
        id,
        hasActiveProcessOperation(id),
      );
      dismissFailedProcessOperations(id);
      return c.json(result);
    } catch (error) {
      return repositoryError(c, error);
    }
  });
  return app;
}
