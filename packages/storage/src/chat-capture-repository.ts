import { createHash } from "node:crypto";
import { appendFile, mkdir, readFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  chatCaptureStateSchema,
  chatSessionRecordSchema,
  chatTranscriptEventSchema,
  type ChatCaptureState,
  type ChatSessionRecord,
  type ChatTranscriptEvent,
} from "../../domain/src/chat-capture.ts";
import {
  processUnderstandingSchema,
  type ProcessCaptureRecord,
  type ProcessUnderstanding,
  assertUnderstandingReferences,
} from "../../domain/src/process-understanding.ts";
import { atomicWrite } from "./atomic-write.ts";
import { audit } from "./audit-log.ts";

const MAX_WORKING_BYTES = 2 * 1024 * 1024;
const initialAssistantText =
  "Ich unterstütze Sie dabei, den heutigen Ablauf als verständliches Prozessbild festzuhalten. Am schnellsten geht das mit vorhandenen Arbeitsanweisungen, Präsentationen oder Beispieldokumenten. Laden Sie alle passenden Unterlagen gemeinsam hoch – oder fahren Sie ohne Unterlagen fort.";

export class ChatCaptureRepository {
  constructor(private readonly root: string) {}
  private dir(id: string) {
    return join(this.root, "process-captures", id, "chat");
  }
  private processDir(id: string) {
    return join(this.root, "process-captures", id);
  }
  private path(id: string, name: string) {
    return join(this.dir(id), name);
  }

  async initialize(id: string) {
    const now = new Date().toISOString();
    await mkdir(join(this.dir(id), "contracts"), { recursive: true });
    await mkdir(join(this.dir(id), "tmp"), { recursive: true });
    const defaultsRoot =
      process.env.CLAIMS_AI_DEFAULTS_DIR ?? resolve(process.cwd(), "defaults");
    const [prompt, schemaText] = await Promise.all([
      readFile(join(defaultsRoot, "prompts", "process-chat.md"), "utf8"),
      readFile(
        join(defaultsRoot, "ai-schemas", "process-understanding.json"),
        "utf8",
      ),
    ]);
    const schema: unknown = JSON.parse(schemaText);
    if (
      !prompt.trim() ||
      prompt.length > 50_000 ||
      !schema ||
      typeof schema !== "object" ||
      Array.isArray(schema)
    )
      throw new Error("Invalid Chat Capture contracts.");
    const state: ChatCaptureState = {
      schemaVersion: 1,
      documentGate: "pending",
      selectedUploadIds: [],
      lastValidRevision: null,
      lastValidAt: null,
      lastTurnOutcome: null,
      createdAt: now,
      updatedAt: now,
    };
    const session: ChatSessionRecord = {
      schemaVersion: 1,
      activeSessionId: crypto.randomUUID(),
      activeSessionStarted: false,
      replacementCandidateId: null,
      replacedSessionIds: [],
      lastTurnAt: null,
    };
    await Promise.all([
      this.writeState(id, state),
      this.writeSession(id, session),
      atomicWrite(this.path(id, "transcript.jsonl"), ""),
      atomicWrite(
        this.path(id, "last-valid-process-understanding.json"),
        "null\n",
      ),
      atomicWrite(
        join(this.processDir(id), "process-understanding.json"),
        "null\n",
      ),
      atomicWrite(this.path(id, "contracts/process-chat.md"), prompt),
      atomicWrite(
        this.path(id, "contracts/process-understanding.schema.json"),
        schemaText,
      ),
      atomicWrite(
        this.path(id, "contract-manifest.json"),
        JSON.stringify(
          {
            prompt: createHash("sha256").update(prompt).digest("hex"),
            schema: createHash("sha256").update(schemaText).digest("hex"),
          },
          null,
          2,
        ) + "\n",
      ),
    ]);
    await this.append(id, {
      schemaVersion: 1,
      id: crypto.randomUUID(),
      turnId: null,
      at: now,
      role: "assistant",
      status: "complete",
      text: initialAssistantText,
      mentions: [],
      action: "initial",
    });
  }

  async state(id: string) {
    return chatCaptureStateSchema.parse(
      JSON.parse(await readFile(this.path(id, "state.json"), "utf8")),
    );
  }
  async session(id: string) {
    return chatSessionRecordSchema.parse(
      JSON.parse(await readFile(this.path(id, "session.json"), "utf8")),
    );
  }
  async transcript(id: string) {
    const text = await readFile(this.path(id, "transcript.jsonl"), "utf8");
    return text
      .split("\n")
      .filter(Boolean)
      .map((line) => chatTranscriptEventSchema.parse(JSON.parse(line)));
  }
  async append(id: string, event: ChatTranscriptEvent) {
    const parsed = chatTranscriptEventSchema.parse(event);
    const events = await this.transcript(id).catch(() => []);
    if (parsed.role === "user" && events.some((item) => item.id === parsed.id))
      return false;
    await appendFile(
      this.path(id, "transcript.jsonl"),
      `${JSON.stringify(parsed)}\n`,
      "utf8",
    );
    return true;
  }
  async updateState(
    id: string,
    next: Partial<Omit<ChatCaptureState, "schemaVersion" | "createdAt">>,
  ) {
    const current = await this.state(id);
    const value = chatCaptureStateSchema.parse({
      ...current,
      ...next,
      updatedAt: new Date().toISOString(),
    });
    await this.writeState(id, value);
    return value;
  }
  async updateSession(
    id: string,
    next: Partial<Omit<ChatSessionRecord, "schemaVersion">>,
  ) {
    const current = await this.session(id);
    const value = chatSessionRecordSchema.parse({ ...current, ...next });
    await this.writeSession(id, value);
    return value;
  }
  async lastValid(id: string): Promise<ProcessUnderstanding | null> {
    return zNullableUnderstanding(
      await readFile(
        this.path(id, "last-valid-process-understanding.json"),
        "utf8",
      ),
    );
  }
  async reconcile(record: ProcessCaptureRecord) {
    const file = join(this.processDir(record.id), "process-understanding.json");
    let raw: string;
    try {
      raw = await readFile(file, "utf8");
    } catch {
      return {
        status: "missing" as const,
        understanding: await this.lastValid(record.id).catch(() => null),
      };
    }
    if (Buffer.byteLength(raw) > MAX_WORKING_BYTES)
      return {
        status: "invalid" as const,
        understanding: await this.lastValid(record.id).catch(() => null),
      };
    if (!raw.trim() || raw.trim() === "null")
      return {
        status: "missing" as const,
        understanding: await this.lastValid(record.id).catch(() => null),
      };
    let understanding: ProcessUnderstanding;
    try {
      understanding = processUnderstandingSchema.parse(JSON.parse(raw));
      const messages = new Set(
        (await this.transcript(record.id))
          .filter((item) => item.role === "user")
          .map((item) => item.id),
      );
      assertUnderstandingReferences(record, understanding, {
        chatMessageIds: messages,
      });
    } catch {
      return {
        status: "invalid" as const,
        understanding: await this.lastValid(record.id).catch(() => null),
      };
    }
    const revision = createHash("sha256")
      .update(JSON.stringify(understanding))
      .digest("hex");
    const state = await this.state(record.id);
    if (state.lastValidRevision !== revision) {
      const prior = await this.lastValid(record.id).catch(() => null);
      const priorIds = new Set(prior?.steps.map((step) => step.id) ?? []);
      const currentIds = new Set(understanding.steps.map((step) => step.id));
      const retained = [...currentIds].filter((stepId) => priorIds.has(stepId));
      const added = [...currentIds].filter((stepId) => !priorIds.has(stepId));
      const removed = [...priorIds].filter((stepId) => !currentIds.has(stepId));
      await atomicWrite(
        this.path(record.id, "last-valid-process-understanding.json"),
        JSON.stringify(understanding, null, 2) + "\n",
      );
      await this.updateState(record.id, {
        lastValidRevision: revision,
        lastValidAt: new Date().toISOString(),
      });
      await audit(
        join(this.processDir(record.id), "history.jsonl"),
        "chat-understanding-published",
        {
          revision,
          evidence: understanding.evidence.map((item) => item.id),
          gapCount: understanding.knowledgeGaps.length,
          conflictCount: understanding.conflicts.length,
        },
      );
      if (prior && (added.length || removed.length))
        await audit(
          join(this.processDir(record.id), "history.jsonl"),
          "chat-understanding-step-identities-changed",
          {
            priorRevision: state.lastValidRevision,
            currentRevision: revision,
            retainedStepIds: retained.slice(0, 8),
            addedStepIds: added.slice(0, 8),
            removedStepIds: removed.slice(0, 8),
          },
        );
    }
    return { status: "valid" as const, revision, understanding };
  }
  async finalize(record: ProcessCaptureRecord, override: boolean) {
    const reconciled = await this.reconcile(record);
    if (reconciled.status !== "valid")
      throw new Error("Das Prozessbild ist noch nicht vollständig gültig.");
    const hasOpen =
      reconciled.understanding.knowledgeGaps.length ||
      reconciled.understanding.conflicts.length;
    if (hasOpen && !override)
      return {
        overrideRequired: true as const,
        understanding: reconciled.understanding,
      };
    await atomicWrite(
      join(this.processDir(record.id), "process-understanding.json"),
      JSON.stringify(reconciled.understanding, null, 2) + "\n",
    );
    return {
      overrideRequired: false as const,
      understanding: reconciled.understanding,
      quality: hasOpen ? ("with_gaps" as const) : ("complete" as const),
    };
  }
  async deletionSessionIds(id: string) {
    const value = await this.session(id);
    return [
      ...new Set(
        [
          value.activeSessionId,
          value.replacementCandidateId,
          ...value.replacedSessionIds,
        ].filter((item): item is string => Boolean(item)),
      ),
    ];
  }
  async remove(id: string) {
    await rm(this.dir(id), { recursive: true, force: true });
  }
  private async writeState(id: string, value: ChatCaptureState) {
    await atomicWrite(
      this.path(id, "state.json"),
      JSON.stringify(value, null, 2) + "\n",
    );
  }
  private async writeSession(id: string, value: ChatSessionRecord) {
    await atomicWrite(
      this.path(id, "session.json"),
      JSON.stringify(value, null, 2) + "\n",
    );
  }
}
function zNullableUnderstanding(text: string): ProcessUnderstanding | null {
  const value = JSON.parse(text);
  return value === null ? null : processUnderstandingSchema.parse(value);
}
