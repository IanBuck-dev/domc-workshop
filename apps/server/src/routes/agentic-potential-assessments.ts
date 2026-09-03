import { createHash } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { Hono } from "hono";
import {
  agenticPotentialAssessmentSummarySchema,
  agenticPotentialScore,
  toAgenticPotentialAssessmentPublicRecord,
} from "../../../../packages/domain/src/agentic-potential-assessment.ts";
import type { ProcessCaptureRepository } from "../../../../packages/storage/src/process-capture-repository.ts";
import type { OpportunityDiscoveryRepository } from "../../../../packages/storage/src/opportunity-discovery-repository.ts";
import type { AgenticPotentialAssessmentRepository } from "../../../../packages/storage/src/agentic-potential-assessment-repository.ts";
import { createAgenticAssessmentWorkbook } from "../../../../packages/storage/src/agentic-assessment-workbook.ts";
import type { AgenticPotentialAssessmentService } from "../agentic-potential-assessment-service.ts";
import { authenticatedUser } from "../session.ts";
import { atomicWrite } from "../../../../packages/storage/src/atomic-write.ts";

const templateHash =
  "0a08b013941025069d27dc2e0c395fc7256eb4ad3dc91b2b731167eecbb12b84";
function disposition(filename: string) {
  const ascii = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
export function agenticPotentialAssessmentRoutes(
  processes: ProcessCaptureRepository,
  opportunities: OpportunityDiscoveryRepository,
  assessments: AgenticPotentialAssessmentRepository,
  service: AgenticPotentialAssessmentService,
  defaultsRoot?: string,
) {
  const app = new Hono();
  app.get("/:processId/agentic-assessment", async (c) => {
    const processId = c.req.param("processId");
    await processes.required(processId);
    const record = await assessments.get(processId);
    // "Noch nicht erstellt" ist der reguläre Anfangszustand der Prüfseite,
    // kein fehlender HTTP-Endpunkt. Ein erfolgreicher leerer Read vermeidet
    // Browser-404s im normalen Nutzerfluss.
    if (!record) return c.json({ record: null, isStale: false });
    const opportunity = await opportunities.get(processId);
    return c.json({
      record: toAgenticPotentialAssessmentPublicRecord(record),
      isStale: !opportunity || assessments.isStale(record, opportunity),
    });
  });
  app.post("/:processId/agentic-assessment", async (c) => {
    try {
      return c.json(await service.start(c.req.param("processId")), 202);
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error ? error.message : "Start nicht möglich.",
        },
        409,
      );
    }
  });
  app.post("/:processId/agentic-assessment/retry", async (c) => {
    try {
      return c.json(await service.retry(c.req.param("processId")), 202);
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error ? error.message : "Retry nicht möglich.",
        },
        409,
      );
    }
  });
  app.post("/:processId/agentic-assessment/export", async (c) => {
    const processId = c.req.param("processId");
    const record = await assessments.get(processId);
    if (!record || record.state !== "completed" || !record.assessmentRevision)
      return c.json(
        {
          error: "Die Bewertung muss vor dem Excel-Export abgeschlossen sein.",
        },
        409,
      );
    const root =
      defaultsRoot ??
      process.env.CLAIMS_AI_DEFAULTS_DIR ??
      resolve(process.cwd(), "defaults");
    try {
      const template = new Uint8Array(
        await readFile(
          join(
            root,
            "agentic-potential-assessment",
            "KI-Potentiale.agentic.v1.xlsx",
          ),
        ),
      );
      const bytes = createAgenticAssessmentWorkbook(
        template,
        templateHash,
        record,
      );
      const exportId = crypto.randomUUID();
      const filename = `Agentische-Potenzialbewertung_${processId}_${record.assessmentRevision.slice(0, 12)}_${exportId}.xlsx`;
      const detail = {
        exportId,
        filename,
        assessmentRevision: record.assessmentRevision,
        sourceRevision: record.sourceSnapshot.sourceProcessHash,
        templateRevision: templateHash,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        byteSize: bytes.byteLength,
        initiatedBy: authenticatedUser(c) ?? "unknown",
        exportedAt: new Date().toISOString(),
      };
      await mkdir(join(assessments.dir(processId), "exports"), {
        recursive: true,
      });
      await atomicWrite(
        join(assessments.dir(processId), "exports", filename),
        bytes,
      );
      await assessments.recordExport(processId, detail);
      await processes.appendHistory(
        processId,
        "agentic-potential-assessment-exported",
        detail,
      );
      return new Response(bytes, {
        headers: {
          "Cache-Control": "private, no-store",
          "Content-Disposition": disposition(filename),
          "Content-Length": String(bytes.byteLength),
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "X-Content-Type-Options": "nosniff",
          "X-Agentic-Assessment-Revision": record.assessmentRevision,
        },
      });
    } catch (error) {
      console.error("[agentic-assessment] export failed", error);
      return c.json(
        { error: "Die Excel-Arbeitsmappe konnte nicht erstellt werden." },
        500,
      );
    }
  });
  return app;
}

export function agenticPotentialAssessmentSummaryRoutes(
  processes: ProcessCaptureRepository,
  opportunities: OpportunityDiscoveryRepository,
  assessments: AgenticPotentialAssessmentRepository,
) {
  const app = new Hono();
  app.get("/", async (c) => {
    const summaries = await Promise.all(
      (await processes.list()).map(async (process) => {
        const assessment = await assessments.get(process.id);
        if (!assessment) return null;
        const opportunity = await opportunities.get(process.id);
        const isStale =
          !opportunity || assessments.isStale(assessment, opportunity);
        return agenticPotentialAssessmentSummarySchema.parse({
          processId: process.id,
          state: assessment.state,
          isStale,
          score:
            assessment.state === "completed" && !isStale && assessment.result
              ? agenticPotentialScore(assessment.result)
              : null,
          updatedAt: assessment.updatedAt,
        });
      }),
    );
    return c.json(summaries.filter((summary) => summary !== null));
  });
  return app;
}
