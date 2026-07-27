import type { BadgeTone } from "../components/ui/badge";
import type { ProcessUnderstanding } from "./process-types";

type Provenance = ProcessUnderstanding["purpose"]["provenance"];

export const provenanceCopy: Record<Provenance, string> = {
  user_stated: "Ihre Angabe",
  file_evidence: "Aus Unterlage",
  ai_structured: "Strukturiert",
  ai_inferred: "Annahme",
  user_confirmed: "Bestätigt",
  unknown: "Noch unbekannt",
};

/**
 * Bestätigte Angaben sind gesichert, Annahmen und Lücken brauchen eine
 * Rückfrage, ein Beleg aus einer Unterlage ist ein neutraler Hinweis.
 */
export const provenanceTone: Record<Provenance, BadgeTone> = {
  user_stated: "neutral",
  file_evidence: "info",
  ai_structured: "neutral",
  ai_inferred: "warning",
  user_confirmed: "success",
  unknown: "warning",
};
