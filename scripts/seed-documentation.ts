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
  normalizedProcessName,
  type CurrentStateDetails,
  type ProcessCaptureConfig,
} from "../packages/domain/src/process-understanding.ts";
import {
  expandUnderstanding,
  inhaltAt,
  listDocumentationFixtures,
  type DocumentationFixture,
} from "./documentation-fixtures.ts";

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

async function main() {
  const argv = process.argv.slice(2);
  const fixtures = await listDocumentationFixtures();
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
    const zuordnung = new Map<string, string>();
    for (const beleg of fixture.belege) {
      const id = crypto.randomUUID();
      zuordnung.set(beleg.id, id);
      await chats.append(prozessIds.get(fixture.slug)!, {
        schemaVersion: 2,
        id,
        turnId: null,
        at: fixture.erstelltAm,
        role: "user",
        status: "complete",
        text: beleg.text,
        mentions: [],
        action: "message",
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
      const understanding = expandUnderstanding(
        fixture,
        inhaltAt(fixture, nummer),
        zuordnung,
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
            currentStateDetails: initialDetails.get(fixture.slug)!,
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
    });
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
