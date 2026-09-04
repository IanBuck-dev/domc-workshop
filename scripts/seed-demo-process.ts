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
 *   bun run seed --showcase
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
  processDefinitionDraftSchema,
  processUnderstandingSchema,
  type ProcessCaptureConfig,
  type ProcessCaptureRecord,
  type UploadRecord,
} from "../packages/domain/src/process-understanding.ts";
import { createOpportunityProcessSnapshot } from "../packages/domain/src/opportunity-discovery.ts";
import {
  documentationFixtureSchema,
  expandCurrentStateDetails,
  expandUnderstanding,
  inhaltAt,
} from "./documentation-fixtures.ts";

class SeedError extends Error {}

function parseArgs(argv: string[]) {
  const list = argv.includes("--list");
  const alle = argv.includes("--alle");
  const showcase = argv.includes("--showcase");
  const stufeIndex = argv.indexOf("--stufe");
  const stufe = stufeIndex === -1 ? undefined : argv[stufeIndex + 1];
  const slug = argv.find(
    (value, index) => !value.startsWith("--") && argv[index - 1] !== "--stufe",
  );
  return { list, alle, showcase, stufe, slug };
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
    showcase: szenario.showcase?.state ?? "Referenz",
  }));
  const header = {
    slug: "Slug",
    titel: "Titel",
    fachbereich: "Fachbereich",
    modus: "Modus",
    dokumente: "Dokumente",
    zuege: "Vorschläge",
    showcase: "Showcase-Zustand",
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
  initialRecord: ProcessCaptureRecord,
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
      schemaVersion: 2,
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
    documentGate: documentCoverage.length ? "documents_selected" : "skipped",
    selectedUploadIds: documentCoverage.map((eintrag) => eintrag.uploadId),
  });
  const definition =
    initialRecord.profile.version === 3 && initialRecord.currentStateDetails
      ? processDefinitionDraftSchema.parse({
          schemaVersion: 1,
          understanding,
          currentStateDetails: initialRecord.currentStateDetails,
        })
      : undefined;
  await repo.finalizeChatCapture(
    processId,
    understanding,
    "complete",
    definition,
  );

  const bestaetigt = await repo.required(processId);
  if (bestaetigt.state !== "confirmed")
    throw new SeedError(
      `Der Prozess „${processId}" konnte nicht in den Zustand „bestätigt" versetzt werden.`,
    );
  createOpportunityProcessSnapshot(bestaetigt);
  return bestaetigt;
}

async function seedChatInProgress(
  chatRepo: ChatCaptureRepository,
  szenario: DemoScenarioWithScript,
  processId: string,
  uploadsByName: Map<string, UploadRecord>,
) {
  const completedTurns = szenario.showcase?.completedTurns ?? 0;
  const selectedUploadIds = [...uploadsByName.values()].map(
    (upload) => upload.id,
  );
  await chatRepo.updateState(processId, {
    documentGate: selectedUploadIds.length ? "documents_selected" : "skipped",
    selectedUploadIds,
    lastTurnOutcome: "completed",
  });
  let lastTurnAt: string | null = null;
  for (const zug of szenario.zuege.slice(0, completedTurns)) {
    const turnId = crypto.randomUUID();
    const at = new Date(Date.now() + zug.nummer * 1_000).toISOString();
    lastTurnAt = at;
    await chatRepo.append(processId, {
      schemaVersion: 2,
      id: crypto.randomUUID(),
      turnId,
      at,
      role: "user",
      status: "complete",
      text: zug.antwort,
      mentions: [],
      action:
        zug.nummer === 1 && selectedUploadIds.length
          ? "analyze_documents"
          : "message",
    });
    await chatRepo.append(processId, {
      schemaVersion: 2,
      id: crypto.randomUUID(),
      turnId,
      at: new Date(new Date(at).getTime() + 500).toISOString(),
      role: "assistant",
      status: "complete",
      text:
        zug.nummer === completedTurns
          ? "Damit sind Ablauf und Quellen klarer. Als Nächstes brauche ich noch Mengen, Bearbeitungszeiten, Kontrollen und die wichtigsten Ausnahmen."
          : "Verstanden. Ich halte diese Angaben mit ihrem Quellenbezug fest und gehe den Ablauf weiter mit Ihnen durch.",
      mentions: [],
      action: "message",
    });
  }
  await chatRepo.updateSession(processId, {
    activeSessionStarted: true,
    lastTurnAt,
  });
}

async function seedReviewRequired(
  repo: ProcessCaptureRepository,
  chatRepo: ChatCaptureRepository,
  szenario: DemoScenarioWithScript,
  processId: string,
  initialRecord: ProcessCaptureRecord,
  uploadsByName: Map<string, UploadRecord>,
) {
  const path = join(
    demoDataRoot(),
    "szenarien",
    szenario.slug,
    "aufnahme.json",
  );
  if (!existsSync(path))
    throw new SeedError(
      `Für den Review-Zustand von „${szenario.slug}" fehlt aufnahme.json.`,
    );
  const fixture = documentationFixtureSchema.parse(
    JSON.parse(await readFile(path, "utf8")),
  );
  const reviewPrompts = [
    `Ich habe die Arbeitsanweisung berücksichtigt und daraus einen ersten Überblick mit ${fixture.schritte.length} Prozessschritten erstellt. Bevor wir die Schritte einzeln prüfen: Beschreiben Sie bitte in Ihren eigenen Worten, wodurch die Bezugsrechtsänderung ausgelöst wird, wer beteiligt ist und welches Ergebnis am Ende vorliegen soll.`,
    `Danke, der Rahmen ist klar. Wir beginnen mit **Schritt 1 von ${fixture.schritte.length} – ${fixture.schritte[0]?.name}** und der anschließenden Berechtigungsprüfung.\n\n**Bereits verstanden**\nDer Auftrag wird dem Vertrag zugeordnet und die Berechtigung muss vor jeder Änderung feststehen.\n\n**Noch offen**\nWelche Angaben und Nachweise prüfen Sie konkret, und wann benötigen Sie die Zustimmung einer weiteren Person?`,
    `Damit sind Zuordnung und Berechtigungsprüfung nachvollziehbar. Als Nächstes geht es um **Schritt 3 von ${fixture.schritte.length} – ${fixture.schritte[2]?.name}**.\n\n**Bereits verstanden**\nBei einem unwiderruflichen Bezugsrecht gelten zusätzliche Anforderungen.\n\n**Noch offen**\nIn welchen Systemen und Unterlagen prüfen Sie Vertragsart, Zustimmung und Altverträge? Wie laufen Rückfragen?`,
    `Die verwendeten Quellen und Systeme sind damit erfasst. Für das Prozessbild fehlen noch Größenordnung und Belastung: Wie viele Aufträge bearbeiten Sie, wie lange dauert ein vollständiger Fall und wo entstehen heute die längsten Wartezeiten?`,
    `Danke. Wir schließen jetzt die Bearbeitung mit **Schritt 5 von ${fixture.schritte.length} – ${fixture.schritte[4]?.name}** und **${fixture.schritte[5]?.name}** ab.\n\n**Bereits verstanden**\nDie Änderung wird im Bestandssystem erfasst.\n\n**Noch offen**\nWelche Vier-Augen-Kontrolle erfolgt danach, wer erhält die Bestätigung und wo wird sie abgelegt?`,
    "Der vollständige Ist-Ablauf ist nun abgebildet. Bevor ich das Prozessbild zur Prüfung vorlege: Welche fachlichen Punkte sind noch ungeklärt oder müssen ausdrücklich durch die Teamleitung bestätigt werden?",
  ] as const;
  const evidenceIds = new Map<string, string>();
  const base = new Date(fixture.erstelltAm).getTime();
  const at = (index: number) =>
    new Date(base + (index + 1) * 60_000).toISOString();
  for (const [index, beleg] of fixture.belege.entries()) {
    await chatRepo.append(processId, {
      schemaVersion: 2,
      id: crypto.randomUUID(),
      turnId: null,
      at: at(index * 2),
      role: "assistant",
      status: "complete",
      text:
        reviewPrompts[index] ??
        "Ergänzen Sie bitte die Informationen, die im bisherigen Prozessbild noch fehlen oder korrigiert werden müssen.",
      mentions: [],
      action: index === 0 && uploadsByName.size ? "analyze_documents" : "message",
    });
    const id = crypto.randomUUID();
    evidenceIds.set(beleg.id, id);
    await chatRepo.append(processId, {
      schemaVersion: 2,
      id,
      turnId: null,
      at: at(index * 2 + 1),
      role: "user",
      status: "complete",
      text: beleg.text,
      mentions: [],
      action: "message",
    });
  }
  await chatRepo.append(processId, {
    schemaVersion: 2,
    id: crypto.randomUUID(),
    turnId: null,
    at: at(fixture.belege.length * 2),
    role: "assistant",
    status: "complete",
    text: `Danke. Ich habe Ihre Angaben in einem Prozessbild mit ${fixture.schritte.length} Schritten zusammengeführt. Der offene Punkt zur Zustimmungsformulierung bei Altverträgen ist sichtbar festgehalten. Bitte prüfen Sie jetzt den Gesamtstand und lassen Sie die offene Frage durch die Teamleitung klären.`,
    mentions: [],
    action: "confirmation",
  });
  const expandedUnderstanding = expandUnderstanding(
    fixture,
    inhaltAt(fixture, 0),
    evidenceIds,
  );
  const selectedUploads = [...uploadsByName.values()];
  const understanding = processUnderstandingSchema.parse({
    ...expandedUnderstanding,
    documentCoverage: selectedUploads.map((upload) => ({
      uploadId: upload.id,
      name: upload.name,
      status: "complete",
      processedCharacters: null,
      limitation: null,
    })),
  });
  if (!initialRecord.currentStateDetails)
    throw new SeedError(
      `Der Review-Prozess „${szenario.slug}" besitzt keine Ist-Prozessdefinition.`,
    );
  const currentStateDetails = expandCurrentStateDetails(
    fixture,
    inhaltAt(fixture, 0),
    understanding,
    initialRecord.currentStateDetails,
  );
  const definition = processDefinitionDraftSchema.parse({
    schemaVersion: 1,
    understanding,
    currentStateDetails,
  });
  const selectedUploadIds = selectedUploads.map((upload) => upload.id);
  await chatRepo.updateState(processId, {
    documentGate: selectedUploadIds.length ? "documents_selected" : "skipped",
    selectedUploadIds,
    lastTurnOutcome: "completed",
  });
  await repo.finalizeChatCapture(
    processId,
    understanding,
    "with_gaps",
    definition,
  );
  await repo.correctUnderstanding(
    processId,
    understanding,
    "Das erzeugte Prozessbild wartet auf die fachliche Prüfung durch die Teamleitung.",
  );
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
      record,
      uploadsByName,
    );
  else if (stufe === "showcase") {
    const state = szenario.showcase?.state;
    if (!state)
      throw new SeedError(
        `Für „${szenario.slug}" ist kein Showcase-Zustand definiert.`,
      );
    if (state === "not_started" && uploadsByName.size)
      throw new SeedError(
        `Der ungestartete Showcase-Prozess „${szenario.slug}" darf keine Uploads besitzen.`,
      );
    if (state === "chat_in_progress")
      await seedChatInProgress(chatRepo, szenario, record.id, uploadsByName);
    if (state === "review_required")
      await seedReviewRequired(
        repo,
        chatRepo,
        szenario,
        record.id,
        record,
        uploadsByName,
      );
  }

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
  if (stufe === "showcase")
    console.log(`  Showcase: ${szenario.showcase!.state}`);
}

async function main() {
  const { list, alle, showcase, stufe, slug } = parseArgs(
    process.argv.slice(2),
  );
  if (stufe !== undefined && stufe !== "bestaetigt")
    throw new SeedError(
      `Unbekannte Stufe „${stufe}". Unterstützt wird bisher nur „bestaetigt".`,
    );
  if (alle && stufe)
    throw new SeedError(
      `„--stufe" ist nur zusammen mit einem einzelnen Szenario nutzbar, nicht mit „--alle".`,
    );
  if (showcase && (alle || stufe || slug))
    throw new SeedError(
      `„--showcase" kann nicht mit einem Slug, „--alle" oder „--stufe" kombiniert werden.`,
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

  if (!alle && !showcase && !slug)
    throw new SeedError(
      "Bitte einen Szenario-Slug angeben, „--alle“ oder „--list“ verwenden.",
    );

  const root = workspacePath();
  await ensureWorkspace(root);
  const repo = new ProcessCaptureRepository(root);
  const chatRepo = new ChatCaptureRepository(root);

  if (showcase) {
    const showcaseScenarios = szenarien.filter(
      (szenario) => szenario.showcase !== undefined,
    );
    if (!showcaseScenarios.length)
      throw new SeedError("Keine Showcase-Aufnahmezustände definiert.");
    for (const szenario of showcaseScenarios)
      await seedScenario(repo, chatRepo, szenario, "showcase");
    return;
  }

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
