import { readFile } from "node:fs/promises";
import { expect, test, type Download, type Page } from "@playwright/test";
import { unzipSync } from "fflate";

const username = process.env.E2E_AUTH_USERNAME;
const password = process.env.E2E_AUTH_PASSWORD;

const journeys = [
  ["FIN-03 · Nicht zuordenbare Zahlungseingänge klären", 85],
  ["VER-01 · Turnusmäßige Beitragsanpassung Wohngebäude", 79],
  ["SCH-01 · Leitungswasserschaden Wohngebäude regulieren", 72],
  ["VTR-01 · Onboarding neuer Vermittler im Außendienst", 58],
  [
    "IT-02 · SAP S/4HANA per API für agentischen Zahlungsabgleich in KOMPASS anbinden",
    46,
  ],
  ["FIN-02 · Mahnverfahren im Direktinkasso Leben durchführen", 28],
] as const;

function observeBrowserFailures(page: Page) {
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("requestfailed", (request) => {
    failedRequests.push(
      `${request.method()} ${request.url()}: ${request.failure()?.errorText}`,
    );
  });
  return { consoleErrors, failedRequests };
}

async function login(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("claims-ai.chat-tutorial.completed.v1", "1");
    localStorage.setItem("claims-ai.demo-data-warning.dismissed.v1", "1");
  });
  await page.goto("/");
  await page.getByLabel("Benutzername").fill(username!);
  await page.getByLabel("Passwort").fill(password!);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page.getByRole("heading", { name: "Prozesse" })).toBeVisible();
}

async function expectValidAssessmentWorkbook(
  download: Download,
  processName: string,
) {
  const path = await download.path();
  expect(path).not.toBeNull();
  const workbook = unzipSync(new Uint8Array(await readFile(path!)));
  const decoder = new TextDecoder();
  const workbookXml = decoder.decode(workbook["xl/workbook.xml"]!);
  const sheetIds = [
    ...workbookXml.matchAll(/<sheet\b[^>]*\bsheetId="(\d+)"/g),
  ].map((match) => match[1]);
  expect(new Set(sheetIds).size).toBe(sheetIds.length);

  const assessmentSheet = decoder.decode(workbook["xl/worksheets/sheet1.xml"]!);
  expect(assessmentSheet).toContain(processName);
  expect(assessmentSheet).toContain("Agentische Potenzialbewertung");
  expect(assessmentSheet.indexOf("<autoFilter")).toBeLessThan(
    assessmentSheet.indexOf("<mergeCells"),
  );
  expect(
    Object.entries(workbook)
      .filter(([name]) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
      .map(([, value]) => decoder.decode(value))
      .join("\n"),
  ).not.toMatch(/PROC-\d{4}/);
}

async function expectTechnicalIdFreeWorkbook(download: Download) {
  const path = await download.path();
  expect(path).not.toBeNull();
  const workbook = unzipSync(new Uint8Array(await readFile(path!)));
  const decoder = new TextDecoder();
  expect(
    Object.entries(workbook)
      .filter(([name]) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
      .map(([, value]) => decoder.decode(value))
      .join("\n"),
  ).not.toMatch(/PROC-\d{4}/);
}

test("all six deterministic LifeCorp journeys reach both Excel exports", async ({
  page,
}) => {
  test.skip(
    !username || !password,
    "Only the isolated local E2E runner supplies credentials.",
  );
  const failures = observeBrowserFailures(page);
  await login(page);

  const processResponse = await page.request.get("/api/processes");
  expect(processResponse.ok()).toBeTruthy();
  const processes = (await processResponse.json()) as Array<{
    id: string;
    cover: { processName: string };
    uploads: unknown[];
  }>;
  const assessmentResponse = await page.request.get("/api/agentic-assessments");
  expect(assessmentResponse.ok()).toBeTruthy();
  const assessments = (await assessmentResponse.json()) as Array<{
    processId: string;
    score: { value: number } | null;
  }>;
  expect(assessments).toHaveLength(6);

  for (const [title, expectedScore] of journeys) {
    const businessCode = title.split(" · ")[0]!;
    const process = processes.find((item) => item.cover.processName === title);
    expect(process, `Seeded process ${title}`).toBeTruthy();
    expect(
      assessments.find((item) => item.processId === process!.id)?.score?.value,
    ).toBe(expectedScore);

    await page.goto("/");
    const row = page.getByRole("row").filter({ hasText: title });
    await expect(row).toBeVisible();
    await expect(
      row.getByText(String(expectedScore), { exact: true }),
    ).toBeVisible();

    await page.goto(`/processes/${process!.id}`);
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/PROC-\d{4}/);
    const pddDownloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Excel erstellen" }).click();
    const pddDownload = await pddDownloadPromise;
    expect(pddDownload.suggestedFilename()).toMatch(/\.xlsx$/i);
    expect(pddDownload.suggestedFilename()).not.toMatch(/PROC-\d{4}/);
    expect(pddDownload.suggestedFilename()).toContain(`${businessCode}_`);
    await expectTechnicalIdFreeWorkbook(pddDownload);

    await page.goto(`/processes/${process!.id}/chat`);
    await expect(
      page.getByText(/^(Abgeschlossen|Mit offenen Punkten bestätigt)$/),
    ).toBeVisible();
    await expect(
      page.getByRole("note").getByText("Wie erfassen Sie den Prozess richtig?"),
    ).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/PROC-\d{4}/);
    const chatResponse = await page.request.get(
      `/api/processes/${process!.id}/chat`,
    );
    expect(chatResponse.ok()).toBeTruthy();
    const chat = (await chatResponse.json()) as {
      transcript: Array<{
        role: "user" | "assistant";
        action: string;
        text: string;
      }>;
    };
    expect(
      chat.transcript.filter((event) => event.role === "user").length,
    ).toBeGreaterThanOrEqual(5);
    expect(
      chat.transcript.filter((event) => event.role === "assistant").length,
    ).toBeGreaterThan(
      chat.transcript.filter((event) => event.role === "user").length,
    );
    if (title.startsWith("FIN-03")) {
      const stepMessages = chat.transcript.filter(
        (event) =>
          event.role === "assistant" &&
          event.action === "message" &&
          event.text.includes("**Schritt "),
      );
      expect(stepMessages).toHaveLength(7);
      stepMessages.forEach((event, index) => {
        expect(event.text).toContain(`**Schritt ${index + 1} von 7`);
        expect(event.text).toContain("**Bereits verstanden**");
        expect(event.text).toContain("**Noch offen**");
      });
    }

    await page.goto(`/processes/${process!.id}/opportunities/scenarios`);
    await expect(
      page.getByRole("heading", { name: "Drei Szenarien im Vergleich" }),
    ).toBeVisible();
    await expect(page.getByText("Assistiert", { exact: true })).toBeVisible();
    await expect(page.getByText("Teilautonom", { exact: true })).toBeVisible();
    await expect(page.getByText("Agentisch", { exact: true })).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/PROC-\d{4}/);

    await page.goto(
      `/processes/${process!.id}/opportunities/agentic-assessment`,
    );
    await expect(
      page.getByRole("heading", { name: "Ergebnisüberblick" }),
    ).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/PROC-\d{4}/);
    const assessmentDownloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Excel erstellen" }).click();
    const assessmentDownload = await assessmentDownloadPromise;
    expect(assessmentDownload.suggestedFilename()).toMatch(/\.xlsx$/i);
    expect(assessmentDownload.suggestedFilename()).not.toMatch(/PROC-\d{4}/);
    expect(assessmentDownload.suggestedFilename()).toContain(
      `${businessCode}_`,
    );
    await expectValidAssessmentWorkbook(assessmentDownload, title);
  }

  expect(failures.failedRequests, "No browser request should fail").toEqual([]);
  expect(
    failures.consoleErrors,
    "No browser console error should occur",
  ).toEqual([]);
});
