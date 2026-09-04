/**
 * Legt die Seeddaten für die lebende Prozessdokumentation an: bestätigte
 * Prozesse aus `demo-data/dokumentation/` samt der Fortschreibung, die daraus
 * im Dokumentationsarchiv (`workspace/docs`) eine lesbare Historie macht.
 *
 * Es wird nichts von Hand ins Archiv geschrieben. Jeder Commit entsteht über
 * denselben Weg wie im Betrieb — bestätigen, korrigieren, erneut bestätigen,
 * zurücknehmen — damit das Archiv exakt das zeigt, was die Anwendung
 * tatsächlich erzeugt. Die Ereignisse laufen in zeitlicher Reihenfolge über
 * alle Prozesse hinweg, deshalb wächst der Katalog Dokument für Dokument.
 *
 * Aufruf:
 *   bun run seed:docs --list
 *   bun run seed:docs
 */
import { join, resolve } from "node:path";
import { workspacePath } from "../apps/server/src/launcher.ts";
import { CorpusService } from "../apps/server/src/corpus-service.ts";
import { ChatCaptureRepository } from "../packages/storage/src/chat-capture-repository.ts";
import {
  ProcessCaptureRepository,
  DuplicateProcessNameError,
} from "../packages/storage/src/process-capture-repository.ts";
import {
  processCaptureConfigSchema,
  processUnderstandingSchema,
  normalizedProcessName,
  type CurrentStateDetails,
  type ProcessCaptureConfig,
  type UploadRecord,
} from "../packages/domain/src/process-understanding.ts";
import { MemoryRepository } from "../packages/storage/src/memory-repository.ts";
import {
  expandUnderstanding,
  expandCurrentStateDetails,
  inhaltAt,
  listDocumentationFixtures,
  type DocumentationFixture,
} from "./documentation-fixtures.ts";
import { seedShowcaseOpportunity } from "./showcase-opportunity-fixture.ts";
import { listShowcaseJourneyFixtures } from "./showcase-journey-fixtures.ts";

/**
 * Der Zeitstempel eines Datensatzes entsteht dort, wo er geschrieben wird —
 * in der Repository-Schicht. Damit die Seeddaten über Monate verteilt liegen,
 * ohne dass die Produktivpfade ein Datum entgegennehmen müssten, läuft jedes
 * Ereignis unter einer festgestellten Uhr. Git erhält dasselbe Datum über die
 * Umgebung, sonst trüge die Historie das heutige Datum.
 */
const SystemDate = Date;
function withClock<T>(iso: string, action: () => Promise<T>) {
  const fixed = new SystemDate(iso).getTime();
  class FrozenDate extends SystemDate {
    constructor(...args: [] | [value: number | string | Date]) {
      super(args.length === 0 ? fixed : args[0]);
    }
    static now() {
      return fixed;
    }
  }
  globalThis.Date = FrozenDate as unknown as DateConstructor;
  process.env.GIT_AUTHOR_DATE = iso;
  process.env.GIT_COMMITTER_DATE = iso;
  return action().finally(() => {
    globalThis.Date = SystemDate;
    delete process.env.GIT_AUTHOR_DATE;
    delete process.env.GIT_COMMITTER_DATE;
  });
}

async function loadConfig(): Promise<ProcessCaptureConfig> {
  const root =
    process.env.CLAIMS_AI_DEFAULTS_DIR ?? resolve(process.cwd(), "defaults");
  return processCaptureConfigSchema.parse(
    await Bun.file(join(root, "process-capture-config.json")).json(),
  );
}

type Ereignis =
  | { at: string; art: "erstbestaetigung"; fixture: DocumentationFixture }
  | {
      at: string;
      art: "revision";
      fixture: DocumentationFixture;
      nummer: number;
    }
  | {
      at: string;
      art: "ruecknahme";
      fixture: DocumentationFixture;
      nummer: number;
    };

function ereignisse(fixtures: DocumentationFixture[]): Ereignis[] {
  const liste: Ereignis[] = [];
  for (const fixture of fixtures) {
    liste.push({ at: fixture.bestaetigtAm, art: "erstbestaetigung", fixture });
    fixture.revisionen.forEach((revision, index) => {
      liste.push({
        at: revision.bestaetigtAm,
        art: "revision",
        fixture,
        nummer: index + 1,
      });
      if (revision.zurueckgenommenAm)
        liste.push({
          at: revision.zurueckgenommenAm,
          art: "ruecknahme",
          fixture,
          nummer: index + 1,
        });
    });
  }
  return liste.sort((left, right) => left.at.localeCompare(right.at));
}

class SeedError extends Error {}

const compactCapturePrompts = [
  "Bevor wir einzelne Schritte festhalten, brauche ich einen kurzen Überblick über den heutigen Prozess. Beschreiben Sie bitte in Ihren eigenen Worten, was den Vorgang auslöst, welches fachliche Ergebnis am Ende vorliegen soll und wer hauptsächlich beteiligt ist.",
  "Danke, der Rahmen ist damit erkennbar. Beschreiben Sie nun bitte den normalen Ablauf in seiner tatsächlichen Reihenfolge: Was geschieht zuerst, welche Arbeit folgt danach und welche Rollen übernehmen die einzelnen Tätigkeiten?",
  "Der Hauptablauf wird klarer. Ergänzen Sie bitte, welche Informationen, Unterlagen und Systeme die Mitarbeitenden dabei verwenden und an welchen Stellen Daten manuell übertragen oder außerhalb der führenden Systeme bearbeitet werden.",
  "Als Nächstes möchte ich die fachlichen Entscheidungen und Kontrollen verstehen. Erzählen Sie bitte, welche Fälle unterschiedlich behandelt werden, wer entscheidet oder freigibt und welche Ausnahmen im heutigen Ablauf besonders wichtig sind.",
  "Beschreiben Sie bitte noch, wie der normale Vorgang abgeschlossen wird: Welche Übergaben erfolgen, wo werden Ergebnis und Nachweise gespeichert und woran erkennen die Beteiligten, dass der Prozess beendet ist?",
  "Zum Abschluss fehlen noch Größenordnung und Belastung. Erzählen Sie bitte, wie häufig der Prozess läuft, wie lange er typischerweise dauert und an welchen Stellen heute die größten Wartezeiten, Wiederholungen oder Fehler entstehen.",
] as const;

function compactCapturePrompt(index: number) {
  return (
    compactCapturePrompts[index] ??
    "Ergänzen Sie bitte weitere konkrete Informationen zum heutigen Ablauf, die im bisherigen Prozessbild noch fehlen oder korrigiert werden müssen."
  );
}

async function main() {
  const argv = process.argv.slice(2);
  const fixtures = await listDocumentationFixtures();
  const journeys = await listShowcaseJourneyFixtures();
  const journeyBySlug = new Map(
    journeys.map((journey) => [journey.slug, journey]),
  );
  const fixtureBySlug = new Map(
    fixtures.map((fixture) => [fixture.slug, fixture]),
  );
  for (const journey of journeys) {
    const fixture = fixtureBySlug.get(journey.slug);
    if (!fixture)
      throw new SeedError(
        `Showcase-Journey „${journey.slug}" besitzt kein Dokumentations-Fixture.`,
      );
    const expectedEvidence = fixture.belege.map((item) => item.id).sort();
    const actualEvidence = journey.conversation
      .map((turn) => turn.userEvidenceId)
      .sort();
    if (JSON.stringify(actualEvidence) !== JSON.stringify(expectedEvidence))
      throw new SeedError(
        `Showcase-Journey „${journey.slug}" muss jeden Gesprächsbeleg genau einmal verwenden.`,
      );
  }
  if (argv.includes("--list")) {
    for (const fixture of fixtures)
      console.log(
        `${fixture.slug.padEnd(38)} ${fixture.fachbereich.padEnd(10)} ${
          fixture.schritte.length
        } Schritte  ${fixture.revisionen.length} Revisionen  ${fixture.titel}`,
      );
    return;
  }

  const root = workspacePath();
  const repo = new ProcessCaptureRepository(root);
  const chats = new ChatCaptureRepository(root);
  const memory = new MemoryRepository(root);
  const corpus = new CorpusService(repo, root);
  const config = await loadConfig();
  await corpus.initialize();

  const vorhanden = new Map(
    (await repo.list()).map((record) => [
      normalizedProcessName(record.cover.processName),
      record,
    ]),
  );
  const prozessIds = new Map<string, string>();
  const initialDetails = new Map<string, CurrentStateDetails>();
  const belegIds = new Map<string, Map<string, string>>();
  const commits = new Map<string, string>();
  const uploads = new Map<string, UploadRecord[]>();
  const uebersprungen: string[] = [];

  for (const fixture of fixtures) {
    const bestehend = vorhanden.get(normalizedProcessName(fixture.titel));
    if (!bestehend) continue;
    uebersprungen.push(
      `${fixture.titel} — der Prozess ${bestehend.id} trägt diesen Namen bereits.`,
    );
  }
  const offen = fixtures.filter(
    (fixture) => !vorhanden.has(normalizedProcessName(fixture.titel)),
  );
  if (!offen.length)
    throw new SeedError(
      `Alle Seedprozesse sind bereits angelegt:\n${uebersprungen
        .map((zeile) => `  ${zeile}`)
        .join(
          "\n",
        )}\nEin frischer Stand entsteht über: bun run scripts/reset-workspace.ts ZURÜCKSETZEN`,
    );

  // Anlage und Gesprächsverlauf entstehen vor der Bestätigung — sonst hätte
  // das Prozessbild keine Nachricht, auf die sich seine Belege stützen können.
  for (const fixture of offen) {
    await withClock(fixture.erstelltAm, async () => {
      try {
        const record = await repo.create(
          {
            department: fixture.fachbereich,
            participantName: fixture.gespraechspartner.name,
            participantEmail: fixture.gespraechspartner.email,
            processName: fixture.titel,
          },
          config,
          "chat",
        );
        prozessIds.set(fixture.slug, record.id);
        if (!record.currentStateDetails)
          throw new SeedError(
            `Der Prozess „${fixture.titel}" besitzt keine initiale Ist-Prozessdefinition.`,
          );
        initialDetails.set(fixture.slug, record.currentStateDetails);
      } catch (error) {
        if (error instanceof DuplicateProcessNameError)
          throw new SeedError(
            `Der Prozessname „${fixture.titel}" ist bereits vergeben.`,
          );
        throw error;
      }
    });
    const processId = prozessIds.get(fixture.slug)!;
    const journey = journeyBySlug.get(fixture.slug);
    const journeyUploads: UploadRecord[] = [];
    if (journey) {
      const mime = {
        md: "text/markdown",
        txt: "text/plain",
        csv: "text/csv",
        pdf: "application/pdf",
      } as const;
      for (const document of journey.documents) {
        const bytes = await Bun.file(
          resolve(process.cwd(), document.source),
        ).bytes();
        journeyUploads.push(
          await repo.saveUpload(
            processId,
            new File([bytes], document.targetName, {
              type: mime[document.mediaType],
            }),
          ),
        );
      }
      await chats.updateState(processId, {
        documentGate: journeyUploads.length ? "documents_selected" : "skipped",
        selectedUploadIds: journeyUploads.map((upload) => upload.id),
        lastTurnOutcome: "completed",
      });
    }
    uploads.set(fixture.slug, journeyUploads);

    const zuordnung = new Map<string, string>();
    const evidenceById = new Map(fixture.belege.map((item) => [item.id, item]));
    if (journey) {
      const base = new Date(fixture.erstelltAm).getTime();
      const at = (index: number) =>
        new Date(base + (index + 1) * 60_000).toISOString();
      await chats.append(processId, {
        schemaVersion: 2,
        id: crypto.randomUUID(),
        turnId: null,
        at: at(0),
        role: "assistant",
        status: "complete",
        text: journeyUploads.length
          ? `Ich habe ${journeyUploads.length} Unterlage${journeyUploads.length === 1 ? "" : "n"} berücksichtigt und daraus einen ersten Überblick mit ${fixture.schritte.length} Prozessschritten erstellt. Wir prüfen jetzt immer genau einen Schritt: Ich zeige Ihnen zuerst, was bereits klar ist und welche Angaben noch fehlen.`
          : "Wir erfassen den heutigen Ablauf ohne Unterlagen. Ich frage die relevanten Punkte Schritt für Schritt ab.",
        mentions: [],
        action: journeyUploads.length ? "analyze_documents" : "skip_documents",
      });
      for (const [index, turn] of journey.conversation.entries()) {
        await chats.append(processId, {
          schemaVersion: 2,
          id: crypto.randomUUID(),
          turnId: null,
          at: at(index * 2 + 1),
          role: "assistant",
          status: "complete",
          text: turn.assistant,
          mentions: [],
          action: "message",
        });
        const evidence = evidenceById.get(turn.userEvidenceId)!;
        const id = crypto.randomUUID();
        zuordnung.set(evidence.id, id);
        await chats.append(processId, {
          schemaVersion: 2,
          id,
          turnId: null,
          at: at(index * 2 + 2),
          role: "user",
          status: "complete",
          text: evidence.text,
          mentions: [],
          action: "message",
        });
      }
      await chats.append(processId, {
        schemaVersion: 2,
        id: crypto.randomUUID(),
        turnId: null,
        at: at(journey.conversation.length * 2 + 2),
        role: "assistant",
        status: "complete",
        text: "Danke. Ich habe Ablauf, Rollen, Systeme, Kontrollen und offene Punkte im Prozessbild zusammengeführt. Bitte prüfen Sie den Stand vor der Bestätigung.",
        mentions: [],
        action: "confirmation",
      });
    } else {
      const base = new Date(fixture.erstelltAm).getTime();
      const at = (index: number) =>
        new Date(base + (index + 1) * 60_000).toISOString();
      for (const [index, beleg] of fixture.belege.entries()) {
        await chats.append(processId, {
          schemaVersion: 2,
          id: crypto.randomUUID(),
          turnId: null,
          at: at(index * 2),
          role: "assistant",
          status: "complete",
          text: compactCapturePrompt(index),
          mentions: [],
          action: "message",
        });
        const id = crypto.randomUUID();
        zuordnung.set(beleg.id, id);
        await chats.append(processId, {
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
      await chats.append(processId, {
        schemaVersion: 2,
        id: crypto.randomUUID(),
        turnId: null,
        at: at(fixture.belege.length * 2),
        role: "assistant",
        status: "complete",
        text: "Danke. Ich habe Ihre Angaben als heutigen Ablauf strukturiert und die noch unbekannten oder widersprüchlichen Punkte sichtbar im Prozessbild festgehalten. Bitte prüfen Sie den Gesamtstand vor der fachlichen Bestätigung.",
        mentions: [],
        action: "confirmation",
      });
    }
    belegIds.set(fixture.slug, zuordnung);
  }

  for (const ereignis of ereignisse(offen)) {
    const { fixture } = ereignis;
    const id = prozessIds.get(fixture.slug)!;
    const zuordnung = belegIds.get(fixture.slug)!;
    await withClock(ereignis.at, async () => {
      if (ereignis.art === "ruecknahme") {
        const commit = commits.get(`${fixture.slug}#${ereignis.nummer}`);
        if (!commit)
          throw new SeedError(
            `Die zurückzunehmende Änderung an „${fixture.titel}" hat keinen Commit erzeugt.`,
          );
        const { commit: ruecknahme } = await corpus.revert(commit);
        console.log(
          `${ereignis.at.slice(0, 10)}  Rücknahme   ${id}  ${fixture.titel} — ${ruecknahme.slice(0, 10)}`,
        );
        return;
      }

      const nummer = ereignis.art === "revision" ? ereignis.nummer : 0;
      let understanding = expandUnderstanding(
        fixture,
        inhaltAt(fixture, nummer),
        zuordnung,
      );
      const selectedUploads = uploads.get(fixture.slug) ?? [];
      if (selectedUploads.length)
        understanding = processUnderstandingSchema.parse({
          ...understanding,
          documentCoverage: selectedUploads.map((upload) => ({
            uploadId: upload.id,
            name: upload.name,
            status: "complete",
            processedCharacters: null,
            limitation: null,
          })),
        });
      const currentStateDetails = expandCurrentStateDetails(
        fixture,
        inhaltAt(fixture, nummer),
        understanding,
        initialDetails.get(fixture.slug)!,
      );
      if (ereignis.art === "erstbestaetigung")
        await repo.finalizeChatCapture(
          id,
          understanding,
          understanding.knowledgeGaps.length || understanding.conflicts.length
            ? "with_gaps"
            : "complete",
          {
            schemaVersion: 1,
            understanding,
            currentStateDetails,
          },
        );
      else {
        // Frühere Korrekturbelege werden mitgeführt: `correctUnderstanding`
        // stellt bei unveränderten Angaben deren alte Belegverweise wieder her,
        // und die zeigen nach der ersten Revision auf Korrektureinträge.
        const vorher = await repo.required(id);
        const korrekturen = (vorher.understanding?.evidence ?? []).filter(
          (eintrag) => eintrag.kind === "human_correction",
        );
        await repo.correctUnderstanding(
          id,
          {
            ...understanding,
            evidence: [...understanding.evidence, ...korrekturen],
          },
          fixture.revisionen[nummer - 1]!.notiz,
        );
        await repo.confirm(id);
      }
      const ergebnis = await corpus.syncProcess(id);
      if (ergebnis.result === "error") throw new SeedError(ergebnis.error);
      if (ergebnis.result === "updated")
        commits.set(`${fixture.slug}#${nummer}`, ergebnis.commit);
      const label =
        ereignis.art === "erstbestaetigung" ? "Bestätigung" : "Revision  ";
      console.log(
        `${ereignis.at.slice(0, 10)}  ${label}  ${id}  ${fixture.titel} — ${
          ergebnis.commit ? ergebnis.commit.slice(0, 10) : "keine Änderung"
        }`,
      );
      if (ereignis.art === "erstbestaetigung") {
        const journey = journeyBySlug.get(fixture.slug);
        const confirmed = await repo.required(id);
        if (journey && confirmed.confirmedAt)
          await memory.applyOperations(
            `deterministischer-demo-seed:${id}`,
            {
              operations: journey.memoryFacts.map((item) => ({
                action: "add" as const,
                topic: item.topic,
                fact: item.fact,
              })),
            },
            {
              processId: id,
              confirmedAt: confirmed.confirmedAt.slice(0, 10),
            },
          );
      }
    });
  }

  for (const journey of journeys) {
    const processId = prozessIds.get(journey.slug);
    if (!processId) continue;
    await seedShowcaseOpportunity(
      root,
      await repo.required(processId),
      journey,
    );
    console.log(
      `Showcase     ${processId}  KI-Szenarien und Potenzialbewertung angelegt (${journey.expectedScore})`,
    );
  }

  if (uebersprungen.length) {
    console.log("\nÜbersprungen:");
    for (const zeile of uebersprungen) console.log(`  ${zeile}`);
  }
  const log = await corpus.git.log(200, 0);
  console.log(
    `\n${offen.length} Prozesse dokumentiert, ${log.length} Einträge im Archiv unter ${corpus.docsRoot}.`,
  );
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Unbekannter Fehler beim Seeden.",
  );
  process.exit(1);
});
