import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const web = (...parts: string[]) =>
  join(process.cwd(), "apps", "web", "src", ...parts);

test("does not render technical process IDs in user-facing process headers", async () => {
  const [detail, capture, chat, opportunities, assessment, workspace] =
    await Promise.all(
      [
        web("pages", "process-detail-page.tsx"),
        web("pages", "process-capture-page.tsx"),
        web("pages", "process-chat-page.tsx"),
        web("pages", "opportunity-discovery-page.tsx"),
        web("pages", "agentic-potential-assessment-page.tsx"),
        web("pages", "opportunity-workspace-page.tsx"),
      ].map((path) => readFile(path, "utf8")),
    );
  expect(detail).not.toContain("{process.cover.department} · {process.id}");
  expect(capture).not.toContain("Seite 2 von 2 · {record.id}");
  expect(chat).not.toContain("{view.cover.department} · {id}");
  expect(opportunities).not.toContain(
    "{process.cover.department} · {process.id}",
  );
  expect(assessment).not.toContain("{process.cover.department} · {process.id}");
  expect(workspace).not.toContain("{process.cover.department} · {process.id}");
});

test("shows process names, not technical IDs, for learned knowledge sources", async () => {
  const source = await readFile(
    web("components", "company-knowledge-section.tsx"),
    "utf8",
  );
  expect(source).not.toContain("({source.processId})");
  expect(source).not.toContain(
    '<span className="font-semibold">{source.processId}</span>',
  );
  expect(source).toContain("Gelöschte Prozessaufnahme");
});
