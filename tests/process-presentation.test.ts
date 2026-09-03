import { describe, expect, test } from "bun:test";
import {
  businessProcessCode,
  safeProcessArtifactFilename,
} from "../packages/domain/src/process-presentation.ts";

describe("process presentation", () => {
  test("derives an optional business code from the existing name", () => {
    expect(
      businessProcessCode("FIN-03 · Nicht zuordenbare Zahlungseingänge klären"),
    ).toBe("FIN-03");
    expect(businessProcessCode("Schaden regulieren")).toBeNull();
  });

  test("creates a friendly, technical-ID-free export filename", () => {
    expect(
      safeProcessArtifactFilename(
        "Agentische-Potenzialbewertung",
        "FIN-03 · Nicht zuordenbare Zahlungseingänge klären",
      ),
    ).toBe(
      "Agentische-Potenzialbewertung_FIN-03_Nicht-zuordenbare-Zahlungseingaenge-klaeren.xlsx",
    );
    expect(safeProcessArtifactFilename("PDD", "Schaden regulieren")).toBe(
      "PDD_Schaden-regulieren.xlsx",
    );
  });
});
