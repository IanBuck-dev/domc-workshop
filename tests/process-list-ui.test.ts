import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import {
  ProcessListTable,
  ProcessListTableSkeleton,
} from "../apps/web/src/components/process-list-table.tsx";
import { ProcessListPage } from "../apps/web/src/pages/process-list-page.tsx";
import type { ProcessCaptureRecord } from "../apps/web/src/lib/process-types.ts";

const record = {
  id: "PROC-0007",
  state: "capture_in_progress",
  profile: { version: 2 },
  cover: { processName: "Mahnverfahren", department: "Inkasso" },
  mainAnswers: [],
  workCharacteristicAnswers: [],
  selectedUploadIds: [],
} as unknown as ProcessCaptureRecord;

describe("process list UI", () => {
  test("renders the rich table controls, status and detail link", () => {
    const markup = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        null,
        createElement(ProcessListTable, {
          records: [record],
          opportunities: [],
          header: createElement("h1", null, "Prozesse"),
        }),
      ),
    );

    expect(markup).toContain("Prozesse durchsuchen");
    expect(markup).toContain("Fachbereich");
    expect(markup).toContain("Status");
    expect(markup).toContain("Entwurf");
    expect(markup).toContain('href="/processes/PROC-0007"');
  });

  test("renders a skeleton with the process list layout while loading", () => {
    const markup = renderToStaticMarkup(
      createElement(ProcessListTableSkeleton, {
        header: createElement("h1", null, "Prozesse"),
      }),
    );

    expect(markup).toContain('role="status"');
    expect(markup).toContain('aria-label="Prozessliste wird geladen"');
    expect(markup).toContain("Prozesse");
    expect(markup.match(/data-slot="skeleton"/g)).toHaveLength(27);
  });

  test("keeps the process heading visible while the list is loading", () => {
    const markup = renderToStaticMarkup(
      createElement(MemoryRouter, null, createElement(ProcessListPage)),
    );

    expect(markup).toContain(">Prozesse</h1>");
    expect(markup).toContain('aria-label="Prozessliste wird geladen"');
  });
});
