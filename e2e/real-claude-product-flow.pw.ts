import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

type Script = { zuege: { nummer: number; antwort: string }[] };

const username = process.env.E2E_AUTH_USERNAME;
const password = process.env.E2E_AUTH_PASSWORD;

async function waitForClaudeTurn(page: Page) {
  await expect(
    page.getByPlaceholder("Antwort oder Korrektur beschreiben …"),
  ).toBeEnabled({
    timeout: 6 * 60_000,
  });
  await expect(page.getByRole("button", { name: "Senden" })).toBeVisible({
    timeout: 6 * 60_000,
  });
}

async function sendTurn(page: Page, text: string) {
  const composer = page.getByPlaceholder(
    "Antwort oder Korrektur beschreiben …",
  );
  await composer.fill(text);
  await page.getByRole("button", { name: "Senden" }).click();
  await waitForClaudeTurn(page);
}

test("real Claude product flow creates both Excel artifacts", async ({
  page,
}) => {
  test.skip(
    !username || !password,
    "Only the isolated local E2E runner supplies credentials.",
  );

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

  await page.addInitScript(() => {
    localStorage.setItem("claims-ai.chat-tutorial.completed.v1", "1");
  });
  await page.goto("/");
  await page.getByLabel("Benutzername").fill(username!);
  await page.getByLabel("Passwort").fill(password!);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page.getByRole("heading", { name: "Prozesse" })).toBeVisible();

  await page
    .getByRole("link", { name: "Leitungswasserschaden Wohngebäude regulieren" })
    .click();
  await page.getByRole("link", { name: /Fortsetzen/ }).click();
  await expect(
    page.getByRole("heading", {
      name: "Leitungswasserschaden Wohngebäude regulieren",
    }),
  ).toBeVisible();

  const processMatch = page.url().match(/\/processes\/(PROC-\d+)\/chat/);
  expect(
    processMatch,
    "The chat URL contains the seeded process id",
  ).not.toBeNull();
  const processId = processMatch![1]!;

  await page.getByRole("button", { name: "Unterlagen auswerten" }).click();
  await waitForClaudeTurn(page);
  if (process.env.E2E_PHASE === "documents") return;

  const script = JSON.parse(
    await readFile(
      join(
        process.cwd(),
        "demo-data/szenarien/leitungswasserschaden-wohngebaeude/drehbuch.json",
      ),
      "utf8",
    ),
  ) as Script;
  const confirm = page.getByRole("button", {
    name: /^(Prozessbild bestätigen|Bestätigen)$/,
  });
  for (const turn of script.zuege) {
    await sendTurn(page, turn.antwort);
    if (await confirm.isEnabled()) break;
  }
  await expect(
    confirm,
    "The scripted conversation must reach a confirmable understanding",
  ).toBeEnabled();
  await confirm.click();
  const override = page.getByRole("button", { name: "Trotzdem bestätigen" });
  const confirmedMilestone = page.getByText("Prozess bestätigt", {
    exact: true,
  });
  await expect(override.or(confirmedMilestone)).toBeVisible({
    timeout: 5 * 60_000,
  });
  if (await override.isVisible()) await override.click();
  await expect(confirmedMilestone).toBeVisible({
    timeout: 5 * 60_000,
  });

  await page.goto(`/processes/${processId}`);
  await expect(page.getByRole("heading", { name: "PDD-Export" })).toBeVisible();
  const pddDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /Excel erstellen/ }).click();
  const pddDownload = await pddDownloadPromise;
  expect(pddDownload.suggestedFilename()).toMatch(/\.xlsx$/i);

  await page.getByRole("button", { name: /Starten/ }).click();
  await expect(page.getByRole("link", { name: "KI-Szenarien" })).toBeVisible({
    timeout: 8 * 60_000,
  });
  await page.getByRole("link", { name: "KI-Szenarien" }).click();
  await expect(
    page.getByRole("link", { name: "Bewertung öffnen" }),
  ).toBeVisible({
    timeout: 8 * 60_000,
  });
  await page.getByRole("link", { name: "Bewertung öffnen" }).click();

  await page.getByRole("button", { name: "Bewertung erstellen" }).click();
  await expect(
    page.getByRole("heading", { name: "Ergebnisüberblick" }),
  ).toBeVisible({
    timeout: 8 * 60_000,
  });
  const assessmentDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Excel erstellen" }).click();
  const assessmentDownload = await assessmentDownloadPromise;
  expect(assessmentDownload.suggestedFilename()).toMatch(/\.xlsx$/i);

  expect(failedRequests, "No browser request should fail").toEqual([]);
  expect(
    consoleErrors,
    "The complete flow should not emit browser console errors",
  ).toEqual([]);
});
