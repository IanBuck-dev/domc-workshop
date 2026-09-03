import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";

const showcaseProcessSchema = z
  .object({
    order: z.number().int().min(1),
    slug: z.string().regex(/^[a-z0-9-]+$/),
    title: z.string().trim().min(1).max(240),
    department: z.enum(["Schaden", "Vertrag", "Vertrieb", "Finanzen", "IT"]),
    owningTeam: z.string().trim().min(1).max(240),
    depth: z.enum(["end_to_end", "detailed", "compact"]),
    targetState: z.enum([
      "confirmed",
      "review_required",
      "chat_in_progress",
      "uploads_ready",
      "not_started",
    ]),
    steps: z.number().int().min(5).max(8),
    potential: z.enum(["high", "medium", "low"]),
    fixtureSource: z.enum(["documentation", "scenario"]),
  })
  .strict();

export const showcasePortfolioSchema = z
  .object({
    schemaVersion: z.literal(1),
    processes: z.array(showcaseProcessSchema).length(18),
  })
  .strict()
  .superRefine((portfolio, ctx) => {
    const unique = (values: unknown[]) =>
      new Set(values).size === values.length;
    if (!unique(portfolio.processes.map((process) => process.order)))
      ctx.addIssue({
        code: "custom",
        path: ["processes"],
        message: "Reihenfolgen müssen eindeutig sein.",
      });
    if (!unique(portfolio.processes.map((process) => process.slug)))
      ctx.addIssue({
        code: "custom",
        path: ["processes"],
        message: "Slugs müssen eindeutig sein.",
      });
    if (!unique(portfolio.processes.map((process) => process.title)))
      ctx.addIssue({
        code: "custom",
        path: ["processes"],
        message: "Titel müssen eindeutig sein.",
      });
    const expected = portfolio.processes.map((_, index) => index + 1);
    const actual = portfolio.processes
      .map((process) => process.order)
      .sort((a, b) => a - b);
    if (JSON.stringify(actual) !== JSON.stringify(expected))
      ctx.addIssue({
        code: "custom",
        path: ["processes"],
        message: "Reihenfolgen müssen lückenlos bei 1 beginnen.",
      });
  });

export type ShowcaseProcess = z.infer<typeof showcaseProcessSchema>;

export async function loadShowcasePortfolio() {
  const path = join(process.cwd(), "demo-data", "showcase.json");
  return showcasePortfolioSchema.parse(
    JSON.parse(await readFile(path, "utf8")),
  );
}
