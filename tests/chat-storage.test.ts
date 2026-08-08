import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ChatCaptureRepository } from "../packages/storage/src/chat-capture-repository.ts";
import { ProcessCaptureRepository } from "../packages/storage/src/process-capture-repository.ts";
import { cover, processConfig, understanding } from "./process-fixtures.ts";
import { createOpportunityProcessSnapshot } from "../packages/domain/src/opportunity-discovery.ts";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "chat-storage-"));
  roots.push(root);
  const processes = new ProcessCaptureRepository(root);
  const record = await processes.create(cover, await processConfig(), "chat");
  return { root, processes, record, chats: new ChatCaptureRepository(root) };
}

describe("chat capture storage", () => {
  test("creates isolated chat artifacts and an append-only transcript", async () => {
    const { processes, record, chats } = await fixture();
    expect(
      (await readdir(join(processes.dir(record.id), "chat"))).sort(),
    ).toEqual([
      "contract-manifest.json",
      "contracts",
      "last-valid-process-understanding.json",
      "session.json",
      "state.json",
      "tmp",
      "transcript.jsonl",
    ]);
    expect((await chats.transcript(record.id))[0]?.action).toBe("initial");
    const contracts = join(processes.dir(record.id), "chat", "contracts");
    const frozenPrompt = await readFile(
      join(contracts, "process-chat.md"),
      "utf8",
    );
    expect(frozenPrompt.length).toBeGreaterThan(100);
    expect(frozenPrompt).toContain("Beim Aufteilen");
    expect(
      JSON.parse(
        await readFile(
          join(processes.dir(record.id), "chat", "contract-manifest.json"),
          "utf8",
        ),
      ).prompt,
    ).toMatch(/^[a-f0-9]{64}$/);
    const messageId = crypto.randomUUID();
    const event = {
      schemaVersion: 2 as const,
      id: messageId,
      turnId: messageId,
      at: new Date().toISOString(),
      role: "user" as const,
      status: "complete" as const,
      text: "Der Prozess startet mit dem Eingang.",
      mentions: [],
      action: "message" as const,
    };
    expect(await chats.append(record.id, event)).toBe(true);
    expect(await chats.append(record.id, event)).toBe(false);
    expect(
      (await chats.transcript(record.id)).filter(
        (item) => item.id === messageId,
      ),
    ).toHaveLength(1);
  });

  test("retains the last valid diagram across malformed working writes", async () => {
    const { root, processes, record, chats } = await fixture();
    const messageId = crypto.randomUUID();
    await chats.append(record.id, {
      schemaVersion: 2,
      id: messageId,
      turnId: messageId,
      at: new Date().toISOString(),
      role: "user",
      status: "complete",
      text: "Fachliche Beschreibung",
      mentions: [],
      action: "message",
    });
    const value = understanding();
    for (const evidence of value.evidence) {
      evidence.kind = "chat_message";
      evidence.sourceId = messageId;
    }
    await writeFile(
      join(processes.dir(record.id), "process-understanding.json"),
      JSON.stringify(value),
    );
    const valid = await chats.reconcile(
      await processes.required(record.id),
      true,
    );
    expect(valid.status).toBe("valid");
    if (valid.status !== "valid") throw new Error("Expected valid revision");
    const initialRevision = valid.revision;
    const published = await readFile(
      join(
        processes.dir(record.id),
        "chat",
        "last-valid-process-understanding.json",
      ),
      "utf8",
    );
    await chats.reconcile(await processes.required(record.id), true);
    expect(
      (await readFile(join(processes.dir(record.id), "history.jsonl"), "utf8"))
        .split("\n")
        .filter((line) => line.includes("chat-understanding-published")),
    ).toHaveLength(1);
    expect(
      (await processes.required(record.id)).understanding?.steps,
    ).toHaveLength(5);
    const working = join(
      processes.dir(record.id),
      "process-understanding.json",
    );
    for (const invalidWorkingFile of [
      "{ partial",
      JSON.stringify({ ...value, steps: [] }),
      JSON.stringify({
        ...value,
        purpose: { ...value.purpose, evidenceIds: ["foreign-evidence"] },
      }),
      " ".repeat(2 * 1024 * 1024 + 1),
    ]) {
      await writeFile(working, invalidWorkingFile);
      const invalid = await chats.reconcile(
        await processes.required(record.id),
      );
      expect(invalid.status).toBe("invalid");
      expect(invalid.understanding?.steps).toHaveLength(5);
      expect(
        await readFile(
          join(
            processes.dir(record.id),
            "chat",
            "last-valid-process-understanding.json",
          ),
          "utf8",
        ),
      ).toBe(published);
      expect(
        (await new ProcessCaptureRepository(processes.root).required(record.id))
          .understanding?.steps,
      ).toHaveLength(5);
    }
    const nextValue = structuredClone(value);
    nextValue.steps[0]!.name = "Neu belegter erster Schritt";
    await writeFile(working, JSON.stringify(nextValue));
    const reloadedProcesses = new ProcessCaptureRepository(root);
    const reloadedChats = new ChatCaptureRepository(root);
    const recovered = await reloadedChats.reconcile(
      await reloadedProcesses.required(record.id),
      true,
    );
    expect(recovered.status).toBe("valid");
    if (recovered.status === "valid") {
      expect(recovered.revision).not.toBe(initialRevision);
      expect(recovered.understanding.steps[0]?.name).toBe(
        "Neu belegter erster Schritt",
      );
    }
    expect(
      (await readFile(join(processes.dir(record.id), "history.jsonl"), "utf8"))
        .split("\n")
        .filter((line) => line.includes("chat-understanding-published")),
    ).toHaveLength(2);
    expect(
      JSON.parse(
        await readFile(
          join(
            processes.dir(record.id),
            "chat",
            "last-valid-process-understanding.json",
          ),
          "utf8",
        ),
      ).steps[0].name,
    ).toBe("Neu belegter erster Schritt");
    expect(
      JSON.parse(
        await readFile(
          join(
            processes.dir(record.id),
            "chat",
            "last-valid-process-understanding.json",
          ),
          "utf8",
        ),
      ).steps,
    ).toHaveLength(5);
    const identityChanged = structuredClone(nextValue);
    identityChanged.steps[0]!.id = "new-first-step";
    const firstNode = identityChanged.flow.nodes.find(
      (node): node is Extract<typeof node, { kind: "step" }> =>
        node.kind === "step" && node.stepId === "step-1",
    );
    if (!firstNode) throw new Error("Der erste Schrittknoten fehlt.");
    firstNode.stepId = "new-first-step";
    await writeFile(working, JSON.stringify(identityChanged));
    const identityRevision = await chats.reconcile(
      await processes.required(record.id),
      true,
    );
    expect(identityRevision.status).toBe("valid");
    const identityAudit = (
      await readFile(join(processes.dir(record.id), "history.jsonl"), "utf8")
    )
      .split("\n")
      .filter((line) =>
        line.includes("chat-understanding-step-identities-changed"),
      );
    expect(identityAudit).toHaveLength(1);
    expect(JSON.parse(identityAudit[0]!).detail).toMatchObject({
      retainedStepIds: expect.any(Array),
      addedStepIds: ["new-first-step"],
      removedStepIds: [value.steps[0]!.id],
    });
  });

  test("requires override for gaps and finalizes the canonical file", async () => {
    const { processes, record, chats } = await fixture();
    const messageId = crypto.randomUUID();
    await chats.append(record.id, {
      schemaVersion: 2,
      id: messageId,
      turnId: messageId,
      at: new Date().toISOString(),
      role: "user",
      status: "complete",
      text: "Fachliche Beschreibung",
      mentions: [],
      action: "message",
    });
    const value = understanding();
    for (const evidence of value.evidence) {
      evidence.kind = "chat_message";
      evidence.sourceId = messageId;
    }
    await writeFile(
      join(processes.dir(record.id), "process-understanding.json"),
      JSON.stringify(value),
    );
    const blocked = await chats.finalize(
      await processes.required(record.id),
      false,
    );
    expect(blocked.overrideRequired).toBe(true);
    const finalized = await chats.finalize(
      await processes.required(record.id),
      true,
    );
    expect(finalized.overrideRequired).toBe(false);
    if (!finalized.overrideRequired) {
      expect(finalized.quality).toBe("with_gaps");
      const confirmed = await processes.finalizeChatCapture(
        record.id,
        finalized.understanding,
        finalized.quality,
      );
      const snapshot = createOpportunityProcessSnapshot(confirmed);
      expect(snapshot.confirmationQuality).toBe("with_gaps");
      expect(snapshot.workCharacteristics).toEqual([]);
    }
  });

  test("rejects an invalid working state and finalizes a complete snapshot without override", async () => {
    const { processes, record, chats } = await fixture();
    await expect(
      chats.finalize(await processes.required(record.id), false),
    ).rejects.toThrow("noch nicht vollständig gültig");

    const messageId = crypto.randomUUID();
    await chats.append(record.id, {
      schemaVersion: 2,
      id: messageId,
      turnId: messageId,
      at: new Date().toISOString(),
      role: "user",
      status: "complete",
      text: "Vollständige fachliche Beschreibung",
      mentions: [],
      action: "message",
    });
    const value = understanding();
    value.knowledgeGaps = [];
    value.conflicts = [];
    for (const evidence of value.evidence) {
      evidence.kind = "chat_message";
      evidence.sourceId = messageId;
    }
    await writeFile(
      join(processes.dir(record.id), "process-understanding.json"),
      JSON.stringify(value),
    );

    const finalized = await chats.finalize(
      await processes.required(record.id),
      false,
    );
    expect(finalized.overrideRequired).toBe(false);
    if (!finalized.overrideRequired) expect(finalized.quality).toBe("complete");
  });
});
