/**
 * Erstellt den vollständigen LifeCorp-Showcase in einem leeren Workspace:
 * zuerst die 14 bestätigten Prozesse samt Dokumentationskorpus, danach die
 * vier bewusst offenen Aufnahmezustände. Kein KI-Aufruf ist dafür nötig.
 *
 * Aufruf:
 *   bun run seed:showcase --list
 *   bun run seed:showcase
 */
import { loadShowcasePortfolio } from "./showcase-portfolio.ts";

const stateLabel = {
  confirmed: "Bestätigt",
  review_required: "Prozessbild prüfen",
  chat_in_progress: "Chat läuft",
  uploads_ready: "Uploads vorhanden",
  not_started: "Nicht begonnen",
} as const;

const depthLabel = {
  end_to_end: "End-to-End",
  detailed: "Detailliert",
  compact: "Kompakt",
} as const;

async function run(command: string[]) {
  const child = Bun.spawn(command, {
    cwd: process.cwd(),
    env: process.env,
    stdout: "inherit",
    stderr: "inherit",
  });
  const exitCode = await child.exited;
  if (exitCode !== 0)
    throw new Error(
      `Showcase-Schritt „${command.join(" ")}" endete mit Exit-Code ${exitCode}.`,
    );
}

async function list() {
  const portfolio = await loadShowcasePortfolio();
  for (const process of portfolio.processes)
    console.log(
      `${String(process.order).padStart(2)}  ${process.department.padEnd(9)} ${depthLabel[process.depth].padEnd(12)} ${stateLabel[process.targetState].padEnd(19)} ${process.title}`,
    );
}

if (process.argv.includes("--list")) await list();
else {
  await run(["bun", "run", "scripts/seed-documentation.ts"]);
  await run(["bun", "run", "scripts/seed-demo-process.ts", "--showcase"]);
}
