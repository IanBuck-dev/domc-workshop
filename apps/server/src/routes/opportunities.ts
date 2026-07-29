import { Hono } from "hono";
import {
  normalizeOpportunityHypotheses,
  selectScenarioHypotheses,
  toOpportunityDiscoveryPublicRecord,
} from "../../../../packages/domain/src/opportunity-discovery.ts";
import type { ProcessCaptureRepository } from "../../../../packages/storage/src/process-capture-repository.ts";
import {
  OpportunityDiscoveryNotFoundError,
  type OpportunityDiscoveryRepository,
} from "../../../../packages/storage/src/opportunity-discovery-repository.ts";
import type { OpportunityAiAdapter } from "../../../../packages/claude/src/opportunity-ai-contracts.ts";
import {
  dismissFailedProcessOperations,
  enqueueProcessOperation,
  hasActiveProcessOperation,
} from "../process-operation-manager.ts";
import { publishProcessChanged } from "../process-events.ts";
import { loadOpportunityDefaults } from "../opportunity-defaults.ts";

function publicFailure() {
  return "Die KI-Potenzialanalyse konnte nicht abgeschlossen werden. Die bereits verfügbaren Ergebnisse bleiben erhalten.";
}

export function opportunityRoutes(
  processes: ProcessCaptureRepository,
  opportunities: OpportunityDiscoveryRepository,
  ai: OpportunityAiAdapter,
  defaultsRoot?: string,
) {
  const app = new Hono();

  const enqueue = (processId: string) =>
    enqueueProcessOperation(
      processId,
      "opportunity-discovery",
      async (signal) => {
        try {
          let record = await opportunities.required(processId);
          const contracts = await opportunities.contracts(processId);
          const model = {
            model: "claude-opus-4-8",
            effort: "high",
            timeoutMs: record.configSnapshot.ai.timeoutMs,
            maxOutputTokens: record.configSnapshot.ai.maxOutputTokens,
            maxInputCharacters: record.configSnapshot.ai.maxInputCharacters,
            maxBudgetUsd: record.configSnapshot.ai.maxBudgetUsd,
          } as const;

          if (record.state === "hypotheses_queued") {
            record = await opportunities.markHypothesesRunning(processId);
            publishProcessChanged(processId);
            const result = await ai.discoverHypotheses({
              processId,
              configHash: record.configHash,
              model,
              sourceProcess: record.sourceProcess,
              contracts,
              instructions: record.configSnapshot.instructions.hypotheses,
              signal,
            });
            const normalized = normalizeOpportunityHypotheses(
              result.value,
              record.sourceProcess,
            );
            record = await opportunities.saveHypotheses(
              processId,
              normalized,
              result.trace,
            );
            publishProcessChanged(processId);
          }

          if (record.state !== "scenarios_running") return;
          const selection = selectScenarioHypotheses(record.hypotheses);
          if (!selection.basis)
            throw new Error(
              "Die Evidenzbasis für die Szenarienphase ist nicht ausreichend.",
            );
          const result = await ai.createScenarios({
            processId,
            configHash: record.configHash,
            model,
            sourceProcess: record.sourceProcess,
            contracts,
            instructions: record.configSnapshot.instructions.scenarios,
            scenarioBasis: selection.basis,
            scenarioHypotheses: selection.hypotheses,
            signal,
          });
          await opportunities.saveScenarios(
            processId,
            result.value,
            result.trace,
          );
          publishProcessChanged(processId);
        } catch (error) {
          const record = await opportunities.get(processId);
          if (
            record &&
            ["hypotheses_running", "scenarios_running"].includes(record.state)
          )
            await opportunities.markPhaseFailed(
              processId,
              record.state === "hypotheses_running"
                ? "hypotheses"
                : "scenarios",
              publicFailure(),
              signal.aborted,
            );
          publishProcessChanged(processId);
          throw error;
        }
      },
      async () => {
        const record = await opportunities.get(processId);
        if (record?.state !== "hypotheses_queued") return;
        await opportunities.markHypothesesRunning(processId);
        await opportunities.markPhaseFailed(
          processId,
          "hypotheses",
          publicFailure(),
          true,
        );
        publishProcessChanged(processId);
      },
    );

  app.get("/", async (c) => {
    const processRecords = await processes.list();
    const summaries = await Promise.all(
      processRecords.map(async (process) => {
        const record = await opportunities.get(process.id);
        return record ? opportunities.summary(record, process) : null;
      }),
    );
    return c.json(summaries.filter(Boolean));
  });

  app.get("/:processId", async (c) => {
    const process = await processes.required(c.req.param("processId"));
    const record = await opportunities.get(process.id);
    return record
      ? c.json({
          record: toOpportunityDiscoveryPublicRecord(record),
          isStale: opportunities.isStale(record, process),
        })
      : c.json({ error: "KI-Potenzialanalyse nicht gefunden." }, 404);
  });

  app.get("/:processId/history", async (c) => {
    try {
      return c.json(await opportunities.history(c.req.param("processId")));
    } catch (error) {
      if (error instanceof OpportunityDiscoveryNotFoundError)
        return c.json({ error: error.message }, 404);
      throw error;
    }
  });

  app.post("/:processId", async (c) => {
    const process = await processes.required(c.req.param("processId"));
    if (process.state !== "confirmed")
      return c.json(
        { error: "Bitte bestätigen Sie zuerst das vollständige Prozessbild." },
        409,
      );
    if (process.profile.version !== 2)
      return c.json(
        {
          error:
            "Diese ältere Prozessaufnahme enthält noch nicht die erforderlichen Arbeitsmerkmale.",
        },
        409,
      );
    if (await opportunities.get(process.id))
      return c.json(
        {
          error:
            "Für diesen Prozess existiert bereits eine KI-Potenzialanalyse.",
        },
        409,
      );
    if (hasActiveProcessOperation(process.id))
      return c.json(
        { error: "Für diesen Prozess läuft bereits eine KI-Aktion." },
        409,
      );
    const defaults = await loadOpportunityDefaults(defaultsRoot);
    const record = await opportunities.create(
      process,
      defaults.config,
      defaults.contracts,
    );
    const queued = enqueue(process.id);
    return c.json(
      { record: toOpportunityDiscoveryPublicRecord(record), ...queued },
      202,
    );
  });

  app.post("/:processId/retry", async (c) => {
    const processId = c.req.param("processId");
    const process = await processes.required(processId);
    const record = await opportunities.get(processId);
    if (!record)
      return c.json({ error: "KI-Potenzialanalyse nicht gefunden." }, 404);
    if (opportunities.isStale(record, process))
      return c.json(
        {
          error:
            "Das Prozessbild wurde nach dem Start dieser Analyse geändert. Ein technischer Retry ist deshalb nicht möglich.",
        },
        409,
      );
    if (hasActiveProcessOperation(processId)) {
      // Die fachliche Fehlertransition wird im Operation-Callback persistiert,
      // unmittelbar bevor der Manager seinen Eintrag als fehlgeschlagen markiert.
      // Ein Retry darf in diesem schmalen Übergang nicht fälschlich blockieren.
      if (!record.state.endsWith("_failed"))
        return c.json(
          { error: "Für diesen Prozess läuft bereits eine KI-Aktion." },
          409,
        );
      for (
        let attempt = 0;
        attempt < 20 && hasActiveProcessOperation(processId);
        attempt += 1
      )
        await Bun.sleep(5);
      if (hasActiveProcessOperation(processId))
        return c.json(
          { error: "Für diesen Prozess läuft bereits eine KI-Aktion." },
          409,
        );
    }
    try {
      dismissFailedProcessOperations(processId);
      await opportunities.prepareTechnicalRetry(processId);
      return c.json(enqueue(processId), 202);
    } catch (error) {
      if (error instanceof OpportunityDiscoveryNotFoundError)
        return c.json({ error: error.message }, 404);
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Die Aktion kann nicht erneut gestartet werden.",
        },
        409,
      );
    }
  });

  return app;
}
