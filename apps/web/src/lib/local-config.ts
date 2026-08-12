import { processCaptureConfigSchema } from "../../../../packages/domain/src/process-understanding";
import type { ProcessCaptureConfig } from "./process-types";

const STORAGE_KEY = "claims-ai-process-capture.config.v2";
function currentConfig(value: unknown): ProcessCaptureConfig {
  const config = processCaptureConfigSchema.parse(value);
  if (config.profile.version === 1 || !("workCharacteristics" in config))
    throw new Error("Die Konfiguration verwendet eine ältere Profilversion.");
  return config;
}
export function loadConfigOverride(): ProcessCaptureConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? currentConfig(JSON.parse(raw)) : null;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}
export function saveConfigOverride(config: ProcessCaptureConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(currentConfig(config)));
}
export function resetConfigOverride() {
  localStorage.removeItem(STORAGE_KEY);
}
export function exportConfig(config: ProcessCaptureConfig) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(
    new Blob([JSON.stringify(currentConfig(config), null, 2)], {
      type: "application/json",
    }),
  );
  link.download = "prozessaufnahme-compact-v1-version-2.json";
  link.click();
  URL.revokeObjectURL(link.href);
}
export async function importConfig(file: File) {
  try {
    return currentConfig(JSON.parse(await file.text()));
  } catch {
    throw new Error("Die Konfigurationsdatei ist ungültig.");
  }
}
