export const sessionFacts = {
  id: "019f4e3c-40e8-7f00-9f42-8c984f48dd40",
  model: "GPT-5.6 Sol",
  effort: "Medium",
  startedAt: "10.07.2026, 22:53:19",
  cutoffAt: "10.07.2026, 23:58:10",
  elapsed: "1 Std. 4 Min. 51 Sek.",
  inputTokens: 10_837_199,
  cachedInputTokens: 10_430_720,
  uncachedInputTokens: 406_479,
  outputTokens: 61_669,
  reasoningTokens: 6_878,
  totalTokens: 10_898_868,
  estimatedUsd: 9.1,
  pricing: {
    input: 5,
    cachedInput: 0.5,
    output: 30,
    source: "https://openai.com/index/gpt-5-6/",
  },
};

export const userPrompts = [
  {
    title: "Ausgangspunkt und Zielbild",
    text: `In /Repos create a new folder. I want to create a prototype for my father who is a non software engineer but head of claims at a medium sized insurance company.

Goal: show an ai native solution/prototype for the following problem: he wants to have a system where you can input project ideas in unstructured format and he wants an ai agent to ingest those ideas, potentially ask back for clarification, filter out none AI topics, score and prio the projects, and then have a handover ready list for their IT departement.

Something like: use AI for our claims notifications pipeline, use AI to analyse our current claim numbers etc.

I gotta say, I was not quite sure about the whole filtering out non ai topics and why their IT department couldn't score these project requests themselves but I want to build this system.

Was thinking file system based with codex/claude cli on demand with very basic react tailwind websites for form input for project ideas, overview page with list and details page to manage the project ideas manually and get the list of projects ordered by their importance.

Should be super simple to run for non technical users with detailed docs and instructions for agents. Assume an authenticated claude cli (I guess that's what they use the most).

Create the folder + plan, then we dive deeper into the planning.`,
  },
  {
    title: "Design, Technik und deutsche Versicherungs-IT",
    text: `Switched the directory to the new folder. Most can be a Claude instruction file with exact expectations, priority requirements, a normal filesystem folder structure and Markdown files to store project ideas (raw + derived). Single executable if possible for Mac or Windows.

Assume the IT department of a German insurance company. Fresh-looking Tailwind based on DOMCURA branding. Developer-friendly setup for quick iterations, rough prototype, verification via Chrome DevTools.

Add a color-based priority scale from 1–5 and a separate impact/effort matrix from 1–10 per axis. Make the prototype easily editable for workshops with a reset option. Let users choose the latest Claude CLI model and reasoning; default to Opus 4.8 medium.`,
  },
  {
    title: "Datenschutz und zwölf Demo-Projekte",
    text: `Very good on data security; add a small warning. They will use demo data. Seed realistic projects with different priority and impact/effort values.

Use the researched portfolio covering KIM automated claims processing, KIM partner rollout, AI governance and audit, incoming-mail triage, catastrophe claims, broker copilot, underwriting document checks, customer communications, fraud/anomaly detection, internal knowledge, ticket summaries and an intentionally unattractive insurance foundation model. Add PUBLIC, INFERRED and FICTIONAL evidence levels.`,
  },
  {
    title: "Umfang der Demo-Daten",
    text: "Let's add all those projects; if it's too much, we'll remove later.",
  },
  {
    title: "Autonome Ausarbeitung",
    text: "Nice. Anything missing in the plan high level? The rest should be filled in autonomously by the agent.",
  },
  {
    title: "Browsersteuerung",
    text: "Did you verify browser access/remote controll is working?",
  },
  {
    title: "Chrome DevTools MCP",
    text: "Also via Chrome DevTools MCP?",
  },
  {
    title: "Erster Umsetzungsauftrag",
    text: `/goal Implement the '/Users/personaldev/Repos/claims-ai-portfolio/docs/PLAN.md' end to end and verify everything is working.`,
  },
  {
    title: "Token-effiziente Toolchain",
    text: `Use Chrome DevTools for verification. Do one last pass on the tool setup: keep token efficiency high. In /Repos/agent-manager I use vg-bun-build and related wrappers to significantly reduce token waste. Check what makes sense here.`,
  },
  {
    title: "Umsetzung",
    text: `/goal Implement '/Users/personaldev/Repos/claims-ai-portfolio/docs/PLAN.md' end to end and make sure the whole app is working. Check styling and usability with the german insurance focus via screenshots`,
  },
  {
    title: "Reale Claude-Verifikation",
    text: `For the Claude integration, use the real Claude CLI on this computer but keep usage down and use low reasoning effort for one example. Update that in the plan.`,
  },
];

export const researchPrompt = {
  model: "GPT-5.6 Sol",
  effort: "Extra high",
  capability: "Online-Recherche",
  text: `Hat https://www.domcura.de/ aktuell eine Roadmap, Quartals- oder Jahresberichte über aktuelle IT-Projekte? Ich baue eine Demo-App und möchte einige Beispielprojekte für die IT-Abteilung der Versicherung erstellen – mit unterschiedlichem Impact und Effort (jeweils 1–10), Priorität (1–5) und KI-Fokus. Trenne öffentlich bestätigte Projekte, aus öffentlichen Angaben abgeleitete Initiativen und realistische fiktive Demo-Beispiele. Nenne für öffentliche Aussagen die Quellen und erfinde keine Projekt-Roadmap.`,
  response: `Ergebnis: Eine öffentlich zugängliche, projektgenaue IT-Roadmap von DOMCURA wurde nicht gefunden. Öffentlich erkennbar sind Investitionen in Software und KI-basierte Bearbeitungsstrecken sowie KIM, die KI-gestützte Schadenbearbeitung. Daraus entstand ein Demo-Portfolio mit zwölf Projekten. KIM und der Partner-Rollout sind öffentlich belegt, das Governance-Cockpit ist aus öffentlichen Aussagen abgeleitet; neun weitere Ideen sind ausdrücklich als fiktive Workshop-Beispiele gekennzeichnet.`,
};

export const finalResponses = [
  {
    title: "Plan und effiziente Agenten-Toolchain",
    text: `I inspected the agent-manager wrappers. The useful ideas are: redirect noisy command output to local log files, print one-line success summaries with elapsed time, return only actionable diagnostics on failure, use machine-readable test output, run focused checks during iteration, and preserve full logs locally. The plan and agent instructions were updated with ./scripts/qa changed, test, all and release. Chrome verification uses accessibility snapshots, milestone screenshots and filtered console/network errors.`,
  },
  {
    title: "Umsetzungsergebnis",
    text: `Implemented the prototype end to end: six German workshop views, twelve seeded projects with provenance, Markdown/YAML storage and audit history, intake, clarification, scoring, overrides, lifecycle management, the impact/effort matrix, IT handover, bounded Claude CLI integration, demo-data warnings, reset and backups, operator documentation, and macOS/Windows x64 release ZIPs. Formatting, lint, strict type checking, tests and production build passed; desktop and tablet workflows were verified via Chrome DevTools.`,
  },
  {
    title: "Verifikation",
    text: `Improved release packaging: the macOS ZIP now preserves executable permissions and launches after extraction without chmod. Revalidated successfully: formatting, linting, type checking, tests and build; both release ZIPs; clean macOS extraction, launch, health check and workspace seeding. The sole remaining plan requirement was testing the Windows ZIP on real Windows x64 hardware.`,
  },
  {
    title: "Letzter Stand vor dieser Seite",
    text: `Blocked only on the explicit real Windows x64 runtime test. The Windows artifact is built and ZIP-validated, but completing the original plan required access to an actual Windows machine with Claude Code authenticated. This Windows check is now explicitly deferred for the workshop.`,
  },
];
