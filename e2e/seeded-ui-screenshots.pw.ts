import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const username = process.env.E2E_AUTH_USERNAME;
const password = process.env.E2E_AUTH_PASSWORD;
const screenshotDir = join(process.cwd(), ".local", "showcase-screenshots");
const exportDir = join(process.cwd(), ".local", "showcase-exports");

async function save(page: Page, filename: string, fullPage = true) {
  await mkdir(screenshotDir, { recursive: true });
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  });
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  expect(
    await page.evaluate(() => ({
      window: window.scrollY,
      document: document.documentElement.scrollTop,
      body: document.body.scrollTop,
    })),
    `Screenshot ${filename} must start at the top of the page`,
  ).toEqual({ window: 0, document: 0, body: 0 });
  await page.mouse.move(0, 0);
  await page.screenshot({
    path: join(screenshotDir, filename),
    fullPage,
    animations: "disabled",
  });
}

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
  });
  await page.goto("/");
  await page.getByLabel("Benutzername").fill(username!);
  await page.getByLabel("Passwort").fill(password!);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page.getByRole("heading", { name: "Prozesse" })).toBeVisible();
  const dismissWarning = page.getByRole("button", {
    name: "Hinweis dauerhaft in diesem Browser ausblenden",
  });
  await expect(dismissWarning).toBeVisible();
  await dismissWarning.click();
  await expect(dismissWarning).toHaveCount(0);
}

function expectCleanBrowser({
  consoleErrors,
  failedRequests,
}: ReturnType<typeof observeBrowserFailures>) {
  expect(failedRequests, "No browser request should fail").toEqual([]);
  expect(consoleErrors, "The seeded views should stay console-clean").toEqual(
    [],
  );
}

test("captures the deterministic German insurance showcase", async ({
  page,
}) => {
  test.skip(
    !username || !password,
    "Only the isolated local screenshot runner supplies credentials.",
  );

  const browserFailures = observeBrowserFailures(page);
  await login(page);

  const processLink = page.getByRole("link", {
    name: "Leitungswasserschaden Wohngebäude regulieren",
  });
  await expect(processLink).toBeVisible();
  await save(page, "01-prozessportfolio.png");
  const processHref = await processLink.getAttribute("href");
  expect(processHref).toMatch(/^\/processes\/PROC-\d+$/);
  await processLink.click();
  await expect(
    page.getByRole("heading", {
      name: "Leitungswasserschaden Wohngebäude regulieren",
      level: 1,
    }),
  ).toBeVisible();
  await save(page, "02-prozessdetail-leitungswasser.png");
  const pddDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Excel erstellen" }).click();
  const pddDownload = await pddDownloadPromise;
  await mkdir(exportDir, { recursive: true });
  expect(pddDownload.suggestedFilename()).toMatch(/\.xlsx$/);
  await pddDownload.saveAs(
    join(exportDir, `PDD-${pddDownload.suggestedFilename()}`),
  );

  await page.goto(`${processHref}/chat`);
  await expect(
    page.getByText(/^(Abgeschlossen|Mit offenen Punkten bestätigt)$/),
  ).toBeVisible();
  await expect(page.getByText("Schadenmeldung aufnehmen")).toBeVisible();
  await page.getByRole("button", { name: "Prozessbild erweitern" }).click();
  await expect(
    page.getByRole("button", { name: "Prozessbild verkleinern" }),
  ).toBeVisible();
  await page.locator(".react-flow__controls-fitview").click();
  await page.locator(".react-flow__controls-zoomin").click();
  await save(page, "03-prozessbild-leitungswasser.png");

  await page.goto("/dokumentation");
  await expect(
    page.getByRole("heading", { name: "Prozessdokumentation" }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Leitungswasserschaden Wohngebäude regulieren",
    })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Leitungswasserschaden Wohngebäude regulieren",
      level: 1,
    }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Index" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Katalog.json" })).toHaveCount(
    0,
  );
  await expect(page.getByText("user_confirmed", { exact: false })).toHaveCount(
    0,
  );
  await save(page, "04-prozessdokumentation.png", false);

  await page.goto(`${processHref}/opportunities/scenarios`);
  await expect(
    page.getByRole("heading", { name: "Drei Szenarien im Vergleich" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Agentischer Schaden-Arbeitsbegleiter",
    }),
  ).toBeVisible();
  await save(page, "08-ki-szenarien.png", false);

  await page.goto(`${processHref}/opportunities/agentic-assessment`);
  await expect(
    page.getByRole("heading", { name: "Ergebnisüberblick" }),
  ).toBeVisible();
  await expect(page.getByText("15 von 32")).toBeVisible();
  await save(page, "09-agentische-potenzialbewertung.png", false);
  const assessmentDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Excel erstellen" }).click();
  const assessmentDownload = await assessmentDownloadPromise;
  expect(assessmentDownload.suggestedFilename()).toMatch(/\.xlsx$/);
  await assessmentDownload.saveAs(
    join(exportDir, `Bewertung-${assessmentDownload.suggestedFilename()}`),
  );

  expectCleanBrowser(browserFailures);
});

test("captures the critical tablet review screens", async ({ page }) => {
  test.skip(
    !username || !password,
    "Only the isolated local screenshot runner supplies credentials.",
  );

  await page.setViewportSize({ width: 1024, height: 900 });
  const browserFailures = observeBrowserFailures(page);
  await login(page);

  const processLink = page.getByRole("link", {
    name: "Leitungswasserschaden Wohngebäude regulieren",
  });
  await expect(processLink).toBeVisible();
  const processHref = await processLink.getAttribute("href");
  expect(processHref).toMatch(/^\/processes\/PROC-\d+$/);
  await save(page, "05-tablet-prozessportfolio.png", false);

  await page.goto(`${processHref}/chat`);
  await expect(
    page.getByText(/^(Abgeschlossen|Mit offenen Punkten bestätigt)$/),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Prozessbild" }).click();
  await expect(page.getByText("Schadenmeldung aufnehmen")).toBeVisible();
  await page.locator(".react-flow__controls-fitview").click();
  await save(page, "06-tablet-prozessbild.png", false);

  await page.goto("/dokumentation");
  await page
    .getByRole("button", {
      name: "Leitungswasserschaden Wohngebäude regulieren",
    })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Leitungswasserschaden Wohngebäude regulieren",
      level: 1,
    }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Index" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Katalog.json" })).toHaveCount(
    0,
  );
  await save(page, "07-tablet-prozessdokumentation.png", false);

  await page.goto(`${processHref}/opportunities/scenarios`);
  await expect(
    page.getByRole("heading", { name: "Drei Szenarien im Vergleich" }),
  ).toBeVisible();
  await save(page, "10-tablet-ki-szenarien.png", false);

  await page.goto(`${processHref}/opportunities/agentic-assessment`);
  await expect(
    page.getByRole("heading", { name: "Ergebnisüberblick" }),
  ).toBeVisible();
  await save(page, "11-tablet-potenzialbewertung.png", false);

  expectCleanBrowser(browserFailures);
});
