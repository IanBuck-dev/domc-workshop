/**
 * Kompakte Quellform für die Dokumentations-Seeddaten unter
 * `demo-data/dokumentation/`.
 *
 * Warum eine eigene, kürzere Form statt fertiger `ProcessUnderstanding`-JSONs:
 * Ein vollständiges Prozessbild besteht zu großen Teilen aus Struktur, die sich
 * mechanisch ableiten lässt — Bezeichner, Graphknoten, Belegverweise,
 * Provenienzwerte. Von Hand geschrieben bleibt hier nur der fachliche Text.
 * Der Expander unten erzeugt daraus ein Prozessbild, das dieselbe Validierung
 * besteht wie ein echtes Ergebnis der Synthese.
 */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import {
  processDecisionModeSchema,
  processInformationTypeSchema,
  currentStateDetailsSchema,
  processUnderstandingSchema,
  provenanceSchema,
  type CurrentStateDetails,
  type ProcessUnderstanding,
} from "../packages/domain/src/process-understanding.ts";

export function documentationFixtureRoot() {
  return (
    process.env.CLAIMS_AI_DOCUMENTATION_FIXTURES ??
    join(process.cwd(), "demo-data", "dokumentation")
  );
}

const belegIdSchema = z.string().regex(/^b\d+$/);

/**
 * Eine Angabe ist entweder nur ihr Wert — dann gelten die Vorgaben — oder ein
 * Objekt mit Herkunft, Belegen, Konfidenz und Annahmen. Ohne Beleg gilt eine
 * Angabe als abgeleitet, mit Beleg als vom Gesprächspartner genannt; das ist
 * dieselbe Unterscheidung, die die Synthese im Betrieb trifft.
 */
function angabe<S extends z.ZodType<unknown>>(wertSchema: S) {
  const detail = z
    .object({
      wert: wertSchema,
      provenienz: provenanceSchema.optional(),
      belege: z.array(belegIdSchema).max(50).default([]),
      konfidenz: z.number().int().min(0).max(100).nullable().optional(),
      annahmen: z
        .array(z.string().trim().min(1).max(1_000))
        .max(20)
        .default([]),
      bestaetigt: z.boolean().default(true),
    })
    .strict();
  return z.union([
    detail,
    wertSchema.transform((wert) => ({
      wert,
      belege: [] as string[],
      annahmen: [] as string[],
      bestaetigt: true,
    })),
  ]);
}

const textAngabe = angabe(z.string().trim().min(1).max(12_000));
const listeAngabe = angabe(
  z.array(z.string().trim().min(1).max(2_000)).min(1).max(100),
);

const informationSchema = z
  .object({
    name: z.string().trim().min(1).max(1_000),
    quelle: z.string().trim().min(1).max(1_000).nullable().default(null),
    typ: processInformationTypeSchema,
    typDetail: z.string().trim().min(1).max(200).nullable().default(null),
  })
  .strict();

const schrittSchema = z
  .object({
    name: z.string().trim().min(1).max(500),
    taetigkeit: z.string().trim().min(1).max(1_000),
    eingaben: z.array(z.string().trim().min(1).max(1_000)).min(1).max(30),
    ausgaben: z.array(z.string().trim().min(1).max(1_000)).min(1).max(30),
    hinweis: z.string().trim().min(1).max(4_000).nullable().default(null),
    informationen: z.array(informationSchema).max(40).default([]),
    akteure: z
      .array(
        z
          .object({
            art: z.enum(["department", "role", "external_party"]),
            name: z.string().trim().min(1).max(240),
            beteiligung: z.enum([
              "performs",
              "decides",
              "approves",
              "receives",
              "supplies",
            ]),
          })
          .strict(),
      )
      .max(20)
      .default([]),
    provenienz: provenanceSchema.optional(),
    belege: z.array(belegIdSchema).max(50).default([]),
    konfidenz: z.number().int().min(0).max(100).nullable().optional(),
    annahmen: z.array(z.string().trim().min(1).max(1_000)).max(20).default([]),
  })
  .strict();

/**
 * Genau eine Entscheidung je Prozess. Mehr Verzweigungen wären möglich, aber
 * die Seeddaten sollen den Graphen zeigen, nicht ausreizen.
 */
const verzweigungSchema = z
  .object({
    nachSchritt: z.number().int().min(1).max(8),
    frage: z.string().trim().min(1).max(2_000),
    modus: processDecisionModeSchema.default("rule_based"),
    zweige: z
      .array(
        z
          .object({
            label: z.string().trim().min(1).max(1_000),
            ziel: z.union([z.number().int().min(1).max(8), z.literal("ende")]),
            ermittlung: z.string().trim().min(1).max(2_000).optional(),
            folge: z.string().trim().min(1).max(2_000).optional(),
          })
          .strict(),
      )
      .min(2)
      .max(4),
  })
  .strict();

const inhaltSchema = {
  zweck: textAngabe,
  ausloeser: textAngabe,
  ergebnis: textAngabe,
  abgrenzung: textAngabe,
  beteiligte: listeAngabe,
  informationsquellen: listeAngabe,
  systeme: listeAngabe,
  kontrollen: listeAngabe,
  uebergaben: listeAngabe,
  mengenUndZeiten: listeAngabe,
  schwachstellen: listeAngabe,
  verbesserungsziele: listeAngabe,
  wissensluecken: z.array(z.string().trim().min(1).max(2_000)).max(50),
  widersprueche: z.array(z.string().trim().min(1).max(2_000)).max(50),
  schritte: z.array(schrittSchema).min(1).max(8),
  verzweigung: verzweigungSchema.nullable(),
};

const pddSchema = z
  .object({
    kurzbeschreibung: z.string().trim().min(1).max(4_000),
    prozesseignerRolle: z.string().trim().min(1).max(240),
    vertraulichkeit: z.enum([
      "internal",
      "confidential",
      "strictly_confidential",
    ]),
    betriebUndSupport: z.string().trim().min(1).max(4_000),
    zugriffUndSchutz: z.string().trim().min(1).max(4_000),
    monitoringUndNachvollziehbarkeit: z.string().trim().min(1).max(4_000),
    leitplankenUndOffeneFragen: z
      .array(z.string().trim().min(1).max(2_000))
      .max(40),
  })
  .strict();

const revisionSchema = z
  .object({
    bestaetigtAm: z.string().datetime(),
    notiz: z.string().trim().min(1).max(2_000),
    zurueckgenommenAm: z.string().datetime().nullable().default(null),
    aenderung: z
      .object(
        Object.fromEntries(
          Object.entries(inhaltSchema).map(([key, schema]) => [
            key,
            schema.optional(),
          ]),
        ) as {
          [K in keyof typeof inhaltSchema]: z.ZodOptional<
            (typeof inhaltSchema)[K]
          >;
        },
      )
      .strict(),
  })
  .strict();

export const documentationFixtureSchema = z
  .object({
    slug: z.string().regex(/^[a-z0-9-]+$/),
    titel: z.string().trim().min(1).max(240),
    fachbereich: z.string().trim().min(1).max(120),
    gespraechspartner: z
      .object({
        name: z.string().trim().min(1).max(200),
        email: z.string().trim().email().max(320),
      })
      .strict(),
    erstelltAm: z.string().datetime(),
    bestaetigtAm: z.string().datetime(),
    belege: z
      .array(
        z
          .object({
            id: belegIdSchema,
            text: z.string().trim().min(1).max(2_000),
          })
          .strict(),
      )
      .min(1)
      .max(30),
    revisionen: z.array(revisionSchema).max(5).default([]),
    pdd: pddSchema.optional(),
    ...inhaltSchema,
  })
  .strict()
  .superRefine((fixture, ctx) => {
    const belegIds = new Set(fixture.belege.map((beleg) => beleg.id));
    if (belegIds.size !== fixture.belege.length)
      ctx.addIssue({
        code: "custom",
        path: ["belege"],
        message: "Beleg-Kennungen müssen eindeutig sein.",
      });
    if (new Date(fixture.erstelltAm) >= new Date(fixture.bestaetigtAm))
      ctx.addIssue({
        code: "custom",
        path: ["bestaetigtAm"],
        message: "Ein Prozess wird nach seiner Anlage bestätigt, nicht davor.",
      });
    let vorher = new Date(fixture.bestaetigtAm);
    fixture.revisionen.forEach((revision, index) => {
      const datum = new Date(revision.bestaetigtAm);
      if (datum <= vorher)
        ctx.addIssue({
          code: "custom",
          path: ["revisionen", index, "bestaetigtAm"],
          message: "Revisionen müssen zeitlich aufsteigend sein.",
        });
      if (
        revision.zurueckgenommenAm &&
        new Date(revision.zurueckgenommenAm) <= datum
      )
        ctx.addIssue({
          code: "custom",
          path: ["revisionen", index, "zurueckgenommenAm"],
          message:
            "Eine Rücknahme liegt nach der Änderung, die sie zurücknimmt.",
        });
      vorher = datum;
    });
  });

export type DocumentationFixture = z.infer<typeof documentationFixtureSchema>;
type Inhalt = { [K in keyof typeof inhaltSchema]: DocumentationFixture[K] };
type Angabe = { wert: unknown; belege: string[]; annahmen: string[] } & {
  provenienz?: z.infer<typeof provenanceSchema>;
  konfidenz?: number | null;
  bestaetigt?: boolean;
};

function herkunft(angabe: Omit<Angabe, "wert">) {
  const belegt = angabe.belege.length > 0;
  return {
    provenance: angabe.provenienz ?? (belegt ? "user_stated" : "ai_inferred"),
    evidenceIds: angabe.belege.map((id) => `ev-${id}`),
    confidence:
      angabe.konfidenz === undefined ? (belegt ? 92 : 68) : angabe.konfidenz,
    assumptions: angabe.annahmen,
    confirmed: angabe.bestaetigt ?? true,
  };
}
function fakt(angabe: Angabe) {
  return { value: angabe.wert, ...herkunft(angabe) };
}

/**
 * Erzeugt den kanonischen Graphen aus der Schrittfolge: eine Kette vom Start
 * zum Ende, optional unterbrochen von genau einer Entscheidung.
 */
function flow(inhalt: Inhalt) {
  const letzter = inhalt.schritte.length;
  const nodes: Array<Record<string, unknown>> = [
    { id: "start", kind: "startEvent" },
    ...inhalt.schritte.map((_, index) => ({
      id: `step-${index + 1}`,
      kind: "step",
      stepId: `step-${index + 1}`,
    })),
    { id: "end", kind: "endEvent" },
  ];
  const edges: Array<Record<string, unknown>> = [
    { id: "edge-1", source: "start", target: "step-1" },
  ];
  const verzweigung = inhalt.verzweigung;
  if (verzweigung)
    nodes.push({
      id: "xor-1",
      kind: "gateway",
      question: verzweigung.frage,
      mode: verzweigung.modus,
    });
  const ziel = (nummer: number | "ende") =>
    nummer === "ende" ? "end" : `step-${nummer}`;
  for (let order = 1; order <= letzter; order += 1) {
    const quelle = `step-${order}`;
    if (verzweigung && verzweigung.nachSchritt === order) {
      edges.push({
        id: `edge-${edges.length + 1}`,
        source: quelle,
        target: "xor-1",
      });
      for (const zweig of verzweigung.zweige)
        edges.push({
          id: `edge-${edges.length + 1}`,
          source: "xor-1",
          target: ziel(zweig.ziel),
          label: zweig.label,
          ...(zweig.ermittlung ? { determination: zweig.ermittlung } : {}),
          ...(zweig.folge ? { consequence: zweig.folge } : {}),
        });
      continue;
    }
    edges.push({
      id: `edge-${edges.length + 1}`,
      source: quelle,
      target: order === letzter ? "end" : `step-${order + 1}`,
    });
  }
  return { nodes, edges };
}

/**
 * Baut aus dem Inhalt ein vollständiges Prozessbild. `belegIds` bildet die
 * kurzen Fixture-Kennungen auf die Kennungen der tatsächlich angelegten
 * Chat-Nachrichten ab — `assertUnderstandingReferences` lässt nur Evidenz zu,
 * die auf real vorhandene Nachrichten zeigt.
 */
export function expandUnderstanding(
  fixture: DocumentationFixture,
  inhalt: Inhalt,
  belegIds: Map<string, string>,
): ProcessUnderstanding {
  const evidence = fixture.belege.map((beleg) => ({
    id: `ev-${beleg.id}`,
    kind: "chat_message" as const,
    sourceId: belegIds.get(beleg.id)!,
    excerpt: beleg.text,
  }));
  const steps = inhalt.schritte.map((schritt, index) => ({
    id: `step-${index + 1}`,
    order: index + 1,
    name: schritt.name,
    activity: schritt.taetigkeit,
    inputs: schritt.eingaben,
    outputs: schritt.ausgaben,
    informationItems: schritt.informationen.map((information, nummer) => ({
      id: `step-${index + 1}-info-${nummer + 1}`,
      name: information.name,
      source: information.quelle,
      type: information.typ,
      typeDetail: information.typDetail,
    })),
    actors: schritt.akteure.map((actor, nummer) => ({
      id: `step-${index + 1}-actor-${nummer + 1}`,
      kind: actor.art,
      name: actor.name,
      involvement: actor.beteiligung,
    })),
    miscellaneous: schritt.hinweis,
    ...herkunft({
      provenienz: schritt.provenienz,
      belege: schritt.belege,
      konfidenz: schritt.konfidenz,
      annahmen: schritt.annahmen,
    }),
  }));
  return processUnderstandingSchema.parse({
    schemaVersion: 3,
    purpose: fakt(inhalt.zweck as Angabe),
    trigger: fakt(inhalt.ausloeser as Angabe),
    outcome: fakt(inhalt.ergebnis as Angabe),
    boundaries: fakt(inhalt.abgrenzung as Angabe),
    participants: fakt(inhalt.beteiligte as Angabe),
    informationSources: fakt(inhalt.informationsquellen as Angabe),
    systems: fakt(inhalt.systeme as Angabe),
    controls: fakt(inhalt.kontrollen as Angabe),
    handoffs: fakt(inhalt.uebergaben as Angabe),
    volumeAndTime: fakt(inhalt.mengenUndZeiten as Angabe),
    painPoints: fakt(inhalt.schwachstellen as Angabe),
    improvementGoals: fakt(inhalt.verbesserungsziele as Angabe),
    evidence,
    documentCoverage: [],
    knowledgeGaps: inhalt.wissensluecken,
    conflicts: inhalt.widersprueche,
    steps,
    flow: flow(inhalt),
  });
}

/**
 * Ergänzt den vollständigen Ist-Zustand nur für Fixtures, die ihn fachlich
 * ausdrücklich beschreiben. Ohne `pdd` bleibt der vom Produkt angelegte offene
 * Stand erhalten; der Seed erfindet keine Angaben für ältere Geschichten.
 */
export function expandCurrentStateDetails(
  fixture: DocumentationFixture,
  inhalt: Inhalt,
  understanding: ProcessUnderstanding,
  fallback: CurrentStateDetails,
): CurrentStateDetails {
  if (!fixture.pdd) return fallback;
  const known = <T>(value: T) => ({
    state: "known" as const,
    value,
    reason: null,
    provenance: "user_confirmed" as const,
    evidenceIds: understanding.evidence.map((item) => item.id),
    confidence: 100,
    assumptions: [],
    confirmed: true,
  });
  const systems = (understanding.systems.value ?? []).map((name, index) => ({
    id: `system-${index + 1}`,
    name,
    kind:
      name === "Outlook"
        ? ("communication" as const)
        : name === "AKTE"
          ? ("repository" as const)
          : ("application" as const),
  }));
  const painPoints = (understanding.painPoints.value ?? []).map(
    (description, index) => ({ id: `pain-${index + 1}`, description }),
  );
  const variations = inhalt.verzweigung
    ? [
        {
          id: "variation-1",
          name: inhalt.verzweigung.frage,
          kind: "flow_branch" as const,
          trigger: inhalt.verzweigung.frage,
          currentHandling: inhalt.verzweigung.zweige
            .map((branch) =>
              [branch.label, branch.ermittlung, branch.folge]
                .filter(Boolean)
                .join(": "),
            )
            .join("; "),
          affectedStepIds: [`step-${inhalt.verzweigung.nachSchritt}`],
          gatewayId: "xor-1",
        },
      ]
    : [];
  return currentStateDetailsSchema.parse({
    schemaVersion: 1,
    currentStateSummary: known(fixture.pdd.kurzbeschreibung),
    processOwner: known({
      department: fixture.fachbereich,
      role: fixture.pdd.prozesseignerRolle,
    }),
    confidentiality: known(fixture.pdd.vertraulichkeit),
    systems: known(systems),
    painPoints: known(painPoints),
    variations: known(variations),
    operationalContext: {
      operationAndSupport: known(fixture.pdd.betriebUndSupport),
      accessAndProtection: known(fixture.pdd.zugriffUndSchutz),
      monitoringAndTraceability: known(
        fixture.pdd.monitoringUndNachvollziehbarkeit,
      ),
      constraintsAndOpenQuestions: known(
        fixture.pdd.leitplankenUndOffeneFragen,
      ),
    },
  });
}

/** Der Inhaltsstand einer Fassung: Ausgangsstand plus alle Änderungen bis dahin. */
export function inhaltAt(
  fixture: DocumentationFixture,
  revision: number,
): Inhalt {
  const keys = Object.keys(inhaltSchema) as (keyof typeof inhaltSchema)[];
  const inhalt = Object.fromEntries(
    keys.map((key) => [key, fixture[key]]),
  ) as Inhalt;
  for (const eintrag of fixture.revisionen.slice(0, revision))
    for (const key of keys)
      if (eintrag.aenderung[key] !== undefined)
        (inhalt as Record<string, unknown>)[key] = eintrag.aenderung[key];
  return inhalt;
}

export async function listDocumentationFixtures() {
  const root = documentationFixtureRoot();
  const names = (await readdir(root))
    .filter((name) => name.endsWith(".json"))
    .sort();
  const fixtures: DocumentationFixture[] = [];
  for (const name of names) {
    const raw = JSON.parse(await readFile(join(root, name), "utf8"));
    const parsed = documentationFixtureSchema.safeParse(raw);
    if (!parsed.success)
      throw new Error(
        `Die Seeddatei „${name}" ist ungültig:\n${parsed.error.issues
          .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
          .join("\n")}`,
      );
    if (parsed.data.slug !== name.replace(/\.json$/, ""))
      throw new Error(
        `Die Seeddatei „${name}" trägt den abweichenden Slug „${parsed.data.slug}".`,
      );
    fixtures.push(parsed.data);
  }
  return fixtures;
}
