/**
 * Legt Demo-Prozesse aus `demo-data/szenarien/` direkt über die
 * Repository-Schicht an — ohne laufenden Server, ohne Anmeldedaten.
 *
 * Warum die Repository-Schicht und kein HTTP: `requireSession`
 * (`apps/server/src/index.ts`) sitzt vor jeder `/api/*`-Route. Die
 * Zugangsdaten liegen im 1Password des Auftraggebers und werden von keinem
 * Skript angefasst. `ProcessCaptureRepository.saveUpload()` führt trotzdem
 * dieselbe Magic-Byte- und OOXML-Prüfung aus wie ein echter Upload — ein
 * Demo-Dokument, das der Server ablehnen würde, scheitert also auch hier.
 *
 * Aufruf:
 *   bun run seed --list
 *   bun run seed <slug>
 *   bun run seed --alle
 *   bun run seed kfz-glasschaden --stufe bestaetigt
 */
import { existsSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  demoDataRoot,
  listDemoScenarios,
  readDemoDocument,
  type DemoScenarioWithScript,
} from "../apps/server/src/demo-scenarios.ts";
import { workspacePath } from "../apps/server/src/launcher.ts";
import { ProcessCaptureRepository } from "../packages/storage/src/process-capture-repository.ts";
import { ChatCaptureRepository } from "../packages/storage/src/chat-capture-repository.ts";
import {
  processCaptureConfigSchema,
  processUnderstandingSchema,
  type ProcessCaptureConfig,
  type UploadRecord,
} from "../packages/domain/src/process-understanding.ts";
import { createOpportunityProcessSnapshot } from "../packages/domain/src/opportunity-discovery.ts";

class SeedError extends Error {}

function parseArgs(argv: string[]) {
  const list = argv.includes("--list");
  const alle = argv.includes("--alle");
  const stufeIndex = argv.indexOf("--stufe");
  const stufe = stufeIndex === -1 ? undefined : argv[stufeIndex + 1];
  const slug = argv.find(
    (value, index) => !value.startsWith("--") && argv[index - 1] !== "--stufe",
  );
  return { list, alle, stufe, slug };
}

async function loadConfig(): Promise<ProcessCaptureConfig> {
  const root =
    process.env.CLAIMS_AI_DEFAULTS_DIR ?? resolve(process.cwd(), "defaults");
  return processCaptureConfigSchema.parse(
    await Bun.file(join(root, "process-capture-config.json")).json(),
  );
}

async function ensureWorkspace(root: string) {
  try {
    await mkdir(root, { recursive: true });
  } catch (error) {
    throw new SeedError(
      `Der Workspace-Ordner „${root}" ist nicht beschreibbar: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

function printTable(szenarien: DemoScenarioWithScript[]) {
  const rows = szenarien.map((szenario) => ({
    slug: szenario.slug,
    titel: szenario.titel,
    fachbereich: szenario.cover.department,
    modus: szenario.interactionMode === "chat" ? "Chat" : "Formular",
    dokumente: String(szenario.dokumente.length),
    zuege: String(szenario.zuege.length),
  }));
  const header = {
    slug: "Slug",
    titel: "Titel",
    fachbereich: "Fachbereich",
    modus: "Modus",
    dokumente: "Dokumente",
    zuege: "Vorschläge",
  };
  const columns = Object.keys(header) as (keyof typeof header)[];
  const widths = Object.fromEntries(
    columns.map((column) => [
      column,
      Math.max(header[column].length, ...rows.map((row) => row[column].length)),
    ]),
  ) as Record<keyof typeof header, number>;
  const formatRow = (row: Record<keyof typeof header, string>) =>
    columns.map((column) => row[column].padEnd(widths[column])).join("  ");
  console.log(formatRow(header));
  console.log(columns.map((column) => "-".repeat(widths[column])).join("  "));
  rows.forEach((row) => console.log(formatRow(row)));
}

/**
 * Versetzt einen frisch angelegten Chat-Prozess direkt in den Zustand
 * `confirmed`, mit dem handgeschriebenen Verständnis aus
 * `verstaendnis.json`. Die Datei referenziert Uploads und Chat-Nachrichten
 * über feste Platzhalter-IDs (siehe verstaendnis.json je Szenario);
 * hier werden sie auf die tatsächlich beim Seeden erzeugten IDs abgebildet,
 * denn `assertUnderstandingReferences`
 * (`packages/domain/src/process-understanding.ts:1229`) lässt nur Evidenz
 * zu, die auf real vorhandene Uploads und Chat-Nachrichten verweist.
 */
async function confirmWithUnderstanding(
  repo: ProcessCaptureRepository,
  chatRepo: ChatCaptureRepository,
  szenario: DemoScenarioWithScript,
  processId: string,
  uploadsByName: Map<string, UploadRecord>,
) {
  const pfad = join(
    demoDataRoot(),
    "szenarien",
    szenario.slug,
    "verstaendnis.json",
  );
  if (!existsSync(pfad))
    throw new SeedError(
      `Für „${szenario.slug}" gibt es keine verstaendnis.json — „--stufe bestaetigt" ist für dieses Szenario nicht möglich.`,
    );
  if (szenario.interactionMode !== "chat")
    throw new SeedError(
      `„--stufe bestaetigt" unterstützt bisher nur Chat-Szenarien; „${szenario.slug}" läuft im Formular-Modus.`,
    );
  const rohdaten = processUnderstandingSchema.parse(
    JSON.parse(await readFile(pfad, "utf8")),
  );

  const uploadIdMap = new Map<string, string>();
  const documentCoverage = rohdaten.documentCoverage.map((eintrag) => {
    const upload = uploadsByName.get(eintrag.name);
    if (!upload)
      throw new SeedError(
        `verstaendnis.json von „${szenario.slug}" verweist auf das Dokument „${eintrag.name}", das nicht zu den Dokumenten aus szenario.json passt.`,
      );
    uploadIdMap.set(eintrag.uploadId, upload.id);
    return { ...eintrag, uploadId: upload.id };
  });

  const chatMessageIdMap = new Map<string, string>();
  for (const eintrag of rohdaten.evidence) {
    if (eintrag.kind !== "chat_message") continue;
    if (chatMessageIdMap.has(eintrag.sourceId)) continue;
    const messageId = crypto.randomUUID();
    chatMessageIdMap.set(eintrag.sourceId, messageId);
    await chatRepo.append(processId, {
      schemaVersion: 1,
      id: messageId,
      turnId: null,
      at: new Date().toISOString(),
      role: "user",
      status: "complete",
      text: eintrag.excerpt,
      mentions: [],
      action: "message",
    });
  }

  const evidence = rohdaten.evidence.map((eintrag) => {
    if (eintrag.kind === "upload") {
      const real = uploadIdMap.get(eintrag.sourceId);
      if (!real)
        throw new SeedError(
          `verstaendnis.json von „${szenario.slug}" verweist auf einen unbekannten Upload (${eintrag.sourceId}).`,
        );
      return { ...eintrag, sourceId: real };
    }
    if (eintrag.kind === "chat_message")
      return { ...eintrag, sourceId: chatMessageIdMap.get(eintrag.sourceId)! };
    return eintrag;
  });

  const understanding = processUnderstandingSchema.parse({
    ...rohdaten,
    evidence,
    documentCoverage,
  });

  await chatRepo.updateState(processId, {
    selectedUploadIds: documentCoverage.map((eintrag) => eintrag.uploadId),
  });
  await repo.finalizeChatCapture(processId, understanding, "complete");

  const bestaetigt = await repo.required(processId);
  if (bestaetigt.state !== "confirmed")
    throw new SeedError(
      `Der Prozess „${processId}" konnte nicht in den Zustand „bestätigt" versetzt werden.`,
    );
  createOpportunityProcessSnapshot(bestaetigt);
  return bestaetigt;
}

async function seedScenario(
  repo: ProcessCaptureRepository,
  chatRepo: ChatCaptureRepository,
  szenario: DemoScenarioWithScript,
  stufe: string | undefined,
) {
  const record = await repo.create(
    szenario.cover,
    await loadConfig(),
    szenario.interactionMode,
  );
  const uploadsByName = new Map<string, UploadRecord>();
  for (const dokument of szenario.dokumente) {
    const { bytes, contentType, dateiname } = await readDemoDocument(
      szenario.slug,
      dokument.zielname,
    );
    const file = new File([bytes], dateiname, { type: contentType });
    try {
      const upload = await repo.saveUpload(record.id, file);
      uploadsByName.set(dateiname, upload);
    } catch (error) {
      throw new SeedError(
        `Datei „${dateiname}" für Szenario „${szenario.slug}" hat die Uploadprüfung nicht bestanden: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  if (stufe === "bestaetigt")
    await confirmWithUnderstanding(
      repo,
      chatRepo,
      szenario,
      record.id,
      uploadsByName,
    );

  const drehbuchPfad = join(
    demoDataRoot(),
    "szenarien",
    szenario.slug,
    "DREHBUCH.md",
  );
  const pfadSegment = szenario.interactionMode === "chat" ? "chat" : "capture";
  console.log(`Angelegt: ${szenario.titel} (${record.id})`);
  console.log(
    `  URL: http://127.0.0.1:5173/processes/${record.id}/${pfadSegment}`,
  );
  console.log(`  Drehbuch: ${drehbuchPfad}`);
  if (stufe === "bestaetigt")
    console.log(
      `  Status: bestätigt — Verständnis aus verstaendnis.json übernommen, Potenzialanalyse startbar.`,
    );
}

async function main() {
  const { list, alle, stufe, slug } = parseArgs(process.argv.slice(2));
  if (stufe !== undefined && stufe !== "bestaetigt")
    throw new SeedError(
      `Unbekannte Stufe „${stufe}". Unterstützt wird bisher nur „bestaetigt".`,
    );
  if (alle && stufe)
    throw new SeedError(
      `„--stufe" ist nur zusammen mit einem einzelnen Szenario nutzbar, nicht mit „--alle".`,
    );

  const szenarien = await listDemoScenarios();
  if (list) {
    if (!szenarien.length) {
      console.log("Keine Demo-Szenarien unter demo-data/szenarien gefunden.");
      return;
    }
    printTable(szenarien);
    return;
  }

  if (!alle && !slug)
    throw new SeedError(
      "Bitte einen Szenario-Slug angeben, „--alle“ oder „--list“ verwenden.",
    );

  const root = workspacePath();
  await ensureWorkspace(root);
  const repo = new ProcessCaptureRepository(root);
  const chatRepo = new ChatCaptureRepository(root);

  if (alle) {
    if (!szenarien.length)
      throw new SeedError(
        "Keine Demo-Szenarien unter demo-data/szenarien gefunden.",
      );
    for (const szenario of szenarien)
      await seedScenario(repo, chatRepo, szenario, undefined);
    return;
  }

  const szenario = szenarien.find((eintrag) => eintrag.slug === slug);
  if (!szenario)
    throw new SeedError(
      `Unbekanntes Szenario „${slug}". Verfügbar: ${
        szenarien.map((eintrag) => eintrag.slug).join(", ") || "keine"
      }.`,
    );
  await seedScenario(repo, chatRepo, szenario, stufe);
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Unbekannter Fehler beim Seeden.",
  );
  process.exit(1);
});
