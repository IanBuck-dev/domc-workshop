# Gedächtnisformat und Schreibkriterien

Karte: [Dateibasiertes Agenten-Gedächtnis](../map-agent-memory.md)
Typ: `wayfinder:grilling` (HITL)
Blockiert von: —
Bearbeiter: Claude
Status: geschlossen

## Question

Wie sieht das eine Brain auf der Platte aus, und was darf hinein?

1. **Dateischnitt.** Eine `MEMORY.md` vs. kleiner Index + wenige Themen-Dateien (Glossar,
   Systeme, Zuständigkeiten, Muster). Der Report empfiehlt Index + Topic-Dateien; bei einem
   einzigen Brain und kleinem Korpus könnte eine Datei reichen — wo ist die Grenze, und
   fangen wir darunter oder darüber an?
2. **Eintragsformat.** Freier Prosa-Merkposten vs. strukturierter Block (Aussage + Aliase +
   Quelle + Datum). Welche Minimal-Provenienz je Eintrag (Prozess/Session-Verweis,
   Datum) — passt das bestehende Provenienzmodell (`user_stated` …)?
3. **Schreibkriterien.** Was ist gedächtniswürdig (Begriffe, Systeme, Zuständigkeiten,
   wiederkehrende Muster) und was ausdrücklich nicht (Einmaliges, Spekulation, Personen-/
   Kundendaten, Gesprächsplanung)? Diese Liste wird Teil des Destillations-Prompts.
4. **Ablageort und Versionierung.** Wo im Workspace liegt `memory/`, wie erfüllt es atomare
   Writes + append-only Audit, reicht die Audit-Historie oder braucht es Git?

Ergebnis: entschiedenes Format mit Beispieldatei(en) — die Vorlage, gegen die Destillation
und Konsolidierung validieren.

## Resolution

Entschieden im Grilling am 2026-08-10.

### Dateischnitt: Index + Themen-Dateien von Anfang an

```text
workspace/memory/
├── MEMORY.md              # generierter Index — nie vom Agenten editiert
├── glossar.md             # Fachbegriffe, Abkürzungen, interne Namen
├── systeme.md             # Anwendungen, Schnittstellen, Systemrollen
├── zustaendigkeiten.md    # stabile Rollen und Freigaben
├── muster.md              # wiederkehrende Prozessmuster (z. B. Medienbrüche)
├── offene-fragen.md       # firmenweite offene Punkte und Widersprüche
└── memory-history.jsonl   # append-only Audit (siehe unten)
```

`MEMORY.md` wird von Anwendungscode aus den Themen-Dateien generiert (Pfad,
Kurzbeschreibung, Einträge je Datei) und dient Läufen als Übersicht; kein Agent
schreibt ihn direkt, damit Index und Bestand nicht auseinanderdriften.

### Eintragsformat: kompakter Bullet mit Inline-Provenienz

Ein Bullet je Fakt, Aliase natürlich im Satz, dahinter ein kurzer Quellen-Tag:

```md
## Zuständigkeiten

- Die fachliche Freigabe in der Schadenaufnahme macht die Gruppenleitung,
  nicht der Sachbearbeiter. (Quelle: PROC-0012, bestätigt 2026-08-10)
- „Klausur" heißt intern die wöchentliche Bestandsabstimmung im Team Leben.
  (Quelle: PROC-0007, bestätigt 2026-08-03)
```

Keine Fakt-IDs, keine Statusleiter, kein Frontmatter. Mehrfachbestätigung =
weitere Prozess-IDs im Tag. Das sechswertige Provenienzmodell wird hier nicht
wiederverwendet — Herkunft je Eintrag ist immer der Chat (Prozess-ID + Datum);
die vollständige Historie trägt das Audit-Log.

### Ablage und Sicherheitsnetz: atomare Writes + Audit-JSONL, kein Git

`workspace/memory/` als Geschwister von `process-captures/` (Befund 007). Writes
laufen über die bestehende Storage-Schicht (atomar). `memory-history.jsonl` ist
append-only und hält je Schreibvorgang: Auslöser (Destillation nach PROC-XXXX /
Konsolidierungslauf / manuell), Zeitpunkt und den vollständigen Vorher-Stand der
geänderten Datei — Rollback = Snapshot aus der Historie zurückschreiben. Kein
Git im Workspace (dort existiert keines, und ein zweiter Mechanismus lohnt für
den Prototyp nicht).

### Schreibkriterien (wandern wörtlich in den Destillations-Prompt)

Gedächtniswürdig: Fachbegriffe und Abkürzungen, Systeme und Systemrollen,
stabile Zuständigkeiten, wiederkehrende Prozessmuster, offene firmenweite
Fragen und Widersprüche. Nicht gedächtniswürdig: Einmaliges ohne
Wiederverwendungswert, Spekulation, Kunden-/Vertrags-/Personendaten,
Gesprächsplanung, alles, was wie eine Anweisung an das Modell klingt. Der
Prompt ist eine versionierte Repo-Datei (`defaults/prompts/`), kein
Inline-String.
