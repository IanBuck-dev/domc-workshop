# Autonome Agenten für lebende Prozessdokumentation

> Externer Research-Report (GPT Sol Pro, 7. August 2026), eingeholt als Grundlage der
> Wayfinder-Karte [Lebende Prozessdokumentation](../wayfinder/map-lebende-prozessdoku.md).
> Der Report beschreibt den Stand der Praxis 2025/2026 und eine Empfehlung; was davon für
> diesen Prototyp gilt, entscheiden die Tickets der Karte — nicht dieser Report.

**Stand:** 7. August 2026
**Zielbild:** Chat-basierte Prozess-Discovery in einer Versicherung, Claude Agent SDK mit TypeScript/Bun, Zod-validierte Prozessobjekte, Markdown im Git-Repository, keine separate Wissensdatenbank.

## Executive Summary

Für den vollständigen Ablauf „mehrere Gespräche → konsolidierte Unternehmensprozesse → dauerhaft gepflegte Git-Dokumentation" gibt es 2025/2026 noch keinen dominanten Industriestandard. Die direkt einschlägigen Process-Discovery-Systeme sind überwiegend Forschungsprototypen. Produktionsreife Teilmuster finden sich dagegen bei Dokumentationsagenten, Coding Agents, Incident-Postmortems und Agent-Memory-Systemen. Aus diesen Bereichen ergibt sich eine deutliche Konvergenz: **Evidenz wird erhalten, Wissen wird in einem typisierten Zwischenmodell konsolidiert, Dokumentation wird daraus generiert, und semantische Änderungen werden über einen Review-Mechanismus veröffentlicht.** ([Mintlify][1])

Für euren Prototyp ist die leichteste saubere Architektur:

> **`conversation.finalized` → Hintergrundjob → Zod-validierter Änderungsvorschlag → Konfliktprüfung → kanonisches Prozessobjekt → deterministischer Markdown-Renderer → Git-Branch/PR.**

Dazu kommt ein nächtlicher oder wöchentlicher Job, der fehlgeschlagene Events erneut verarbeitet, das gesamte Markdown-Korpus deterministisch neu rendert und Drift, kaputte Links oder verwaiste Dateien erkennt. Ereignisverarbeitung und Cron sind damit keine konkurrierenden Alternativen: **Events liefern geringe Latenz, Cron liefert Reparatur und Konsistenz.** Dieses hybride Muster wird sowohl von aktuellen Dokumentationsautomationen als auch von Agent-Plattformen unterstützt. ([Mintlify][2])

Die entscheidende Trennung lautet:

| Ebene                         | Bedeutung                                    | Autorität                            |
| ----------------------------- | -------------------------------------------- | ------------------------------------ |
| Gespräch/Evidenz              | Was eine Person tatsächlich gesagt hat       | Quelle für Aussagen                  |
| Prozessbeobachtung            | Strukturierte Interpretation eines Gesprächs | Noch keine Unternehmenswahrheit      |
| Kanonisches Zod-Prozessobjekt | Aktuell akzeptierter Prozessstand            | Source of Truth für Veröffentlichung |
| Markdown                      | Lesbare Projektion des Prozessstands         | Jederzeit regenerierbar              |

Markdown sollte daher **niemals unabhängig vom strukturierten Prozessobjekt fortgeschrieben werden**. Das Prozessobjekt ist die Publikationsquelle; die Gespräche bleiben die Evidenz, aus der sich der Prozessstand ableitet.

---

# 1. Architekturmuster für „Living Documentation"

## 1.1 Vergleich der Muster

| Dimension        | Muster                                                      | Stärken                                                                      | Schwächen                                                                                                                                                | Bewertung für euren Fall                                                                                                                                                                              |
| ---------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Trigger          | Agent nach jedem Chat-Turn                                  | Sehr geringe Latenz                                                          | Arbeitet auf unvollständigem Kontext, erzeugt viele konkurrierende Updates und Git-Diffs                                                                 | **Nicht verwenden.** Per-Turn-Hooks sind technisch möglich, aber für konsolidierte Dokumentation zu feingranular. ([Claude Platform Docs][3])                                                         |
| Trigger          | Agent nach abgeschlossenem Gespräch                         | Gute Balance aus Aktualität und vollständigem Interviewkontext               | Benötigt ein klares Abschlussereignis und Wiederholbarkeit                                                                                               | **Primärer Trigger.** Als Event `conversation.finalized` oder `process-observation.created`.                                                                                                          |
| Trigger          | Reiner Cron-Job                                             | Einfach, bündelt Änderungen und Kosten                                       | Verzögerte Dokumentation, große Batch-Diffs, Konflikte werden spät sichtbar                                                                              | **Nur als Fallback oder für periodische Konsolidierung.** Mintlify verwendet Cron insbesondere für wiederkehrende Gesprächsmuster und gebündelte Updates. ([Mintlify][2])                             |
| Trigger          | Event + Cron                                                | Schnell im Normalfall, selbstheilend bei Fehlern                             | Zwei Ausführungspfade müssen idempotent sein                                                                                                             | **Empfohlen.** Auch Claude Routines können Zeitplan-, API- und Repository-Events kombinieren. ([Claude Platform Docs][4])                                                                             |
| Update           | LLM schreibt Markdown direkt um                             | Sehr schnell zu prototypisieren, gut für rein redaktionelle Doku             | Semantische Änderungen sind schwer maschinell zu validieren; Stil und Struktur können driften                                                            | Für technische Dokumentationsagenten üblich, aber für Unternehmensprozesse nur als abgeleitete Ausgabe verwenden. Mintlify validiert solche Änderungen und legt standardmäßig PRs an. ([Mintlify][1]) |
| Update           | LLM erzeugt Markdown-Patch                                  | Kleinere Diffs als vollständiges Neuschreiben                                | Pfad-, Überschriften- und Formatierungsänderungen können Patch-Anwendung fragil machen; strukturierte und textuelle Darstellung können auseinanderlaufen | **Nicht als primäres Datenmodell.**                                                                                                                                                                   |
| Update           | LLM erzeugt typisierten Objekt-Patch, Code rendert Markdown | Validierbar, idempotent, nachvollziehbar, Markdown vollständig regenerierbar | Renderer und Schemata müssen gepflegt werden                                                                                                             | **Empfohlen.** Process-Modeling-Forschung zeigt klare Vorteile strukturierter JSON-Zwischenmodelle gegenüber direkter Bearbeitung des Zielformats. ([arXiv][5])                                       |
| Update           | Gesamtes Korpus nach jedem Event neu schreiben              | Einfaches Konsistenzmodell                                                   | Unnötige Laufzeit, Rauschen und Konfliktgefahr                                                                                                           | Nur bei sehr kleinem Korpus akzeptabel; besser nur betroffene Prozessdateien und Indizes rendern.                                                                                                     |
| Veröffentlichung | Direkt auf `main`                                           | Minimaler Prozess, sofort sichtbar                                           | Fehler werden unmittelbar zur offiziellen Dokumentation                                                                                                  | Nur für rein mechanische Änderungen oder Staging. Produktionssysteme verwenden Direct Push primär, wenn bewusst auf Review verzichtet wird. ([Mintlify][1])                                           |
| Veröffentlichung | PR für jede semantische Änderung                            | Auditierbar, bestehende Git-Governance nutzbar                               | Review-Aufwand und potenzieller PR-Spam                                                                                                                  | **Für den Versicherungsprototyp zunächst empfohlen.** Coding Agents und Dokumentationsagenten verwenden Branch/PR als zentrale Kontrollgrenze. ([The GitHub Blog][6])                                 |
| Veröffentlichung | Risikobasiertes Review                                      | Geringerer Review-Aufwand bei bewährter Automatisierung                      | Klassifikationsregeln und Vertrauen müssen aufgebaut werden                                                                                              | Zielbild nach der Prototypphase. Ambient-Agent-Muster unterscheiden typischerweise zwischen Benachrichtigen, Rückfragen und Review. ([LangChain][7])                                                  |

## 1.2 Hintergrund-Agent und Event-Driven sind keine Alternativen

„Hintergrund-Agent nach jedem Gespräch" beschreibt die **Ausführungsform**; „ereignisgetrieben" beschreibt den **Auslöser**. Der sinnvolle Aufbau ist daher:

1. Der Discovery-Chat wird ausdrücklich abgeschlossen.
2. Das System schreibt ein Event oder einen Job `conversation.finalized`.
3. Ein Hintergrund-Worker verarbeitet diesen Job.
4. Der Worker erzeugt entweder einen No-op, einen automatisch anwendbaren Änderungsvorschlag oder einen Review-Fall.

Ambient-Agent-Architekturen folgen genau diesem Grundprinzip: Sie hören auf Ereignisströme, arbeiten asynchron und beziehen Menschen nur ein, wenn Informationen fehlen oder eine relevante Aktion geprüft werden muss. ([LangChain][7])

Nicht jeder Abschluss eines Gesprächs muss eine Dokumentationsänderung erzeugen. Ein Interview kann:

- bereits bekannte Informationen bestätigen,
- nur zusätzliche Evidenz liefern,
- eine lokale Variante beschreiben,
- einen Widerspruch erzeugen,
- einen neuen Prozess betreffen,
- oder für das Prozesskorpus irrelevant sein.

Deshalb sollte der Job ein explizites Ergebnis wie `noop`, `apply` oder `review_required` zurückgeben.

## 1.3 Empfohlene Trigger-Strategie

### Primär: `conversation.finalized`

Der Trigger sollte nicht nach jedem Turn ausgelöst werden, sondern wenn eines der folgenden Ereignisse eintritt:

- Der Sachbearbeiter bestätigt die Zusammenfassung.
- Der Discovery-Agent markiert das Interview als vollständig.
- Eine explizite Aktion „Gespräch abschließen" wird ausgeführt.
- Als Fallback wird eine inaktive Sitzung nach einem Debounce-Fenster vorläufig abgeschlossen.

Ein expliziter Abschluss ist besser als reine Inaktivität, weil der Agent dann auf einem validierten Gesprächsergebnis statt auf einem zufällig unterbrochenen Dialog arbeitet.

### Sekundär: nächtliche Reconciliation

Der Cron-Job sollte **nicht alle Gespräche erneut semantisch interpretieren**. Er sollte vor allem:

- fehlgeschlagene oder hängengebliebene Jobs erneut ausführen,
- kanonische Prozessobjekte vollständig neu rendern,
- `source_revision` und Markdown-Dateien vergleichen,
- verwaiste Dateien und ungültige Querverweise erkennen,
- offene Widersprüche und überfällige Reviews melden,
- doppelte Prozesskandidaten markieren.

Eine vollständige semantische Reinterpretation ist nur bei einer bewussten Migration sinnvoll, etwa nach einer neuen Schema- oder Prompt-Version.

## 1.4 Diff-basierte Updates oder Neuschreiben?

Die beste Antwort hängt von der Ebene ab:

| Ebene                             | Empfohlenes Verfahren                                    |
| --------------------------------- | -------------------------------------------------------- |
| Gespräch → Beobachtung            | Neues append-only Beobachtungsobjekt                     |
| Beobachtung → kanonischer Prozess | Typisierter Patch mit `baseRevision`                     |
| Kanonischer Prozess → Markdown    | Betroffene Datei vollständig deterministisch neu rendern |
| Repository                        | Git berechnet daraus den lesbaren Diff                   |
| Gesamtes Korpus                   | Periodischer kompletter Rebuild als Konsistenztest       |

Damit kombiniert ihr die Vorteile beider Ansätze:

- **Semantisch diff-basiert:** Der Agent muss genau angeben, welche Felder oder Claims geändert werden sollen.
- **Textuell neu gerendert:** Der Agent muss keine fragilen Markdown-Zeilenoperationen durchführen.
- **Git-seitig diff-basiert:** Reviewer sehen trotzdem nur die tatsächliche Änderung.

Das entspricht dem Materialized-View-Prinzip: Eine abgeleitete Darstellung ist vollständig entbehrlich, wird nicht direkt als Primärzustand verändert und kann aus ihrer Quelle neu aufgebaut werden. ([Microsoft Learn][8])

## 1.5 Mensch-Review oder autonomes Schreiben?

Für euren Prototyp sollte der Agent **autonom schreiben, aber nicht autonom autorisieren**:

- Er darf einen Branch erstellen.
- Er darf strukturierte Daten und Markdown rendern.
- Er darf Validierungen ausführen.
- Er darf einen PR eröffnen und erläutern.
- Er darf Review-Feedback verarbeiten.
- Er sollte den semantischen Unternehmensprozess zunächst nicht selbst nach `main` mergen.

Dieses Governance-Modell ist inzwischen bei asynchronen Coding Agents etabliert: Der Agent arbeitet auf einer eigenen Branch, legt einen PR an, führt Selbstprüfung und Tests aus, kann aber seine Änderungen nicht selbst genehmigen oder mergen. ([The GitHub Blog][6])

Für eine spätere risikobasierte Automatisierung bietet sich folgende Staffelung an:

| Änderung                                                                                        | Veröffentlichung           |
| ----------------------------------------------------------------------------------------------- | -------------------------- |
| Index neu sortieren, Link reparieren, Renderer-Version aktualisieren                            | Auto-Merge nach CI         |
| Rechtschreibung oder nicht-semantische Formulierung                                             | Auto-Merge oder Sammel-PR  |
| Zusätzliche Evidenz ohne Änderung des akzeptierten Inhalts                                      | Automatisch aktualisierbar |
| Neue Rolle, neuer Schritt, geänderte Reihenfolge, neue Entscheidung oder Ausnahme               | Fachlicher Review          |
| Änderung von Verantwortlichkeit, Kontrolle, Freigabe, System oder regulatorisch relevantem Feld | Prozess-Owner-Review       |
| Widerspruch zwischen Quellen                                                                    | Kein Auto-Merge            |

---

# 2. Struktur eines Markdown-Korpus

## 2.1 Empfohlene Repository-Struktur

```text
repo/
├── process-data/
│   ├── catalog.json
│   ├── processes/
│   │   ├── claims.fnol-intake.json
│   │   └── claims.payment-approval.json
│   ├── observations/
│   │   ├── obs_01J....json
│   │   └── obs_01K....json
│   └── claims/
│       ├── claims.fnol-intake.jsonl
│       └── claims.payment-approval.jsonl
│
├── docs/
│   ├── processes/
│   │   ├── index.md
│   │   ├── claims/
│   │   │   ├── index.md
│   │   │   ├── claims.fnol-intake.md
│   │   │   └── claims.payment-approval.md
│   │   └── customer-service/
│   │       ├── index.md
│   │       └── customer.address-change.md
│   └── open-questions/
│       └── index.md
│
├── schemas/
│   ├── process.schema.json
│   ├── observation.schema.json
│   └── claim.schema.json
│
└── scripts/
    ├── render-docs.ts
    ├── validate-processes.ts
    └── reconcile-docs.ts
```

Die Struktur folgt etablierten Docs-as-Code-Konventionen: Markdown-Dateien liegen in einem eigenen Verzeichnis, ein `index.md` bildet den Einstieg, und Navigation beziehungsweise Bereichsindizes werden explizit oder automatisch erzeugt. Backstage TechDocs verwendet beispielsweise ein `docs/`-Verzeichnis mit mindestens einer `index.md`; Docusaurus und GitHub Docs verwenden Frontmatter für stabile IDs, Navigation und Metadaten. ([Backstage][9])

## 2.2 Eine Datei pro Prozess, nicht pro Gespräch

Die sinnvolle Grundeinheit ist ein **stabiler Prozess-Aggregat**, beispielsweise:

- „Kfz-Schadenmeldung aufnehmen"
- „Adressänderung bearbeiten"
- „Zahlung über 10.000 Euro freigeben"

Ein Gespräch ist dagegen lediglich eine Quelle für diesen Prozess. Eine Datei pro Gespräch würde:

- dieselben Prozesse mehrfach dokumentieren,
- Querverweise und Navigation fragmentieren,
- Widersprüche verstecken statt konsolidieren,
- und die Frage offenlassen, welche Datei aktuell gilt.

### Wann bleibt etwas eine Variante?

Varianten sollten in derselben Prozessdatei bleiben, wenn sie:

- dasselbe fachliche Ergebnis verfolgen,
- denselben grundlegenden Trigger haben,
- weitgehend denselben Ablauf verwenden,
- und nur nach Produkt, Kanal, Organisationseinheit oder System differieren.

Beispiel:

```text
Schadenmeldung aufnehmen
├── Variante: Kundenportal
├── Variante: Telefon
└── Variante: Makler
```

### Wann wird ein eigener Teilprozess angelegt?

Ein eigener Prozess ist sinnvoll, wenn der Teil:

- unabhängig wiederverwendet wird,
- einen eigenen Owner oder Review-Zyklus besitzt,
- separat geändert oder freigegeben werden kann,
- ein eigenständiges Ergebnis erzeugt,
- oder in mehreren übergeordneten Prozessen referenziert wird.

Die Granularität kann nicht vollständig durch das LLM entschieden werden. Process-Discovery-Forschung zeigt, dass Prozess-Owner typischerweise die End-to-End-Sicht liefern, während operative Fachkräfte feinere Details besitzen; die Wahl der Modellierungsperspektive und Granularität bleibt eine Aufgabe, bei der menschliche Prozessanalyse relevant ist. ([Springer][10])

## 2.3 Index-Dateien

Empfohlen sind zwei Ebenen:

1. `docs/processes/index.md`: unternehmensweiter Prozesskatalog.
2. `docs/processes/<domain>/index.md`: Bereichs- oder Domänenindex.

Beide sollten generiert werden. Ein Index kann enthalten:

| Prozess | Status | Owner | Varianten | Letzter fachlicher Review | Offene Konflikte |
| ------- | ------ | ----- | --------: | ------------------------- | ---------------: |

Zusätzlich sollte `process-data/catalog.json` eine kompakte maschinenlesbare Fassung enthalten:

```json
{
  "processes": [
    {
      "id": "claims.fnol-intake",
      "title": "Schadenmeldung aufnehmen",
      "aliases": ["FNOL", "Erstschadenaufnahme"],
      "domain": "claims",
      "scope": ["kfz"],
      "systems": ["claims-portal", "core-claims"]
    }
  ]
}
```

Dieser Katalog reicht für die leichte Prozessauflösung häufig aus. Der Agent kann Titel, Aliase, Domain, Systeme und Scope durchsuchen, ohne dass eine Vektor- oder Graphdatenbank erforderlich ist.

## 2.4 Frontmatter-Konvention

Ein schlankes Frontmatter könnte so aussehen:

```yaml
---
id: claims.fnol-intake
title: Schadenmeldung aufnehmen
document_type: process
schema_version: 1
status: active

domain: claims
owners:
  - role:claims-process-owner

scope:
  products:
    - motor
  channels:
    - portal
    - phone

systems:
  - claims-portal
  - core-claims

revision: 42
source_revision: sha256:4f7e...
renderer_version: 1

review:
  state: approved
  reviewed_at: 2026-08-05
  reviewed_by: role:claims-process-owner

provenance:
  observation_count: 7
  open_conflicts: 1

generated: true
---
```

Frontmatter eignet sich für Identität, Navigation, Filterung, Status und Build-Validierung. GitHub Docs validiert das Frontmatter jeder Seite gegen ein Schema; Docusaurus verwendet eine vom Dateipfad unabhängige Dokument-ID und separate Navigationsmetadaten. ([GitHub Docs][11])

Nicht in das Frontmatter gehören:

- sämtliche Gesprächsreferenzen,
- lange Quellenlisten,
- individuelle Claims,
- große Schrittstrukturen,
- volatile Build-Zeitstempel.

Insbesondere ein `generated_at: now()` würde bei jedem Build unnötige Diffs erzeugen. Verwendet stattdessen `last_material_change` oder die Revision der kanonischen Quelle.

## 2.5 Stabile Dokumentstruktur

Jede Prozessdatei sollte dieselbe Abschnittsreihenfolge verwenden:

```markdown
# Schadenmeldung aufnehmen

## Zweck und Ergebnis

## Geltungsbereich

## Auslöser und Eingaben

## Rollen und Verantwortlichkeiten

## Ablauf

## Entscheidungen und Geschäftsregeln

## Ausnahmen und Fehlerfälle

## Varianten

## Systeme und Dokumente

## Kontrollen und Nachweise

## Abhängige Prozesse

## Offene Fragen und Widersprüche

## Quellen und Änderungshistorie
```

Das erleichtert:

- deterministisches Rendering,
- kleine und vergleichbare Git-Diffs,
- spätere Suche oder Extraktion,
- Reviews durch Fachanwender,
- und die Generierung von Bereichsübersichten.

## 2.6 Querverweise

In den strukturierten Objekten sollten Querverweise ausschließlich stabile IDs verwenden:

```json
{
  "relatedProcesses": [
    {
      "processId": "claims.coverage-check",
      "relation": "calls"
    }
  ]
}
```

Der Renderer erzeugt daraus den relativen Markdown-Link. Dadurch bleiben Prozessbeziehungen stabil, selbst wenn Dateiname oder Ordner geändert werden.

Docusaurus empfiehlt ebenfalls explizite Metadaten statt numerischer Dateipräfixe, da Umnummerierungen vorhandene Markdown-Links beschädigen können. Linkvalidierung sollte Teil der CI sein; MkDocs kann ungültige Dokument- und Ankerlinks mit einem Strict Build zu Fehlern machen. ([Docusaurus][12])

---

# 3. Widersprüche und Provenienz

## 3.1 Nicht direkt „Aussage → Prozessfeld" schreiben

Die wichtigste Modellierungsentscheidung ist eine zusätzliche Ebene zwischen Gespräch und kanonischem Prozess:

```text
Gespräch
   ↓
ProcessObservation
   ↓
atomare Claims mit Evidenzreferenzen
   ↓
konsolidierter CanonicalProcess
   ↓
Markdown
```

Ein Gesprächsagent sollte zunächst eine **Beobachtung** erzeugen: „Diese Person hat für diesen Scope diesen Ablauf beschrieben." Erst ein separater Reconciliation-Schritt entscheidet, ob die Aussage:

- einen akzeptierten Prozess ergänzt,
- eine bestehende Aussage bestätigt,
- eine Variante beschreibt,
- eine frühere Aussage ersetzt,
- oder im Widerspruch zu ihr steht.

Aktuelle Agent-Memory-Forschung bewegt sich ebenfalls in Richtung einer expliziten Trennung von unveränderlicher Evidenz, typisierten Claims und dem daraus abgeleiteten aktuellen Wissensstand. Graphiti speichert Rohereignisse als „Episodes", auf die sich abgeleitete Fakten zurückführen lassen; Eywa und MemIR beschreiben ausdrücklich eine Architektur, in der Evidenz vor kanonischen Fakten gespeichert und Rohbelege, Retrieval-Hinweise und wahrheitsfähige Claims strukturell getrennt werden. ([GitHub][13])

## 3.2 Minimales Claim-Modell

```ts
type EvidenceRef = {
  conversationId: string;
  messageIds: string[];
  sourceSpanHash?: string;

  speakerRef: string;
  speakerRole?: string;

  capturedAt: string;
  sourceSystem: "process-discovery-chat";
};

type ProcessClaim = {
  claimId: string;
  processId: string;

  // Beispielsweise "steps.step_approve.performer"
  semanticPath: string;
  value: unknown;

  perspective: "normative" | "observed" | "exception" | "local_variant";

  scope: {
    product?: string[];
    channel?: string[];
    organizationUnit?: string[];
    jurisdiction?: string[];
    systemVersion?: string[];
  };

  validFrom?: string;
  validTo?: string;

  status: "proposed" | "accepted" | "contested" | "superseded" | "rejected";

  evidence: EvidenceRef[];

  decidedBy?: string;
  decidedAt?: string;
  supersedesClaimIds?: string[];
};
```

Die Feldnamen können sich an W3C PROV orientieren, ohne RDF oder eine Graphdatenbank einzuführen. Relevant sind insbesondere Beziehungen wie „wurde abgeleitet aus", „wurde erzeugt durch", „verwendete" und „wurde einer Person oder Aktivität zugeschrieben". ([W3C][14])

## 3.3 Viele scheinbare Widersprüche sind Scope-Unterschiede

Zwei Aussagen sollten nur dann als echter Konflikt gelten, wenn sie:

1. denselben Prozess und denselben semantischen Sachverhalt betreffen,
2. inkompatible Werte behaupten,
3. sich auf überlappende Scopes beziehen,
4. dieselbe Perspektive oder denselben Anspruch besitzen,
5. und im selben Gültigkeitszeitraum gelten.

Beispiel:

| Aussage                                                         | Bewertung                        |
| --------------------------------------------------------------- | -------------------------------- |
| „Schadenmeldungen werden automatisch vorgeprüft." – Portal-Team | Beobachtung für `channel=portal` |
| „Schadenmeldungen werden manuell vorgeprüft." – Telefon-Team    | Beobachtung für `channel=phone`  |
| Ergebnis                                                        | Zwei Varianten, kein Konflikt    |

Ein weiterer häufiger Fall ist **Soll versus Ist**:

| Aussage                                                                       | Perspektive                 |
| ----------------------------------------------------------------------------- | --------------------------- |
| „Auszahlungen über 10.000 Euro benötigen immer eine Vier-Augen-Freigabe."     | `normative`                 |
| „Bei einem Altvertrag kann das Altsystem die zweite Freigabe nicht abbilden." | `observed` oder `exception` |

Beide Aussagen können gleichzeitig korrekt sein. Das System sollte daraus keine einzige künstlich harmonisierte Wahrheit erzeugen, sondern Sollprozess, beobachtete Abweichung und offenen Handlungsbedarf separat darstellen.

## 3.4 Konfliktauflösung

### Automatisch auflösbar

Eine automatische Entscheidung ist vertretbar, wenn sie auf einer klaren deterministischen Regel beruht:

- Eine Person korrigiert ausdrücklich ihre eigene vorherige Aussage.
- Eine genehmigte Prozessrevision besitzt ein späteres `effectiveFrom`.
- Eine alte Systemversion wurde eindeutig durch eine neue ersetzt.
- Die Aussagen betreffen nach Scope-Normalisierung unterschiedliche Varianten.
- Ein Claim verweist explizit auf den Claim, den er ersetzt.

Bei expliziten Versions- oder Zeitinformationen können deterministische Resolver zuverlässiger sein als ein freies LLM-Urteil. Aktuelle Forschung grenzt diesen Vorteil allerdings auf Current-Value-Fragen mit expliziten Versionsmetadaten ein; allgemeine semantische Konflikte bleiben deutlich schwieriger. ([arXiv][15])

### Nicht automatisch auflösbar

Kein „last write wins" bei:

- unterschiedlicher Beschreibung durch zwei operative Teams,
- unklarer Soll-/Ist-Trennung,
- widersprüchlichen Geschäftsregeln,
- unterschiedlichen Aussagen zu Kontrollen oder Freigaben,
- impliziten Änderungen, bei denen eine neue Aussage eine alte nur indirekt ungültig macht.

Ein 2026 veröffentlichter Preprint-Benchmark zu impliziten Gedächtniskonflikten zeigt, dass aktuelle LLMs und Memory-Systeme selbst dann häufig scheitern, wenn die neue Evidenz korrekt abgerufen wurde; das stärkste dort untersuchte Basissystem erreichte 55,2 Prozent Gesamtgenauigkeit. Das ist noch keine abschließende Industriemessung, aber ein deutliches Argument gegen autonome semantische Konfliktentscheidung. ([arXiv][16])

### Empfohlenes Konfliktergebnis

```json
{
  "status": "contested",
  "semanticPath": "decisions.payment-approval.threshold",
  "claims": ["claim_17", "claim_29"],
  "reason": "overlapping_scope_incompatible_values",
  "requiredReviewerRole": "claims-process-owner"
}
```

Die bestehende akzeptierte Aussage bleibt zunächst erhalten oder wird als `contested` markiert. Beide Claims bleiben gespeichert. Der PR enthält:

- den betroffenen Abschnitt,
- die konkurrierenden Aussagen,
- Scope und Perspektive,
- Links oder IDs der Gespräche,
- und eine konkrete Review-Frage.

## 3.5 Git-Historie reicht für Provenienz nicht aus

Ein Git-Commit beantwortet:

- wer eine Datei geändert hat,
- wann sie geändert wurde,
- und welcher Text vorher vorhanden war.

Er beantwortet nicht zuverlässig:

- welche Person welche fachliche Aussage gemacht hat,
- welcher Gesprächsausschnitt einen konkreten Prozessschritt begründet,
- ob eine Formulierung vom LLM ergänzt oder aus einem Gespräch abgeleitet wurde,
- und welche konkurrierende Evidenz verworfen wurde.

Deshalb braucht ihr zusätzlich Claim-Level-Provenienz. In der sichtbaren Markdown-Datei reicht eine kompakte Darstellung:

```markdown
## Quellen und offene Punkte

- Grundlage: 7 abgeschlossene Discovery-Gespräche
- Letzte fachliche Bestätigung: 2026-08-05
- Offener Konflikt C-17: Freigabegrenze bei Altverträgen
- Evidenzreferenzen: OBS-104, OBS-118, OBS-121
```

Die detaillierten Message-IDs und Evidenzketten bleiben in den strukturierten Sidecars oder dem bestehenden geschützten Gesprächsspeicher. Vollständige sensible Transkripte müssen nicht in das allgemeine Dokumentations-Repository kopiert werden.

---

# 4. Konsistenz zwischen Zod-Daten und Markdown

## 4.1 Zwei unterschiedliche Arten von „Quelle"

Die Begriffe sollten ausdrücklich getrennt werden:

### Source of Record für Evidenz

Das Gespräch beziehungsweise dessen unveränderliche Aufzeichnung ist die Quelle dafür, **was gesagt wurde**.

### Source of Truth für den aktuellen Prozessstand

Das kanonische, Zod-validierte Prozessobjekt ist die Quelle dafür, **was aktuell als Unternehmensprozess veröffentlicht wird**.

### Markdown als Read Model

Markdown ist eine für Menschen optimierte Darstellung des akzeptierten Prozessstands. Es wird niemals direkt als konkurrierende Wahrheitsquelle behandelt.

Das entspricht dem Materialized-View-Muster: Die Darstellung kann vollständig verworfen und aus den Primärdaten neu aufgebaut werden. ([Microsoft Learn][8])

## 4.2 Das Agentenergebnis sollte ein Proposal sein

Der Agent sollte kein Schreibrecht auf die kanonischen Dateien benötigen. Er liest bestehende Prozesse und Beobachtungen und liefert ein strukturiertes Ergebnis:

```ts
type ProcessChangeProposal = {
  proposalId: string;
  processId?: string;
  baseRevision?: number;

  decision:
    | "noop"
    | "create_process"
    | "update_process"
    | "review_required"
    | "unresolved_process_identity";

  operations: Array<{
    op: "add" | "replace" | "remove";
    path: string;
    value?: unknown;
    supportingClaimIds: string[];
  }>;

  newClaims: ProcessClaim[];
  conflicts: ProcessConflict[];

  summary: string;
  reviewerQuestions: string[];
};
```

Der Claude Agent SDK unterstützt strukturierte Ausgaben über JSON Schema und kann in TypeScript direkt mit Zod-Schemata verwendet werden. Das SDK validiert das Endergebnis und behandelt fehlgeschlagene Schemaerfüllung als Fehler statt als beliebigen Freitext. ([Claude][17])

Damit wird die Verantwortlichkeit klar:

| Komponente              | Darf tun                                                  |
| ----------------------- | --------------------------------------------------------- |
| Claude-Agent            | Lesen, analysieren, Proposal erzeugen                     |
| Application Coordinator | Zod validieren, Konfliktregeln ausführen, Revision prüfen |
| Renderer                | Ausschließlich aus kanonischen Daten Markdown erzeugen    |
| Git-Workflow            | Branch, Commit, CI, PR                                    |
| Reviewer                | Proposal akzeptieren, verändern oder ablehnen             |

## 4.3 Optimistic Concurrency

Jedes Proposal sollte `baseRevision` enthalten:

```text
Agent las Prozessrevision 41
          ↓
Proposal basiert auf Revision 41
          ↓
Vor Anwendung prüfen: aktuelle Revision noch 41?
```

Ist der Prozess inzwischen bei Revision 42, wird das Proposal nicht blind angewendet. Der Job wird mit dem neuen Zustand erneut konsolidiert.

Das verhindert, dass zwei parallel abgeschlossene Interviews denselben Prozess gegenseitig überschreiben.

Zusätzlich benötigt jeder Job eine stabile Event-ID. Die Verarbeitung derselben `conversation.finalized`-Nachricht muss idempotent sein:

```text
same event ID + same source revision = no additional mutation
```

## 4.4 Deterministischer Renderer

Der Renderer sollte:

- Felder immer in derselben Reihenfolge ausgeben,
- Listen stabil sortieren,
- leere optionale Abschnitte konsistent behandeln,
- keine zufälligen Formulierungsvarianten erzeugen,
- keine aktuellen Build-Zeitstempel einfügen,
- und bei identischem Input byte-identischen Output erzeugen.

Das LLM kann bei Bedarf eine fachliche Kurzbeschreibung als strukturiertes Feld vorschlagen. Die eigentliche Markdown-Struktur, Überschriften, Tabellen und Links sollten jedoch durch TypeScript-Code entstehen.

## 4.5 CI-Prüfungen

Eine minimale Pipeline:

```bash
bun run validate:schemas
bun run validate:references
bun run docs:generate
git diff --exit-code
bun run docs:lint
bun run docs:check-links
bun test
```

Dabei sollten mindestens folgende Invarianten geprüft werden:

1. Jedes Prozessobjekt erfüllt das aktuelle Zod-Schema.
2. Jede Prozess-ID ist eindeutig.
3. Jede referenzierte Rollen-, System- und Prozess-ID existiert.
4. Zu jedem aktiven Prozess existiert genau eine Markdown-Datei.
5. `source_revision` im Frontmatter entspricht der Prozessrevision.
6. Eine erneute Renderausführung erzeugt keinen Diff.
7. Alle internen Links und Anker sind gültig.
8. Generierte Dateien enthalten keinen nicht markierten manuellen Inhalt.

Docs-as-Code-Systeme verwenden genau solche mechanischen Schranken: GitHub Docs validiert Frontmatter und Markdown über Linter und CI; MkDocs kann ungültige Links im Strict Build als Fehler behandeln. ([GitHub Docs][11])

## 4.6 Manuelle Ergänzungen

Es sollte keine unkontrollierte Mischung aus generiertem und manuell bearbeitetem Text geben. Drei saubere Optionen sind:

1. **Alles fachlich Relevante bleibt im kanonischen Objekt.**
2. Manuelle Ergänzungen liegen in einer separaten Datei, beispielsweise `claims.fnol-intake.notes.md`.
3. Bestimmte Bereiche werden explizit markiert:

```markdown
<!-- BEGIN GENERATED PROCESS -->

...
<!-- END GENERATED PROCESS -->

<!-- BEGIN MANUAL NOTES -->

...
<!-- END MANUAL NOTES -->
```

Das Marker-Muster ist aus Dokumentationsgeneratoren wie `terraform-docs` bekannt, die generierte Abschnitte gezielt in bestehende Markdown-Dateien injizieren und den übrigen Text erhalten. ([GitHub][18])

Für euren Prototyp ist Variante 1 am saubersten. Reviewer ändern das Zod-Objekt beziehungsweise das Proposal und lassen anschließend neu rendern.

---

# 5. Konkrete Vorbilder

## 5.1 Vergleich

| Vorbild                                  | Funktionsweise                                                                                                                                                                                                                                                                                                                                  | Übertragbarer Teil                                                                                                                                                        |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **PKAI – Process Knowledge Acquisition** | Mehrere spezialisierte Agenten unterstützen Vorbereitung, Interview und Externalisierung. Sie teilen einen JSON-basierten Zustand. Das Ergebnis umfasst strukturierte Prozessinformationen, Dokumentation, ein Prozessmodell und die vollständige Gesprächshistorie; ein Prozessanalyst validiert und verfeinert die Ausgabe. ([Springer][10])  | Gespräche nicht direkt als endgültigen Prozess behandeln; gemeinsames strukturiertes Zwischenmodell; vollständige Traceability; Mensch validiert die semantische Fassung. |
| **BPMNGen**                              | Natürlichsprachige Änderungen werden zunächst in JSON transformiert; Servercode erzeugt daraus BPMN XML. Der Prototyp verwendet lokal gespeicherte strukturierte JSON-Dateien für Threads, Messages und Prozessmodelle und unterstützt iterative Versionen. ([Springer][19])                                                                    | Leichtgewichtige Dateiablage reicht für einen Prototyp; strukturierte Darstellung ist Quelle, formales Artefakt ist Ableitung.                                            |
| **BPMN Assistant**                       | Verwendet eine spezialisierte JSON-Zwischenrepräsentation und atomare Editierfunktionen statt direkter XML-Manipulation. In der Evaluation war dieser Ansatz bei Bearbeitungsaufgaben zuverlässiger und effizienter als direkte XML-Ausgabe. Die Autoren weisen zugleich auf fehlende semantische Garantien hin. ([arXiv][5])                   | Agent erzeugt typisierte Operationen; deterministischer Code erzeugt das Zielformat; Syntaxvalidierung ersetzt keinen fachlichen Review.                                  |
| **Mintlify Agent und Automations**       | Liest bestehende Dokumentation, Repositories, PRs und Slack-Threads, plant Änderungen, schreibt Inhalte, validiert den Docs-Build und eröffnet standardmäßig einen PR. Automationen können ereignisbasiert oder zeitgesteuert laufen; Support-Conversation-Automationen verlinken die ausgewerteten Quellgespräche. ([Mintlify][1])             | Hybrid aus Event und Cron; PR als Veröffentlichungsschranke; Quellen im Änderungsvorschlag aufführen; mehrere verwandte Änderungen bündeln.                               |
| **GitHub Copilot Coding Agent**          | Arbeitet asynchron in eigener Umgebung und Branch, führt Tests und Selbstreview aus, eröffnet einen Draft-PR und benötigt unabhängigen menschlichen Review. ([The GitHub Blog][6])                                                                                                                                                              | Git-Branch als Sandbox; Agent darf produzieren, aber nicht selbst autorisieren; CI und Review bleiben unverändert nutzbar.                                                |
| **incident.io / Rootly / FireHydrant**   | Chatnachrichten, Timeline-Ereignisse, Runbook-Aktionen, Calls und technische Daten werden als Ereignisse erhalten. Daraus erzeugt AI editierbare Incident-Zusammenfassungen und Postmortems. incident.io kann etwa Slack-/Teams-Kanäle, Timeline, PRs und weitere Incident-Daten zu einem ersten Postmortem-Entwurf verbinden. ([Incident][20]) | Erst einen nachvollziehbaren Ereignisstrom erhalten, dann daraus Dokumentation ableiten; Rohdaten und kuratierte Darstellung nicht vermischen.                            |
| **Graphiti / Eywa / MemIR**              | Speichern Rohereignisse beziehungsweise Evidenz getrennt von abgeleiteten Fakten; berücksichtigen zeitliche Gültigkeit und Provenienz. Graphiti erhält ersetzte Fakten historisch, statt sie zu löschen. ([GitHub][13])                                                                                                                         | Kein Graphsystem erforderlich, aber das Datenmodell sollte Evidenz, Claims, aktuellen Zustand und zeitliche Gültigkeit trennen.                                           |
| **Claude Routines und Hooks**            | Claude kann zeitgesteuert, per API oder auf Repository-Ereignisse reagieren; Trigger können kombiniert werden. Lifecycle-Hooks existieren pro Session, Turn und Tool-Aufruf. ([Claude Platform Docs][4])                                                                                                                                        | Technische Trigger-Infrastruktur ist vorhanden; für den fachlichen Prozess sollte trotzdem ein eigenes Domain-Event verwendet werden.                                     |

## 5.2 Wichtigste Erkenntnis aus den Vorbildern

Die direkt einschlägige Process-Discovery-Forschung bestätigt, dass LLMs besonders beim ersten strukturierten Entwurf und bei der Externalisierung von implizitem Wissen helfen. Sie zeigt aber zugleich Probleme bei Granularität, verteiltem Wissen, parallelen Prozessvarianten und semantischer Vollständigkeit. Die besten Ergebnisse entstehen, wenn die Agentenausgabe als hochwertiger Entwurf dient, den ein Prozessanalyst oder fachlicher Owner iterativ prüft. ([Springer][10])

Ihr solltet daher nicht versuchen, einen vollständig autonomen „Unternehmenswahrheits-Agenten" zu bauen. Der realistische autonome Teil ist:

- Gespräche klassifizieren,
- Claims extrahieren,
- bestehende Prozesse auffinden,
- Änderungen vorschlagen,
- Varianten und Konflikte erkennen,
- Dokumentation rendern,
- Tests ausführen,
- Review-Artefakte erzeugen.

Die Autorisierung konkurrierender oder kritischer fachlicher Aussagen bleibt zunächst menschlich.

---

# 6. Empfohlene Minimalarchitektur

## 6.1 Architektur

```text
┌─────────────────────────────┐
│ Discovery-Chat              │
│ Claude Agent SDK            │
└──────────────┬──────────────┘
               │
               │ ConversationProcessObservation
               │ + EvidenceRefs
               ▼
┌─────────────────────────────┐
│ SQLite / Datei-Outbox       │
│ documentation_jobs          │
└──────────────┬──────────────┘
               │ conversation.finalized
               ▼
┌─────────────────────────────┐
│ Reconciliation Agent        │
│                             │
│ liest:                      │
│ - Observation              │
│ - Catalog                  │
│ - bestehende Prozesse      │
│ - relevante Claims         │
│                             │
│ liefert: Zod Proposal       │
└──────────────┬──────────────┘
               ▼
┌─────────────────────────────┐
│ Deterministic Coordinator   │
│                             │
│ - Schema-Validierung        │
│ - Revision Check            │
│ - Scope-/Konfliktregeln     │
│ - Apply oder Review         │
└──────────────┬──────────────┘
               ▼
┌─────────────────────────────┐
│ Canonical Process JSON      │
│ + Claim Ledger              │
└──────────────┬──────────────┘
               ▼
┌─────────────────────────────┐
│ TypeScript Markdown Renderer│
│ + Index Generator           │
└──────────────┬──────────────┘
               ▼
┌─────────────────────────────┐
│ Git Branch → CI → Pull Req. │
└─────────────────────────────┘

Nightly:
replay failed jobs → full render → drift/link/orphan checks
```

## 6.2 Kein Message Broker erforderlich

Für den Prototyp reicht eine SQLite-Tabelle:

```sql
CREATE TABLE documentation_jobs (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    conversation_id TEXT NOT NULL,
    observation_id TEXT NOT NULL,

    status TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,

    created_at TEXT NOT NULL,
    started_at TEXT,
    completed_at TEXT,

    UNIQUE(event_type, observation_id)
);
```

Der Chat schreibt Beobachtung und Job möglichst in derselben Transaktion. Ein Bun-Worker pollt offene Jobs. Semantisch bleibt die Architektur ereignisgetrieben, auch wenn die technische Zustellung über eine lokale Jobtabelle statt Kafka oder Service Bus erfolgt.

## 6.3 Keine unnötige Multi-Agent-Orchestrierung

PKAI verwendet mehrere spezialisierte Agenten, weil es den gesamten Interview- und Formalisierungsprozess abbildet. Für eure nachgelagerte Dokumentationsschicht ist zunächst **ein Reconciliation-Agent** ausreichend.

Die übrige Dekomposition sollte in deterministische Komponenten erfolgen:

- Zod-Validierung,
- Prozess-ID-Auflösung,
- Scope-Vergleich,
- Revisionskontrolle,
- Rendering,
- Linkprüfung,
- Git-Operationen.

Ein zweiter Agent kann später als optionaler PR-Reviewer ergänzt werden. Er sollte jedoch kein Ersatz für Validierungscode oder fachliche Freigabe sein.

## 6.4 Eingang des Reconciliation-Agents

Der Agent sollte nicht jedes Mal das vollständige Unternehmens-Repository und alle Transkripte erhalten. Sein Kontext kann bestehen aus:

1. der neuen `ProcessObservation`,
2. dem kompakten `catalog.json`,
3. den zwei bis fünf wahrscheinlich passenden Prozessen,
4. den dazugehörigen offenen Claims und Konflikten,
5. den referenzierten Gesprächspassagen,
6. den Regeln zur Scope-, Varianten- und Konfliktbehandlung.

Der bereits vorhandene Discovery-Agent hat die Unterhaltung strukturiert. Die Dokumentationsschicht sollte diese Arbeit nicht erneut durchführen, sondern Beobachtungen konsolidieren.

## 6.5 Prozessidentität

Vor jeder Mutation muss entschieden werden:

```text
Neuer eigenständiger Prozess?
Bestehender Prozess?
Variante eines bestehenden Prozesses?
Teilprozess?
Unklar?
```

Bei eindeutiger Zuordnung wird ein Proposal erzeugt. Bei mehreren ähnlich wahrscheinlichen Treffern sollte das Ergebnis `unresolved_process_identity` sein. Es ist besser, einen kleinen Review-Fall zu erzeugen als einen nahezu identischen zweiten Unternehmensprozess anzulegen.

Hilfreiche Identitätsmerkmale:

- fachliches Ergebnis,
- Starttrigger,
- Domain,
- Owner,
- beteiligte Rollen,
- zentrale Systeme,
- Produkt und Kanal,
- bekannte Aliase.

## 6.6 PR-Inhalt

Ein guter Agenten-PR sollte nicht nur den Markdown-Diff enthalten:

```markdown
## Anlass

Discovery-Gespräch OBS-121 mit Rolle `claims-handler`.

## Erkannte Änderung

Neue Ausnahme für telefonisch gemeldete Auslandsschäden.

## Betroffene Artefakte

- `process-data/processes/claims.fnol-intake.json`
- `process-data/claims/claims.fnol-intake.jsonl`
- `docs/processes/claims/claims.fnol-intake.md`
- `docs/processes/claims/index.md`

## Provenienz

- Conversation: CONV-8841
- Messages: M-32 bis M-38
- Source hash: `sha256:...`

## Konfliktbewertung

Kein direkter Konflikt. Bestehender Prozess beschreibt bislang nur Portal und Inland.

## Review-Frage

Soll die Variante für Auslandsschäden für alle Produkte gelten oder nur für Kfz?
```

Damit kann ein Fachreviewer die Änderung beurteilen, ohne den gesamten Chat erneut lesen zu müssen.

## 6.7 Umgang mit mehreren offenen Änderungen

Um PR-Spam zu vermeiden:

- maximal ein offener Dokumentations-PR pro Prozess,
- weitere Beobachtungen werden gegen den Branch-Zustand konsolidiert,
- konkurrierende neue Beobachtungen werden im selben PR sichtbar,
- rein mechanische Maintenance-Änderungen können in einem Sammel-PR landen.

Mintlify verwendet ein ähnliches Muster für Wartungsautomationen: Neue Korrekturen werden einem bereits offenen PR hinzugefügt, statt für jede Kleinigkeit einen weiteren Review-Vorgang zu erzeugen. ([Mintlify][2])

---

# 7. Konkrete Empfehlung für euren Prototyp

## Phase 1: Saubere Grundarchitektur

Implementiert zunächst:

1. `ProcessObservation` als append-only Zod-Schema.
2. `CanonicalProcess` als separates Zod-Schema.
3. Ein minimales Claim-Modell mit Evidenzreferenzen.
4. `conversation.finalized` als Job in SQLite.
5. Einen Reconciliation-Agent mit Zod Structured Output.
6. Einen deterministischen Markdown-Renderer.
7. Einen Prozesskatalog und generierte Index-Dateien.
8. Einen PR für jede semantische Änderung.
9. Einen nächtlichen Full-Render- und Drift-Check.

Damit deckt ihr die Punkte Triggering, Korpusstruktur, Widersprüche, Provenienz und Datenkonsistenz bereits sauber ab.

## Phase 2: Review-Entlastung

Nach ausreichend realen Fällen:

- rein mechanische Änderungen automatisch mergen,
- bestätigende Evidenz ohne Prozessänderung automatisch speichern,
- wiederkehrende konfliktfreie Ergänzungen nach einem Risikoscore behandeln,
- fachliche Review-Rollen nach Prozessfeldern konfigurieren,
- Prozess-Owner und operative Experten unterschiedlich gewichten,
- Soll-, Ist-, Ausnahme- und lokale Varianten explizit im UI anzeigen.

## Phase 3: Weitergehende Autonomie

Erst später:

- automatische Konsolidierung mehrerer ähnlicher Beobachtungen,
- Stale-Process-Erkennung,
- gezielte Rückfragen an fehlende Rollen,
- Erkennung impliziter Prozessänderungen,
- unternehmensweite Konsistenzprüfungen über mehrere Prozesse,
- automatische Vorschläge für gemeinsame Teilprozesse.

---

# Schlussfolgerung

Der leichteste belastbare Ansatz ist **kein autonomer Markdown-Autor**, sondern ein kleiner ereignisgetriebener Konsolidierungs- und Publishing-Workflow:

```text
Gespräch
→ strukturierte Beobachtung
→ typisierte Claims
→ kanonischer Prozess
→ deterministisch erzeugtes Markdown
→ Git-Review
```

Dabei gelten fünf harte Regeln:

1. **Nicht nach jedem Turn arbeiten, sondern nach einem abgeschlossenen Gespräch.**
2. **Events für Aktualität, Cron für Reparatur und vollständige Konsistenz.**
3. **Gespräche sind Evidenz; Zod-Prozessobjekte sind der veröffentlichte Wahrheitsstand.**
4. **Markdown ist eine disposable Materialized View und wird nicht unabhängig bearbeitet.**
5. **Widersprüche werden als konkurrierende, provenance-behaftete Claims erhalten und nicht durch Last-Write-Wins verdeckt.**

Diese Architektur benötigt für den Prototyp nur **Git, Dateien, SQLite, Zod, einen Claude-Agent-Call und deterministischen TypeScript-Code**. Eine Vektor-, Graph- oder Wissensdatenbank ist dafür nicht erforderlich.

[1]: https://www.mintlify.com/docs/agent
[2]: https://www.mintlify.com/docs/workflows/reference
[3]: https://docs.anthropic.com/en/docs/claude-code/hooks
[4]: https://docs.anthropic.com/en/docs/claude-code/routines
[5]: https://arxiv.org/html/2509.24592v2
[6]: https://github.blog/ai-and-ml/github-copilot/github-copilot-coding-agent-101-getting-started-with-agentic-workflows-on-github/
[7]: https://www.langchain.com/blog/introducing-ambient-agents
[8]: https://learn.microsoft.com/en-us/azure/architecture/patterns/materialized-view
[9]: https://backstage.io/docs/features/techdocs/creating-and-publishing/
[10]: https://link.springer.com/article/10.1007/s12599-025-00976-w
[11]: https://docs.github.com/en/contributing/writing-for-github-docs/using-yaml-frontmatter
[12]: https://docusaurus.io/docs/next/sidebar/autogenerated
[13]: https://github.com/getzep/graphiti/blob/main/README.md
[14]: https://www.w3.org/TR/prov-o/
[15]: https://arxiv.org/abs/2606.01435
[16]: https://arxiv.org/html/2605.06527v1
[17]: https://code.claude.com/docs/en/agent-sdk/structured-outputs
[18]: https://github.com/terraform-docs/terraform-docs
[19]: https://link.springer.com/article/10.1007/s12599-025-00983-x
[20]: https://incident.io/changelog/post-mortems-upgrade
