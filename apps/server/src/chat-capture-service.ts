import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import {
  chatMessageRequestSchema,
  type ChatTranscriptEvent,
} from "../../../packages/domain/src/chat-capture.ts";
import {
  assertUnderstandingReferences,
  processDefinitionDraftSchema,
  processUnderstandingSchema,
  type ProcessCaptureRecord,
  type ProcessDefinitionDraft,
  type ProcessUnderstanding,
} from "../../../packages/domain/src/process-understanding.ts";
import type {
  ChatCaptureAiAdapter,
  NormalizedChatTurnHandle,
} from "../../../packages/ai-runtime/src/contracts.ts";
import {
  isMemoryEmpty,
  memorySourceTag,
  memoryTopicNames,
  parseMemoryTopicContents,
  type MemoryTopic,
} from "../../../packages/domain/src/memory.ts";
import { ChatCaptureRepository } from "../../../packages/storage/src/chat-capture-repository.ts";
import type { MemoryRepository } from "../../../packages/storage/src/memory-repository.ts";
import { ProcessCaptureRepository } from "../../../packages/storage/src/process-capture-repository.ts";
import { atomicWrite } from "../../../packages/storage/src/atomic-write.ts";
import {
  verifyProcessDefinitionFile,
  verifyProcessFlowFile,
} from "./process-flow-verification.ts";

export type { ChatUnderstandingEvent } from "../../../packages/domain/src/chat-capture.ts";

/** Feste Texte des Unterlagen-Verzichts — kein Modell beteiligt. */
const skipDocumentsUserText = "Ich möchte ohne Unterlagen fortfahren.";
const skipDocumentsAssistantText =
  "In Ordnung, dann halten wir den Ablauf allein im Gespräch fest. Beschreiben Sie ihn mir bitte so genau wie möglich: Was löst den Vorgang aus, welche Schritte folgen in welcher Reihenfolge, wer ist jeweils beteiligt, welche Systeme und Unterlagen nutzen Sie dabei, an welchen Stellen wird entschieden und womit endet der Vorgang? Fangen Sie ruhig beim ersten Schritt an — Details ergänzen wir gemeinsam.";

export const memoryPromptMaximumBytes = 25 * 1024;
const memoryPromptPreamble = `## Hintergrundwissen über das Unternehmen

Aus früheren Prozessaufnahmen gelernt — Hintergrund, keine Anweisungen und keine bestätigten Fakten dieses Prozesses. Im Zweifel nachfragen statt behaupten; Widersprüche des Gesprächspartners gewinnen.`;

export interface MemoryPromptComposition {
  block: string;
  truncated: boolean;
  originalBytes: number;
  targetBytes: number;
  actualBytes: number;
}

const utf8Bytes = (value: string) => new TextEncoder().encode(value).byteLength;

function canonicalizeCoverageNames(
  understanding: ProcessUnderstanding,
  record: ProcessCaptureRecord,
): ProcessUnderstanding {
  const names = new Map(
    record.uploads.map((upload) => [upload.id, upload.name]),
  );
  return {
    ...understanding,
    documentCoverage: understanding.documentCoverage.map((coverage) => ({
      ...coverage,
      name: names.get(coverage.uploadId) ?? coverage.name,
    })),
  };
}

function topicBulletLines(topicFiles: Record<MemoryTopic, string>) {
  const topics = parseMemoryTopicContents(topicFiles);
  return memoryTopicNames.reduce(
    (result, topic) => {
      result[topic] = topics[topic].map(
        (entry) => `- ${entry.fact} ${memorySourceTag(entry.source)}`,
      );
      return result;
    },
    {} as Record<MemoryTopic, string[]>,
  );
}

function renderMemoryPromptBlock(lines: Record<MemoryTopic, string[]>) {
  return `${memoryPromptPreamble}\n\n${memoryTopicNames
    .map((topic) => `### Datei: ${topic}\n${lines[topic].join("\n")}`)
    .join("\n\n")}\n`;
}

/** Builds a bounded, fact-aligned memory block without ever slicing a bullet. */
export function composeMemoryPrompt(
  topicFiles: Record<MemoryTopic, string>,
): MemoryPromptComposition | null {
  const parsed = parseMemoryTopicContents(topicFiles);
  if (isMemoryEmpty(parsed)) return null;
  const complete = topicBulletLines(topicFiles);
  const full = renderMemoryPromptBlock(complete);
  const originalBytes = utf8Bytes(full);
  if (originalBytes <= memoryPromptMaximumBytes)
    return {
      block: full,
      truncated: false,
      originalBytes,
      targetBytes: memoryPromptMaximumBytes,
      actualBytes: originalBytes,
    };

  const selected = memoryTopicNames.reduce(
    (result, topic) => {
      result[topic] = [];
      return result;
    },
    {} as Record<MemoryTopic, string[]>,
  );
  const nextIndex = memoryTopicNames.reduce(
    (result, topic) => {
      result[topic] = 0;
      return result;
    },
    {} as Record<MemoryTopic, number>,
  );
  const sourceWeights = memoryTopicNames.reduce(
    (result, topic) => {
      result[topic] = utf8Bytes(topicFiles[topic]);
      return result;
    },
    {} as Record<MemoryTopic, number>,
  );
  const selectedBytes = memoryTopicNames.reduce(
    (result, topic) => {
      result[topic] = 0;
      return result;
    },
    {} as Record<MemoryTopic, number>,
  );

  while (true) {
    const candidates = memoryTopicNames
      .filter((topic) => nextIndex[topic] < complete[topic].length)
      .sort(
        (left, right) =>
          selectedBytes[left] / Math.max(sourceWeights[left], 1) -
          selectedBytes[right] / Math.max(sourceWeights[right], 1),
      );
    let added = false;
    for (const topic of candidates) {
      const line = complete[topic][nextIndex[topic]]!;
      const candidate = structuredClone(selected) as Record<
        MemoryTopic,
        string[]
      >;
      candidate[topic].push(line);
      if (
        utf8Bytes(renderMemoryPromptBlock(candidate)) > memoryPromptMaximumBytes
      )
        continue;
      selected[topic].push(line);
      selectedBytes[topic] += utf8Bytes(line);
      nextIndex[topic] += 1;
      added = true;
      break;
    }
    if (!added) break;
  }
  const block = renderMemoryPromptBlock(selected);
  return {
    block,
    truncated: true,
    originalBytes,
    targetBytes: memoryPromptMaximumBytes,
    actualBytes: utf8Bytes(block),
  };
}

export type ActiveChatTurn = {
  duplicate: false;
  requestId: string;
  action: "message" | "analyze_documents";
  record: ProcessCaptureRecord;
  previousSessionId: string;
  replacementCandidateId: string | null;
  result: NormalizedChatTurnHandle["result"];
  verification: () => { ok: boolean; revision: string | null };
};

export class ChatCaptureService {
  readonly chats: ChatCaptureRepository;

  constructor(
    private readonly processes: ProcessCaptureRepository,
    private readonly ai: ChatCaptureAiAdapter,
    private readonly memory: MemoryRepository,
  ) {
    this.chats = new ChatCaptureRepository(processes.root);
  }

  async view(id: string) {
    const record = await this.processes.required(id);
    if (record.interactionMode !== "chat")
      throw new Error("Dieser Prozess wird im Formular erfasst.");
    const reconciliation = await this.chats.reconcile(record);
    const fresh = await this.processes.required(id);
    const state = await this.chats.state(id);
    return {
      cover: fresh.cover,
      processState: fresh.state,
      interactionMode: fresh.interactionMode,
      state,
      transcript: await this.chats.transcript(id),
      uploads: fresh.uploads,
      understanding: reconciliation.understanding,
      understandingStatus: reconciliation.status,
      workingFileValid: reconciliation.status === "valid",
      confirmationQuality: fresh.confirmationQuality,
      confirmationAllowed:
        reconciliation.status === "valid" && fresh.state !== "confirmed",
    };
  }

  /**
   * Verzicht auf Unterlagen. Bewusst kein KI-Zug: Die Schleuse wechselt auf
   * „skipped" und der Assistent stellt eine feste, ausführliche Rückfrage.
   * Damit steht der Composer sofort bereit, statt auf ein Modell zu warten,
   * und es entsteht keine Claude-Sitzung ohne fachlichen Inhalt.
   * Mehrfache Aufrufe mit derselben `turnId` bleiben folgenlos.
   */
  async skipDocuments(id: string, turnId: string) {
    const record = await this.processes.required(id);
    if (record.interactionMode !== "chat" || record.state === "confirmed")
      throw new Error("Der Chat ist für diesen Prozess nicht verfügbar.");
    const state = await this.chats.state(id);
    if (state.documentGate !== "pending")
      throw new Error("Der Umgang mit Unterlagen wurde bereits festgelegt.");
    const now = new Date().toISOString();
    const saved = await this.chats.append(id, {
      schemaVersion: 2,
      id: turnId,
      turnId,
      at: now,
      role: "user",
      status: "complete",
      text: skipDocumentsUserText,
      mentions: [],
      action: "skip_documents",
    });
    if (!saved) return { duplicate: true as const };
    await this.chats.updateState(id, {
      documentGate: "skipped",
      selectedUploadIds: [],
      lastTurnOutcome: "completed",
    });
    await this.chats.append(id, {
      schemaVersion: 2,
      id: crypto.randomUUID(),
      turnId,
      at: new Date().toISOString(),
      role: "assistant",
      status: "complete",
      text: skipDocumentsAssistantText,
      mentions: [],
      action: "skip_documents",
    });
    return { duplicate: false as const };
  }

  async startTurn(
    id: string,
    input: unknown,
    signal: AbortSignal,
  ): Promise<ActiveChatTurn | { duplicate: true }> {
    const request = chatMessageRequestSchema.parse(input);
    let record = await this.processes.required(id);
    if (record.interactionMode !== "chat" || record.state === "confirmed")
      throw new Error("Der Chat ist für diesen Prozess nicht verfügbar.");
    const state = await this.chats.state(id);
    if (request.action === "message" && state.documentGate === "pending")
      throw new Error("Bitte wählen Sie zuerst den Umgang mit Unterlagen.");
    if (
      request.action === "analyze_documents" &&
      (!request.selectedUploadIds.length ||
        request.selectedUploadIds.some(
          (uploadId) =>
            !record.uploads.some((upload) => upload.id === uploadId),
        ))
    )
      throw new Error("Bitte wählen Sie mindestens eine eigene Datei aus.");
    if (
      state.documentGate === "pending" &&
      request.action === "analyze_documents"
    )
      await this.chats.updateState(id, {
        documentGate: "documents_selected",
        selectedUploadIds: request.selectedUploadIds,
      });
    const saved = await this.chats.append(id, {
      schemaVersion: 2,
      id: request.id,
      turnId: request.id,
      at: new Date().toISOString(),
      role: "user",
      status: "complete",
      text: request.text,
      mentions: request.mentions,
      action: request.action,
    });
    if (!saved) return { duplicate: true };

    record = await this.processes.required(id);
    const session = await this.chats.session(id);
    const contracts = await this.freezeContracts(id, record.profile.version);
    if (
      request.action === "message" &&
      request.selectedUploadIds.some(
        (uploadId) => !record.uploads.some((upload) => upload.id === uploadId),
      )
    )
      throw new Error(
        "Mindestens eine angehängte Datei gehört nicht zu diesem Prozess.",
      );
    const uploads = record.uploads.filter((upload) =>
      request.selectedUploadIds.includes(upload.id),
    );
    const mentionText = request.mentions.length
      ? `\n\nBezüge aus dem Prozessbild:\n${request.mentions
          .map((mention) =>
            mention.kind === "node"
              ? `- ${mention.label} (Knoten-ID ${mention.nodeId}, historischer Name: ${mention.nameSnapshot ?? "nicht verfügbar"}, Stand: ${mention.understandingRevision ?? "nicht verfügbar"})`
              : `- ${mention.label} (Kanten-ID ${mention.edgeId}, historischer Name: ${mention.nameSnapshot ?? "nicht verfügbar"}, Stand: ${mention.understandingRevision ?? "nicht verfügbar"})`,
          )
          .join("\n")}`
      : "";
    const uploadText = uploads.length
      ? `\n\nAusgewählte Unterlagen (nur diese auswerten):\n${uploads
          .map(
            (upload) =>
              `- ${relative(
                this.processes.dir(id),
                this.processes.uploadPath(id, upload.id, upload.name),
              )} (Evidenz-ID: ${upload.id})`,
          )
          .join("\n")}`
      : "";
    const actionInstruction =
      request.action === "analyze_documents"
        ? "Werten Sie die ausgewählten Unterlagen aus, schreiben Sie vor Ihrer Antwort den bestgestützten vollständigen Stand und fragen Sie nur die wichtigste offene Frage."
        : "Übernehmen Sie die Nutzeraussage in den vollständigen Stand, aktualisieren Sie die Datei und fragen Sie höchstens die wichtigste verbleibende Frage.";
    const replacementCandidateId = session.replacementCandidateId;
    const activeSessionId = replacementCandidateId ?? session.activeSessionId;
    const memoryContext = await this.memoryContext(
      id,
      replacementCandidateId ? "recovery" : "initial",
      !session.activeSessionStarted || Boolean(replacementCandidateId),
    );
    const recoveryContext = replacementCandidateId
      ? await this.recoveryContext(id)
      : "";
    const result = await this.ai.startTurn({
      processId: id,
      sessionId: activeSessionId,
      resume: replacementCandidateId ? false : session.activeSessionStarted,
      cwd: this.processes.dir(id),
      systemPrompt: `${contracts.prompt}\n\n## Eingefrorenes JSON-Schema\n\n${JSON.stringify(contracts.schema)}`,
      model: record.configSnapshot.ai.model,
      prompt: `${memoryContext}${recoveryContext}${actionInstruction}${uploadText}${mentionText}\n\nNutzernachricht (Evidenzart chat_message, sourceId ${request.id}):\n${request.text}`,
      timeoutMs: record.configSnapshot.ai.timeoutMs,
      maxBudgetUsd: record.configSnapshot.ai.maxBudgetUsd,
      signal,
      writeProcessFlow: async (value) => {
        let parsedJson: unknown;
        try {
          parsedJson = JSON.parse(value);
        } catch {
          return {
            ok: false,
            errors: [
              {
                path: "",
                code: "invalid_json",
                message:
                  "Der vollständige Prozessstand ist kein gültiges JSON.",
              },
            ],
          };
        }
        const definitionMode = record.profile.version === 3;
        const parsed = definitionMode
          ? processDefinitionDraftSchema.safeParse(parsedJson)
          : processUnderstandingSchema.safeParse(parsedJson);
        if (!parsed.success)
          return {
            ok: false,
            errors: parsed.error.issues.map((issue) => ({
              path: issue.path.join("."),
              code: issue.code,
              message: issue.message,
            })),
          };
        const parsedFlow: ProcessDefinitionDraft | ProcessUnderstanding =
          definitionMode
            ? {
                ...(parsed.data as ProcessDefinitionDraft),
                understanding: canonicalizeCoverageNames(
                  (parsed.data as ProcessDefinitionDraft).understanding,
                  record,
                ),
              }
            : canonicalizeCoverageNames(
                parsed.data as ProcessUnderstanding,
                record,
              );
        const understanding =
          "understanding" in parsedFlow ? parsedFlow.understanding : parsedFlow;
        try {
          const chatMessageIds = new Set(
            (await this.chats.transcript(id))
              .filter((event) => event.role === "user")
              .map((event) => event.id),
          );
          assertUnderstandingReferences(record, understanding, {
            chatMessageIds,
          });
        } catch (error) {
          return {
            ok: false,
            errors: [
              {
                path: "understanding.evidence",
                code: "invalid_reference",
                message:
                  error instanceof Error
                    ? error.message
                    : "Ungültige Referenz im Prozessstand.",
              },
            ],
          };
        }
        const path = join(
          this.processes.dir(id),
          definitionMode
            ? "process-definition.json"
            : "process-understanding.json",
        );
        await atomicWrite(path, `${JSON.stringify(parsedFlow, null, 2)}\n`);
        return definitionMode
          ? verifyProcessDefinitionFile(path)
          : verifyProcessFlowFile(path);
      },
      verifyProcessFlow: () =>
        record.profile.version === 3
          ? verifyProcessDefinitionFile(
              join(this.processes.dir(id), "process-definition.json"),
            )
          : verifyProcessFlowFile(
              join(this.processes.dir(id), "process-understanding.json"),
            ),
    });
    return {
      duplicate: false,
      requestId: request.id,
      action: request.action,
      record,
      previousSessionId: session.activeSessionId,
      replacementCandidateId,
      result: result.result,
      verification: result.verification,
    };
  }

  async finishTurn(turn: ActiveChatTurn) {
    const [text, finalStep, finishReason] = await Promise.all([
      turn.result.text,
      turn.result.finalStep,
      turn.result.finishReason,
    ]);
    if (finishReason !== "stop")
      throw new Error(`Chat turn did not finish cleanly: ${finishReason}`);
    const verification = turn.verification();
    const current =
      turn.record.profile.version === 3
        ? await verifyProcessDefinitionFile(
            join(this.processes.dir(turn.record.id), "process-definition.json"),
          )
        : await verifyProcessFlowFile(
            join(
              this.processes.dir(turn.record.id),
              "process-understanding.json",
            ),
          );
    if (
      !verification.ok ||
      !current.ok ||
      verification.revision !== current.revision
    )
      throw new Error("Chat turn did not verify the process flow.");
    const metadata = (finalStep.providerMetadata?.["codex-cli"] ??
      finalStep.providerMetadata?.["claude-code"]) as
      Record<string, unknown> | undefined;
    const sessionId =
      typeof metadata?.sessionId === "string"
        ? metadata.sessionId
        : (await this.chats.session(turn.record.id)).activeSessionId;
    await this.chats.updateSession(turn.record.id, {
      activeSessionId: sessionId,
      activeSessionStarted: true,
      replacementCandidateId: null,
      replacedSessionIds: turn.replacementCandidateId
        ? [
            ...new Set([
              ...(await this.chats.session(turn.record.id)).replacedSessionIds,
              turn.previousSessionId,
            ]),
          ]
        : (await this.chats.session(turn.record.id)).replacedSessionIds,
      lastTurnAt: new Date().toISOString(),
    });
    const assistant: ChatTranscriptEvent = {
      schemaVersion: 2,
      id: crypto.randomUUID(),
      turnId: turn.requestId,
      at: new Date().toISOString(),
      role: "assistant",
      status: "complete",
      text: text.trim() || "Das Prozessbild wurde aktualisiert.",
      mentions: [],
      action: turn.action,
    };
    await this.chats.append(turn.record.id, assistant);
    await this.chats.updateState(turn.record.id, {
      lastTurnOutcome: "completed",
    });
    return {
      assistant,
      understanding: await this.chats.reconcile(
        await this.processes.required(turn.record.id),
        true,
      ),
    };
  }

  async failTurn(turn: ActiveChatTurn, aborted: boolean) {
    await this.chats.updateState(turn.record.id, {
      lastTurnOutcome: aborted ? "aborted" : "failed",
    });
    await this.chats.append(turn.record.id, {
      schemaVersion: 2,
      id: crypto.randomUUID(),
      turnId: turn.requestId,
      at: new Date().toISOString(),
      role: "assistant",
      status: "aborted",
      text: aborted
        ? "Die Antwort wurde gestoppt. Sie können mit einer neuen Nachricht fortfahren."
        : "Die Antwort konnte nicht abgeschlossen werden. Sie können es erneut versuchen.",
      mentions: [],
      action: turn.action,
    });
    if (!aborted && !turn.replacementCandidateId)
      await this.chats.updateSession(turn.record.id, {
        replacementCandidateId: crypto.randomUUID(),
      });
  }

  async deleteSessions(id: string) {
    const record = await this.processes.required(id);
    if (record.interactionMode !== "chat") return;
    for (const sessionId of await this.chats.deletionSessionIds(id)) {
      try {
        await this.ai.deleteSession(sessionId, this.processes.dir(id));
      } catch (error) {
        if (!/not found|enoent|missing/i.test(String(error))) throw error;
      }
    }
  }

  private async freezeContracts(id: string, profileVersion: number) {
    const chatDir = join(this.processes.dir(id), "chat");
    const contractsDir = join(chatDir, "contracts");
    const promptPath = join(contractsDir, "process-chat.md");
    const definitionMode = profileVersion === 3;
    const schemaPath = join(
      contractsDir,
      `${definitionMode ? "process-definition" : "process-understanding"}.schema.json`,
    );
    const manifestPath = join(chatDir, "contract-manifest.json");
    await mkdir(contractsDir, { recursive: true });
    const existingManifest = await readFile(manifestPath, "utf8").catch(
      () => "",
    );
    if (!existingManifest.trim() || existingManifest.trim() === "{}") {
      await Promise.all([
        copyFile(
          join(
            process.cwd(),
            "defaults/prompts",
            definitionMode ? "process-chat-v3.md" : "process-chat.md",
          ),
          promptPath,
        ),
        copyFile(
          join(
            process.cwd(),
            "defaults/ai-schemas",
            definitionMode
              ? "process-definition.json"
              : "process-understanding.json",
          ),
          schemaPath,
        ),
      ]);
      const [prompt, schemaText] = await Promise.all([
        readFile(promptPath, "utf8"),
        readFile(schemaPath, "utf8"),
      ]);
      await Bun.write(
        manifestPath,
        JSON.stringify(
          {
            prompt: createHash("sha256").update(prompt).digest("hex"),
            schema: createHash("sha256").update(schemaText).digest("hex"),
          },
          null,
          2,
        ) + "\n",
      );
    }
    const [prompt, schemaText] = await Promise.all([
      readFile(promptPath, "utf8"),
      readFile(schemaPath, "utf8"),
    ]);
    const schema: unknown = JSON.parse(schemaText);
    if (
      !prompt.trim() ||
      prompt.length > 50_000 ||
      !schema ||
      typeof schema !== "object" ||
      Array.isArray(schema)
    )
      throw new Error("Invalid frozen Chat Capture contracts.");
    return { prompt, schema };
  }

  private async recoveryContext(id: string) {
    const transcript = await this.chats.transcript(id);
    const record = await this.processes.required(id);
    const lastValid =
      record.profile.version === 3
        ? await this.chats.lastValidDefinition(id).catch(() => null)
        : await this.chats.lastValid(id).catch(() => null);
    return `Wiederherstellung einer unterbrochenen Sitzung. Nutzen Sie ausschließlich den folgenden anwendungseigenen Stand, bevor Sie die neue Nachricht verarbeiten.\n\nBisheriger Chat:\n${transcript
      .map((event) => `${event.role}: ${event.text}`)
      .join(
        "\n",
      )}\n\nLetzter gültiger Prozessstand:\n${JSON.stringify(lastValid)}\n\n`;
  }

  private async memoryContext(
    processId: string,
    context: "initial" | "recovery",
    include: boolean,
  ) {
    if (!include) return "";
    try {
      const composed = composeMemoryPrompt(await this.memory.topicContents());
      if (!composed) return "";
      if (composed.truncated)
        await this.processes.appendHistory(
          processId,
          "memory-prompt-truncated",
          {
            context,
            originalBytes: composed.originalBytes,
            targetBytes: composed.targetBytes,
            actualBytes: composed.actualBytes,
          },
        );
      return `${composed.block}\n`;
    } catch (error) {
      try {
        await this.processes.appendHistory(processId, "memory-prompt-skipped", {
          context,
          message:
            error instanceof Error
              ? error.message
              : "Gedächtnis konnte nicht gelesen werden",
        });
      } catch (auditError) {
        console.error("[memory-prompt-skipped] Audit failed:", auditError);
      }
      return "";
    }
  }
}
