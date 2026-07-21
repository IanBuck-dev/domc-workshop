import { assessmentConfigSchema } from "../../../../packages/domain/src/assessment";
import type { AssessmentConfig } from "./assessment-types";

const STORAGE_KEY = "claims-ai-portfolio.config.v1";

function withSeparatedGatewayQuestions(
  config: AssessmentConfig,
): AssessmentConfig {
  return {
    ...config,
    gateway: {
      ...config.gateway,
      questions: config.gateway.questions.map((question) => {
        const { description, ...current } = question;
        const legacy = description ?? "";
        return {
          ...current,
          evaluationQuestion: question.evaluationQuestion ?? legacy,
          userQuestion: question.userQuestion ?? legacy,
          helpText: question.helpText ?? legacy,
        };
      }),
    },
  };
}

export function loadConfigOverride(): AssessmentConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = assessmentConfigSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) throw new Error("Ungültige Browser-Konfiguration");
    return assessmentConfigSchema.parse(
      withSeparatedGatewayQuestions(parsed.data),
    );
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function saveConfigOverride(config: AssessmentConfig) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(
      assessmentConfigSchema.parse(withSeparatedGatewayQuestions(config)),
    ),
  );
}

export function resetConfigOverride() {
  localStorage.removeItem(STORAGE_KEY);
}

export function exportConfig(config: AssessmentConfig) {
  const blob = new Blob(
    [JSON.stringify(withSeparatedGatewayQuestions(config), null, 2)],
    {
      type: "application/json",
    },
  );
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "claims-ai-config-v1.json";
  link.click();
  URL.revokeObjectURL(link.href);
}

export async function importConfig(file: File): Promise<AssessmentConfig> {
  const parsed = assessmentConfigSchema.safeParse(
    JSON.parse(await file.text()),
  );
  if (!parsed.success)
    throw new Error(
      "Die Konfigurationsdatei ist nicht vollständig oder ungültig.",
    );
  return assessmentConfigSchema.parse(
    withSeparatedGatewayQuestions(parsed.data),
  );
}
