import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import {
  demoDrehbuchSchema,
  demoSzenarioSchema,
  type DemoSzenario,
} from "../apps/server/src/demo-scenarios.ts";
import {
  processUnderstandingSchema,
  validateProcessFlow,
  type ProcessUnderstanding,
} from "../packages/domain/src/process-understanding.ts";
import { processConfig } from "./process-fixtures.ts";

const szenarienRoot = join(process.cwd(), "demo-data", "szenarien");

async function scenarioSlugs(): Promise<string[]> {
  const entries = await readdir(szenarienRoot, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8"));
}

describe("demo-data scenarios", () => {
  test("has at least three scenarios", async () => {
    const slugs = await scenarioSlugs();
    expect(slugs.length).toBeGreaterThanOrEqual(3);
  });

  test("every szenario.json parses against the shared schema and matches its folder name", async () => {
    const slugs = await scenarioSlugs();
    for (const slug of slugs) {
      const raw = await readJson(join(szenarienRoot, slug, "szenario.json"));
      const szenario = demoSzenarioSchema.parse(raw);
      expect(szenario.slug).toBe(slug);
    }
  });

  test("every drehbuch.json parses against the shared schema with gapless, ascending zuege starting at 1", async () => {
    const slugs = await scenarioSlugs();
    for (const slug of slugs) {
      const raw = await readJson(join(szenarienRoot, slug, "drehbuch.json"));
      const drehbuch = demoDrehbuchSchema.parse(raw);
      const nummern = drehbuch.zuege.map((zug) => zug.nummer);
      expect(nummern).toEqual(
        Array.from({ length: nummern.length }, (_, index) => index + 1),
      );
    }
  });

  test("dokumente reference existing files, have unique zielnamen, and stay within the five-document limit", async () => {
    const slugs = await scenarioSlugs();
    for (const slug of slugs) {
      const szenario = demoSzenarioSchema.parse(
        await readJson(join(szenarienRoot, slug, "szenario.json")),
      );
      expect(szenario.dokumente.length).toBeLessThanOrEqual(5);

      const zielnamen = szenario.dokumente.map((dokument) => dokument.zielname);
      expect(new Set(zielnamen).size).toBe(zielnamen.length);

      for (const dokument of szenario.dokumente) {
        const quellPath = join(szenarienRoot, slug, dokument.quelle);
        expect(existsSync(quellPath)).toBe(true);
      }
    }
  });

  test("cover.department is one of the configured departments", async () => {
    const config = await processConfig();
    const slugs = await scenarioSlugs();
    for (const slug of slugs) {
      const szenario = demoSzenarioSchema.parse(
        await readJson(join(szenarienRoot, slug, "szenario.json")),
      );
      expect(config.departments).toContain(szenario.cover.department);
    }
  });

  test("cover.participantEmail uses the reserved lifecorp.example domain", async () => {
    const slugs = await scenarioSlugs();
    for (const slug of slugs) {
      const szenario = demoSzenarioSchema.parse(
        await readJson(join(szenarienRoot, slug, "szenario.json")),
      );
      expect(
        szenario.cover.participantEmail.endsWith("@lifecorp.example"),
      ).toBe(true);
    }
  });

  test("every scenario has a non-trivial DREHBUCH.md", async () => {
    const slugs = await scenarioSlugs();
    for (const slug of slugs) {
      const path = join(szenarienRoot, slug, "DREHBUCH.md");
      expect(existsSync(path)).toBe(true);
      const content = await readFile(path, "utf8");
      expect(content.trim().length).toBeGreaterThan(500);
    }
  });

  test("formular topic and work characteristic IDs exist in the process capture config with valid option IDs", async () => {
    const config = await processConfig();
    const topicIds: Set<string> = new Set(
      config.topics.map((topic) => topic.id),
    );
    const characteristicsById: Map<
      string,
      (typeof config.workCharacteristics)[number]
    > = new Map(
      config.workCharacteristics.map((characteristic) => [
        characteristic.id,
        characteristic,
      ]),
    );

    const slugs = await scenarioSlugs();
    for (const slug of slugs) {
      const szenario: DemoSzenario = demoSzenarioSchema.parse(
        await readJson(join(szenarienRoot, slug, "szenario.json")),
      );
      if (!szenario.formular) continue;

      for (const topicId of Object.keys(szenario.formular.antworten)) {
        expect(topicIds.has(topicId)).toBe(true);
      }

      for (const [characteristicId, selectedOptionIds] of Object.entries(
        szenario.formular.arbeitsmerkmale,
      )) {
        const characteristic = characteristicsById.get(characteristicId);
        expect(characteristic).toBeDefined();
        const validOptionIds = new Set(
          (characteristic?.options ?? []).map((option) => option.id),
        );
        for (const optionId of selectedOptionIds) {
          expect(validOptionIds.has(optionId)).toBe(true);
        }
      }
    }
  });

  test("verstaendnis.json, where present, parses against the process understanding schema", async () => {
    const slugs = await scenarioSlugs();
    for (const slug of slugs) {
      const path = join(szenarienRoot, slug, "verstaendnis.json");
      if (!existsSync(path)) continue;
      const raw = await readJson(path);
      expect(() => processUnderstandingSchema.parse(raw)).not.toThrow();
    }
  });

  // Lädt alle vorhandenen verstaendnis.json als geparste V3-Verständnisse.
  async function demoUnderstandings(): Promise<
    { slug: string; understanding: ProcessUnderstanding }[]
  > {
    const slugs = await scenarioSlugs();
    const result: { slug: string; understanding: ProcessUnderstanding }[] = [];
    for (const slug of slugs) {
      const path = join(szenarienRoot, slug, "verstaendnis.json");
      if (!existsSync(path)) continue;
      result.push({
        slug,
        understanding: processUnderstandingSchema.parse(await readJson(path)),
      });
    }
    return result;
  }

  test("every demo flow passes validateProcessFlow without issues", async () => {
    const understandings = await demoUnderstandings();
    expect(understandings.length).toBeGreaterThanOrEqual(1);
    for (const { slug, understanding } of understandings) {
      const issues = validateProcessFlow(
        understanding.flow,
        understanding.steps,
      );
      expect({ slug, issues }).toEqual({ slug, issues: [] });
    }
  });

  // Schutzregel aus der Spec (§9): Die Demo muss eine echte Verzweigung samt
  // Rücksprung erzählen. Mindestens ein Demo-Verständnis braucht ein Gateway
  // mit mindestens zwei Ausgängen und eine Kante auf einen Schritt mit
  // kleinerer order — sonst verschwindet die Demoanforderung unbemerkt.
  test("at least one demo flow has an XOR gateway and a jump back to an earlier step", async () => {
    const understandings = await demoUnderstandings();
    const hasBranchAndJumpBack = understandings.some(({ understanding }) => {
      const { nodes, edges } = understanding.flow;
      const orderByNodeId = new Map<string, number>();
      for (const node of nodes) {
        if (node.kind !== "step") continue;
        const step = understanding.steps.find(
          (candidate) => candidate.id === node.stepId,
        );
        if (step) orderByNodeId.set(node.id, step.order);
      }

      const hasGatewayWithTwoExits = nodes.some(
        (node) =>
          node.kind === "gateway" &&
          edges.filter((edge) => edge.source === node.id).length >= 2,
      );
      const hasJumpBack = edges.some((edge) => {
        const sourceOrder = orderByNodeId.get(edge.source);
        const targetOrder = orderByNodeId.get(edge.target);
        return (
          sourceOrder !== undefined &&
          targetOrder !== undefined &&
          targetOrder < sourceOrder
        );
      });
      return hasGatewayWithTwoExits && hasJumpBack;
    });
    expect(hasBranchAndJumpBack).toBe(true);
  });
});
