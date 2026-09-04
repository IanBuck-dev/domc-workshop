import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

test("review page offers deterministic inspection and export", async () => {
  const page = await readFile(
    "apps/web/src/pages/agentic-potential-assessment-page.tsx",
    "utf8",
  );
  expect(page).toContain("Bewertung erstellen");
  expect(page).toContain("Excel erstellen");
  expect(page).toContain("Nicht ausreichend belegt");
});

test("opportunity navigation keeps shared data and header mounted", async () => {
  const [app, workspace, context, discovery, assessment] = await Promise.all(
    [
      "apps/web/src/app.tsx",
      "apps/web/src/pages/opportunity-workspace-page.tsx",
      "apps/web/src/lib/opportunity-workspace.ts",
      "apps/web/src/pages/opportunity-discovery-page.tsx",
      "apps/web/src/pages/agentic-potential-assessment-page.tsx",
    ].map((path) => readFile(path, "utf8")),
  );

  expect(app).toContain("element={<OpportunityWorkspacePage />}");
  expect(workspace).toContain("<Outlet");
  expect(workspace).toContain("api.process(id)");
  expect(workspace).toContain("api.opportunity(id)");
  expect(workspace).toContain("api.agenticAssessment(id)");
  expect(context).toContain("useOutletContext<OpportunityWorkspaceContext>()");
  expect(discovery).toContain("useOpportunityWorkspace()");
  expect(assessment).toContain("useOpportunityWorkspace()");
  expect(discovery).not.toContain("OpportunityDiscoveryPageSkeleton");
  expect(assessment).not.toContain("AssessmentPageSkeleton");
  expect(workspace).not.toContain("Bewertetes Szenario:");
});

test("assessment criteria use a compact expandable table with filters", async () => {
  const table = await readFile(
    "apps/web/src/components/agentic-potential-assessment-table.tsx",
    "utf8",
  );

  expect(table).toContain("<table");
  expect(table).toContain("#");
  expect(table).toContain("Kriterium");
  expect(table).toContain("Wert");
  expect(table).toContain("definition?.order");
  expect(table).toContain("aria-expanded={isOpen}");
  expect(table).toContain("aria-controls={detailId}");
  expect(table).toContain("id={detailId}");
  expect(table).toContain("colSpan={4}");
  expect(table).toContain("score} von 2");
  expect(table).toContain("Nicht ausreichend belegt");
  expect(table).toContain("Ausgeschlossen");
  expect(table).toContain("setFilter(item.key)");
  expect(table).toContain("setOpenCriterionIds");
  expect(table).toContain("onCriterionKeyDown");
  expect(table).toContain("Begründung");
  expect(table).toContain("Belege aus dem Prozessbild");
  expect(table).toContain("Zugrunde liegende Potenziale");
  expect(table).toContain("Offene Punkte für den Fachbereich");
});
