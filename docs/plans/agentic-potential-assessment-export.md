# Agentische Potenzialbewertung mit Webprüfung und Excel-Export

## Ziel und Ablauf

Nach einer abgeschlossenen, aktuellen Opportunity Discovery bewertet genau ein explizit
gestarteter, begrenzter Claude-Aufruf das gespeicherte Szenario `SCN-agentic` gegen den
versionierten Volltext-Kriterienkatalog. Das validierte Ergebnis wird unveränderlich
gespeichert. Webansicht und Excel-Export lesen ausschließlich dieses Ergebnis und rufen
Claude nie auf.

```text
Opportunity completed → Bewertung erstellen → queued → running → completed
                                                      └────────→ failed → retry
completed → Webprüfung → deterministischer Excel-Export
```

Die Produktgrenze wird nur für dieses nachgelagerte Artefakt erweitert: keine
Priorisierung, keine finanziellen Werte, keine Machbarkeitszusage, keine Umsetzung oder
Übergabe. Der bisherige numerische Szenario-`Score`, der nur Konfidenz umcodiert, wird
durch die Klartext-Konfidenz ersetzt.

## Domänen- und Vertragsmodell

### Begriffe und Source Snapshot

`Agentic Potential Assessment` ist eine beratende Bewertung eines agentischen
Zukunftsszenarios, nicht des bestätigten Ist-Prozesses. Ein Datensatz gehört zu genau
einer eingefrorenen Opportunity-, Szenario-, Kriterien- und Vertragsrevision.

Der beim Start atomar gespeicherte `AgenticAssessmentSourceSnapshot` enthält:

- Prozess-ID, Prozessname, Fachbereich und Opportunity-`sourceProcessHash`;
- den vollständigen eingefrorenen Opportunity-Prozesssnapshot;
- `SCN-agentic`;
- genau die von `SCN-agentic.includedHypothesisIds` referenzierten Hypothesen;
- die 32 Einzelkriterien in verbindlicher Reihenfolge und ihre Skalen.

Start ist nur erlaubt, wenn der Prozess bestätigt ist, die Opportunity `completed` ist,
`SCN-agentic` existiert und `opportunities.isStale(...)` false liefert. Bereits
abgeschlossene historische Assessments bleiben mit einer sichtbaren Warnung les- und
exportierbar, wenn der aktuelle Prozess später veraltet; ein neuer Start auf einer
veralteten Opportunity ist gesperrt.

### Kriterien

`Kriterien Volltext` ist fachlich führend. Die Konfiguration enthält für jede Zeile eine
stabile englische ID, deutsche Kategorie, deutsche Bezeichnung, Volltextdefinition,
Skalentext, Reihenfolge und Bewertungsart.

Claude bewertet exakt diese 24 Kriterien auf `0 | 1 | 2`:

- `strategic_fit`, `qualitative_process_improvement`, `customer_value`,
  `employee_value`, `temporal_process_improvement`, `risk_reduction`,
  `scalability`, `organizational_development`, `time_urgency`;
- `process_criticality`, `process_maturity`, `change_effort`,
  `experience_base`, `process_expertise`, `process_diversity`,
  `process_systems`, `process_data`;
- `context_understanding`, `data_structuring_degree`, `decision_complexity`,
  `ai_data_foundation`, `error_tolerance`, `explainability_need`,
  `autonomy_and_human_ai_collaboration`.

Diese acht Kriterien ergänzt die Anwendung deterministisch als `policy_excluded` und
sendet sie nicht zur Bewertung:

- `regulatory_admissibility`, `absolute_necessity`;
- `annual_savings_potential`, `one_time_savings`, `annual_operating_costs`,
  `one_time_costs`;
- `business_case_stability`, `compliance_risk`.

Diese neun Ergebniszeilen sind keine Einzelbewertungen und werden ausschließlich für
Web/Excel mit leerem Score und dem Hinweis
`Nicht berechnet – unvollständige Bewertungsgrundlage` dargestellt:

- Zulässigkeit/Verpflichtung, Amortisationszeit, Netto-Ertrag, ROI,
  betriebswirtschaftliche Rentabilität;
- qualitativ-strategische Relevanz, Implementierungskomplexität,
  technische KI-Attraktivität, Gesamtergebnis.

Es werden keine Gewichtung, Finanzformel oder Gesamtscorelogik erfunden.

### Ergebnis und Invarianten

```ts
type CriterionAssessment =
  | {
      status: "scored";
      criterionId: AssessableCriterionId;
      score: 0 | 1 | 2;
      confidenceLevel: "high";
      rationale: string;
      evidenceIds: string[];
      hypothesisIds: string[];
      assumptions: [];
      openQuestions: [];
    }
  | {
      status: "insufficient_evidence";
      criterionId: AssessableCriterionId;
      score: null;
      confidenceLevel: "medium" | "low";
      rationale: string;
      evidenceIds: string[];
      hypothesisIds: string[];
      assumptions: string[];
      openQuestions: string[];
    }
  | {
      status: "policy_excluded";
      criterionId: ExcludedCriterionId;
      score: null;
      confidenceLevel: null;
      rationale: string;
      evidenceIds: [];
      hypothesisIds: [];
      assumptions: [];
      openQuestions: [];
    };
```

Die AI-Antwort enthält exakt einmal jedes der 24 bewertbaren Kriterien und nie die acht
ausgeschlossenen Kriterien. Normalisierung sortiert nach Konfiguration und ergänzt die
acht ausgeschlossenen Einträge. `scored` benötigt mindestens eine vorhandene Evidenz-ID,
mindestens eine in `SCN-agentic` eingeschlossene Hypothesen-ID und keine Annahme oder
offene Frage. `insufficient_evidence` hat immer `score: null`. Unbekannte oder doppelte
Kriterien-, Evidenz- und Hypothesenreferenzen werden abgelehnt.

`AgenticPotentialAssessmentRecord` speichert `schemaVersion: 1`, ID
`APA-PROC-0001`, Prozess-ID, Zustand `queued | running | completed | failed`, alle
Source-/Config-/Contract-Hashes, Snapshot, Konfigurationssnapshot, Ergebnis oder Fehler,
Zeitstempel und die unveränderliche `assessmentRevision`. Die Revision ist der SHA-256
über Source Snapshot, Konfiguration, Vertragsmanifest und normalisiertes Ergebnis.

## Laufzeit, Persistenz und API

Persistenz liegt unter
`workspace/process-captures/<id>/opportunity-discovery/agentic-assessment/`:

- `metadata.yaml`, `source-snapshot.json`, `config-snapshot.json`,
  `contract-manifest.json`, `result.json`;
- eingefrorene Prompt- und JSON-Schema-Dateien unter `contracts/`;
- `operations.jsonl`, `history.jsonl` und immutable Dateien unter `exports/`.

Alle Writes sind atomar. Assessment- und Exporthistorie sind append-only. Der neue
Operationsname lautet `agentic-potential-assessment` und erscheint als
`Agentische Potenzialbewertung` in der Queue.

Der Service stellt sicher:

1. `start` erzeugt genau einen Datensatz und queued genau einen Adapteraufruf;
2. der Worker setzt `running`, ruft Claude einmal auf, validiert/normalisiert und setzt
   `completed`; Fehler setzen `failed` ohne Teilresultat;
3. `retry` ist nur aus `failed` möglich, verwendet denselben eingefrorenen Vertrag und
   queued genau einen weiteren Aufruf;
4. Server-Recovery setzt `queued`/`running` auf `failed`, startet nie autonom neu.

API unter `/api/opportunities/:processId/agentic-assessment`:

- `GET /` liefert `404`, wenn noch kein Assessment existiert, sonst Public Record plus
  `isStale`;
- `POST /` startet und liefert `202` oder fachlich erklärtes `409`;
- `POST /retry` liefert `202`, ausschließlich nach `failed`;
- `POST /export` liefert nur nach `completed` eine private `no-store` XLSX-Datei,
  andernfalls `409`.

Der Export setzt `X-Agentic-Assessment-Revision`, Content-Disposition, nosniff und die
XLSX-MIME-Type. Auditdetail enthält Initiator, Assessment-/Source-/Template-Revision,
Export-ID, Dateiname, Output-SHA-256 und Zeitstempel.

## Web-Prüfseite

Neue Route: `/processes/:id/opportunities/agentic-assessment`.

Die Seite lädt Prozess, Opportunity und Assessment. Ein fehlendes Assessment ist kein
Fehlerzustand: Nach abgeschlossenen Szenarien zeigt sie Beschreibung und
`Bewertung erstellen`. `queued`/`running` zeigen Aktivität; `failed` zeigt Fehlermeldung
und `Erneut versuchen`; `completed` zeigt die schreibgeschützte Prüfung und
`Excel erstellen`.

Die abgeschlossene Ansicht zeigt:

- Prozess, agentisches Szenario, Quellrevision und Warnung bei historischem Stand;
- Summary-Karten für `Bewertet`, `Nicht ausreichend belegt`, `Ausgeschlossen`;
- Filter `Alle`, `Bewertet`, `Nicht ausreichend belegt`, `Ausgeschlossen`;
- gruppierte Zeilen in Volltext-Reihenfolge mit Kriterium, Skala, Score,
  Klartext-Konfidenz, Begründung, Evidenz, Hypothesen und offenen Informationen;
- die neun nicht berechneten Ergebniszeilen als klar getrennte Hinweise.

Es gibt keine Editier- oder Bestätigungsaktion. Ein Link nach fertigen Szenarien und die
vierte Prozessdetail-Karte `Potenzialbewertung` öffnen diese Seite. Der
Navigationszustand unterscheidet `Nach Szenarien`, `Bereit zur Bewertung`, `Läuft`,
`Unterbrochen`, `Bewertet` und `Historischer Stand`.

## Excel-Vertrag

Der Importer akzeptiert ausschließlich die Quellvorlage mit SHA-256
`32214a66a81272dcae7279f4d638668a1f55b8998ca1cfc250465b7af8f7a95c`.
Er entfernt `customXml/`, `docMetadata/LabelInfo.xml`, `docProps/custom.xml`, zugehörige
Relationships und Content-Type-Einträge sowie den internen Footer aus allen vier
Arbeitsblättern. Core Properties werden auf `Zukunftswerkstatt` neutralisiert.

Er fügt als erstes Blatt `Agentische Bewertung` hinzu. Dieses Blatt ist die einzige
Export-Mappingfläche und enthält:

- Metadatenblock für Prozess, Szenario, Assessment-/Source-Revision und Erstellzeit;
- Summary-Zähler;
- alle 32 Einzelkriterien und neun Ergebniszeilen mit Spalten für Kategorie,
  Kriterium, Status, Score, Skala, Begründung, Evidenz, Hypothesenbezug, Konfidenz und
  offene Informationen.

Die vier sanitisierten Referenzblätter folgen unverändert. Der Exporter prüft den
Template-Hash, kopiert das OOXML-Paket und patcht ausschließlich die konfigurierte
Assessment-Sheet-XML. Er neutralisiert Formelpräfixe, bewahrt Styles, prüft alle
nicht-zielgerichteten ZIP-Einträge bytegenau und öffnet das Ergebnis erneut zur
Validierung. Exportwerte werden nur aus dem gespeicherten normalisierten Ergebnis
gebildet; es gibt keinen Adapterzugriff und keine Exportzeit-Inferenz.

## Files To Change

### Neu

- `packages/domain/src/agentic-potential-assessment.ts`
- `defaults/agentic-potential-assessment-config.json`
- `defaults/prompts/agentic-potential-assessment.md`
- `defaults/ai-schemas/agentic-potential-assessment.json`
- `defaults/agentic-potential-assessment/KI-Potentiale.agentic.v1.xlsx`
- `scripts/import-agentic-assessment-template.ts`
- `packages/claude/src/agentic-potential-assessment-adapter.ts`
- `packages/storage/src/agentic-potential-assessment-repository.ts`
- `packages/storage/src/agentic-assessment-workbook.ts`
- `apps/server/src/agentic-potential-assessment-service.ts`
- `apps/server/src/routes/agentic-potential-assessments.ts`
- `apps/web/src/lib/agentic-potential-assessment-types.ts`
- `apps/web/src/pages/agentic-potential-assessment-page.tsx`
- `apps/web/src/components/agentic-potential-assessment-table.tsx`
- `docs/domain/agentic-potential-assessment.md`
- die sechs `tests/agentic-potential-assessment-*.test.ts` aus dem Testplan.

### Anpassen

- `AGENTS.md`, `CONTEXT.md`, `docs/domain/README.md`,
  `docs/domain/opportunity-discovery.md`, diese Plandatei;
- `packages/domain/src/schemas.ts`, `packages/domain/src/process-events.ts`;
- Claude-Vertragsexporte, `apps/server/src/index.ts`;
- `apps/web/src/app.tsx`, `apps/web/src/lib/api-client.ts`,
  `apps/web/src/lib/process-navigation-model.ts`,
  `apps/web/src/pages/process-detail-page.tsx`,
  `apps/web/src/components/opportunity-scenarios-view.tsx`,
  `apps/web/src/components/ai-operation-queue.tsx`;
- bestehende Navigation-, Event- und Operationsmanager-Tests.

## Tests und Abnahme

- Domain: Zustandswechsel, vollständige Kriterienmenge, Referenzintegrität, hohe
  Konfidenz-Invarianten, deterministische Policy-Ausschlüsse und Revision.
- AI-Vertrag: exakt ein Adapteraufruf, begrenzter Snapshot, eingefrorener Prompt/Schema,
  strikte strukturierte Antwort und kein Exportaufruf.
- Storage: atomare Erstellung, Recovery, Retry, Tamper-/Hash-Erkennung,
  append-only Historie und immutable Exporte.
- API: 404/202/409/200, stale gate, Auth-Initiator, Header und private Antwort.
- Workbook: Sanitizer entfernt Tenant-/Classification-Daten; fünf Blätter in korrekter
  Reihenfolge; Web- und Excelwerte stimmen; nur Assessment-Sheet wird exportseitig
  verändert; Formelinjektion wird neutralisiert.
- UI: alle Zustände, Filter, Summary, Detailfelder, historischer Hinweis, Download und
  Ersatz des falschen numerischen Szenario-Scores.
- Befehle: fokussiert `./scripts/qa test <file>`, während Umsetzung
  `./scripts/qa changed`, abschließend `./scripts/qa all` und
  `bun run build:release`.
- Visuell: LibreOffice-Render aller fünf Blätter; Chrome-DevTools-E2E bei Desktop und
  Tablet inklusive gefilterter Konsole und fehlgeschlagener Netzwerkrequests.

## Festgelegte Defaults

- `Kriterien Volltext` ist verbindlich.
- Webseite ist die fachliche Vorprüfung; Excel ist ihr deterministischer Export.
- Nur hoch-konfidente Einzelbewertungen erhalten Scores.
- Das Assessment bleibt `ai_inferred`, schreibgeschützt und keine Fachfreigabe.
- Die vorhandene PDD-Vorlage ist bereits sanitisiert/versioniert und bleibt unverändert.
