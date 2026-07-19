import {
  Output,
  generateText,
  streamText,
  type StreamTextResult,
  type ToolSet,
} from "ai";
import {
  claudeCode,
  type ClaudeCodeSettings,
} from "ai-sdk-provider-claude-code";
import {
  discoveryTurnSchema,
  type DiscoveryTurn,
  type ProcessRecord,
  type Workshop,
} from "../../domain/src/schemas.ts";
import { interviewBudget } from "../../domain/src/discovery.ts";

function budgetInstructions(record: ProcessRecord, maxQuestions: number) {
  const budget = interviewBudget(record.transcript, maxQuestions);
  const status = `Bisher gestellte Fragen: ${budget.questionsAsked} von maximal ${maxQuestions}.`;
  if (budget.phase === "complete")
    return `${status} Das Fragenbudget ist ausgeschöpft. Stelle keine weitere Frage und verwende kein Fragezeichen. Bedanke dich knapp, halte wesentliche offene Punkte fest und erkläre die fachliche Erstaufnahme für beendet.`;
  if (budget.phase === "final-confirmation")
    return `${status} Dies ist die letzte zulässige Frage. Fasse den fachlichen Ablauf knapp in Alltagssprache zusammen und bitte ausschließlich um Bestätigung oder eine wichtige Korrektur.`;
  return `${status} Es bleiben einschließlich dieser Antwort ${budget.remainingQuestions} Fragen. Stelle höchstens eine fachliche Frage zum groben Ist-Ablauf und keine Frage zur technischen Machbarkeit.`;
}

function isolatedModel(model: string, effort: Workshop["effort"], cwd: string) {
  return claudeCode(model, {
    systemPrompt:
      "Du verarbeitest ausschließlich die übergebenen Prozessdaten. Antworte auf Deutsch und erfinde keine Fakten.",
    cwd,
    effort,
    maxTurns: 2,
    tools: [],
    allowedTools: [],
    disallowedTools: [
      "Read",
      "Glob",
      "Bash",
      "Write",
      "Edit",
      "WebFetch",
      "WebSearch",
      "Task",
    ],
    settingSources: [],
    persistSession: false,
    promptSuggestions: false,
    maxBudgetUsd: 1,
  });
}

export function discoveryModelSettings(
  record: ProcessRecord,
  instructions: string,
  processDir: string,
): ClaudeCodeSettings {
  return {
    systemPrompt: instructions,
    cwd: processDir,
    effort: record.metadata.effort,
    maxTurns: 6,
    sessionId: record.metadata.sessionStarted
      ? undefined
      : record.metadata.sessionId,
    resume: record.metadata.sessionStarted
      ? record.metadata.sessionId
      : undefined,
    tools: ["Read", "Glob", "Bash"],
    allowedTools: ["Read", "Glob", "Bash"],
    disallowedTools: [
      "Write",
      "Edit",
      "WebFetch",
      "WebSearch",
      "Task",
      "NotebookEdit",
    ],
    permissionMode: "bypassPermissions",
    allowDangerouslySkipPermissions: true,
    settingSources: [],
    promptSuggestions: false,
    maxBudgetUsd: 1,
  };
}

export class DiscoveryClaudeAdapter {
  startTurn(
    record: ProcessRecord,
    userText: string,
    instructions: string,
    settings: Workshop,
    processDir: string,
  ): StreamTextResult<ToolSet, never, never> {
    const instructionsWithBudget = `${instructions}\n\n## Aktuelles Fragenbudget\n\n${budgetInstructions(record, settings.discovery.maxQuestions)}`;
    const model = claudeCode(
      record.metadata.model,
      discoveryModelSettings(record, instructionsWithBudget, processDir),
    );
    return streamText({
      model,
      prompt: `Aktueller bestätigter Stand:\n${JSON.stringify(record.extraction)}\n\nNeue Nachricht:\n${userText}`,
      abortSignal: AbortSignal.timeout(settings.discovery.timeoutMs),
    });
  }

  async extractTurn(
    record: ProcessRecord,
    userText: string,
    assistantText: string,
    settings: Workshop,
    processDir: string,
  ): Promise<DiscoveryTurn> {
    const { output } = await generateText({
      model: isolatedModel(
        record.metadata.model,
        record.metadata.effort,
        processDir,
      ),
      output: Output.object({ schema: discoveryTurnSchema }),
      prompt: `Aktualisiere den strukturierten Prozessstand ausschließlich anhand des Gesprächs. Arrays in extractionDelta ersetzen den bisherigen Wert vollständig und müssen deshalb alle weiterhin gültigen Einträge enthalten. Für die fachliche Erstaufnahme genügen Auslöser, grober Ablauf, beteiligte Rollen, benannte Systeme oder Dokumente, mindestens ein Schmerzpunkt, ungefähre Häufigkeit oder Menge und die wichtigsten Ausnahmen. Fehlende Angaben zu APIs, Schnittstellen, Zugriff, Datenformaten oder technischer Machbarkeit verhindern den Abschluss ausdrücklich nicht. Bewerte interviewComplete als true, wenn der Nutzer die Zusammenfassung bestätigt hat oder das Fragenbudget ausgeschöpft ist. criteriaCoverage ist die Zahl der Kriterien mit belastbarer Evidenz.\n\n${budgetInstructions(record, settings.discovery.maxQuestions)}\n\nBisher:\n${JSON.stringify(record.extraction)}\n\nNutzer:\n${userText}\n\nInterview-Antwort:\n${assistantText}`,
      maxOutputTokens: settings.discovery.maxOutputTokens,
      abortSignal: AbortSignal.timeout(settings.discovery.timeoutMs),
    });
    const parsed = discoveryTurnSchema.parse(output);
    const bounded = discoveryTurnSchema.parse({
      ...parsed,
      interviewComplete:
        parsed.interviewComplete ||
        interviewBudget(record.transcript, settings.discovery.maxQuestions)
          .phase === "complete",
    });
    if (
      JSON.stringify(bounded).length >
      settings.discovery.maxOutputTokens * 12
    )
      throw new Error(
        "Die strukturierte Antwort überschreitet das sichere Limit.",
      );
    return bounded;
  }

  async generatePdd(
    record: ProcessRecord,
    template: string,
    settings: Workshop,
    processDir: string,
  ) {
    const { text } = await generateText({
      model: isolatedModel(
        record.metadata.model,
        record.metadata.effort,
        processDir,
      ),
      prompt: `Erstelle ein vollständiges Process Definition Document in sauberem Markdown. Halte exakt die Gliederung der Vorlage ein. Kennzeichne unbekannte Angaben als "Noch offen". Nenne jede hochgeladene Datei unter Systeme & Datenquellen. Die Workshop-Kriterien sind ein interner Abschnitt und enthalten Antwort, Evidenz und Konfidenz.\n\nVorlage:\n${template}\n\nStrukturierte Prozessdaten:\n${JSON.stringify(record.extraction)}\n\nHochgeladene Dateien:\n${record.uploads.map((file) => file.name).join(", ") || "Keine"}`,
      abortSignal: AbortSignal.timeout(settings.discovery.timeoutMs),
    });
    const required = [
      "Prozessübersicht",
      "Auslöser & Häufigkeit",
      "Ist-Ablauf",
      "Systeme & Datenquellen",
      "Schmerzpunkte",
      "Automatisierungsempfehlung",
      "Bewertung nach Workshop-Kriterien",
      "Offene Punkte",
      "Vorgeschlagener nächster Schritt",
    ];
    if (!text.trim() || required.some((heading) => !text.includes(heading)))
      throw new Error("Claude hat kein vollständiges PDD geliefert.");
    if (text.length > Math.max(settings.discovery.maxOutputTokens, 3_000) * 8)
      throw new Error("Das erzeugte PDD überschreitet das sichere Limit.");
    return text;
  }
}
