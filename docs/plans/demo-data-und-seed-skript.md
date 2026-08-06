# Demo-Daten, Seed-Skript und Test-Sidecar

## Goal

Drei Dinge, die zusammen das Testen und Tunen der gesamten Pipeline — Prozessaufnahme
bis Potenzialanalyse — schnell und reproduzierbar machen:

1. Ein Ordner `demo-data/` mit drei realistischen Prozessszenarien einer mittelgroßen
   deutschen Versicherung — je mit Dokumenten, einem spielbaren Drehbuch und
   maschinenlesbaren Antworten.
2. Ein Seed-Skript, das jede Arbeitskopie (Haupt-Checkout wie Worktree) mit frischen
   Prozessen aus diesen Szenarien füllt — automatisch beim Dev-Start, wenn der
   Workspace leer ist.
3. Ein schwebender **Sidecar** links im Aufnahme-Flow, der die vorbereiteten Antworten
   und Dateien des passenden Szenarios anbietet — ein Klick füllt den Composer bzw.
   lädt die Datei hoch, statt alles von Hand zu tippen.

Zweck ist das Tuning: `freezeContracts()` friert Prompt und Schema pro Prozess ein —
sowohl in der Chat-Aufnahme (`chat-capture-repository.ts:39-105`) als auch in der
Potenzialanalyse (`opportunity-discovery-repository.ts:201-224`). Jede Promptänderung
wirkt nur auf **neu angelegte** Prozesse; jede Tuningrunde braucht also einen frischen
Prozess mit identischem Ausgangsmaterial, sonst vergleicht man zwei Änderungen
gleichzeitig.

## Locked Decisions

### Sprache: ausschließlich Deutsch

Der kuratierte Korpus unter `~/Downloads/agentic_process_documentation_starter_corpus`
wird **nicht** übernommen. Er ist zu 100 % englisches US-/UK-Behördenmaterial ohne jeden
Versicherungsbezug — geprüft über alle 15 textführenden Dateien. Entscheidung des
Auftraggebers: kein englisches Material im Repository.

Alle Dokumente sind deutsch und selbst geschrieben. Fachbegriffe so, wie sie im Haus
tatsächlich fallen (Storno, Regulierung, Deckungsprüfung, Vorgang), ohne künstliche
Anglisierung. Keine realen Personen-, Vertrags- oder Schadendaten — ausschließlich
erfundene Namen, Nummern und Beträge.

### Seeding geht durch die Repository-Schicht, nicht durch HTTP

`apps/server/src/index.ts:84` legt `requireSession` vor alle `/api/*`-Routen. Ein
HTTP-Seed bräuchte Anmeldedaten; die liegen im 1Password-Eintrag des Auftraggebers und
werden von keinem Skript und keinem Agenten angefasst.

Das Skript importiert stattdessen `ProcessCaptureRepository` direkt und ruft `create()`
und `saveUpload()`. Kein laufender Server nötig, keine Portannahme, und `saveUpload()`
führt weiterhin die echte Magic-Byte- und OOXML-Strukturprüfung aus
(`process-capture-repository.ts:136-177`) — ein Demo-Dokument, das ein echter Upload
ablehnen würde, scheitert also auch beim Seeden.

### Pro Arbeitskopie automatisch, weil `workspace/` cwd-relativ ist

`workspacePath()` (`apps/server/src/launcher.ts:24-26`) löst nach
`process.cwd()/workspace` auf — jede Worktree hat damit von selbst ihren eigenen,
gitignorierten Workspace. `scripts/dev.ts` prüft künftig beim Start: liegt unter
`workspace/process-captures/` kein Prozess, laufen alle Szenarien einmal durch das
Seed-Skript. `DEMO_SEED=0` schaltet das ab. Manuell bleibt `bun run seed` für frische
Tuningrunden.

**Voraussetzung, die mit erledigt wird:** `apps/web/vite.config.ts` proxied `/api` fest
auf `127.0.0.1:3210`. Läuft eine zweite Worktree, weicht deren Server auf einen
Zufallsport aus (`launcher.ts:35-57`), ihr Vite zeigt aber weiter auf 3210 — die
Oberfläche der zweiten Worktree bedient **stillschweigend den Workspace der ersten**.
`scripts/dev.ts` wählt deshalb künftig selbst einen freien Serverport, setzt `PORT` und
reicht das Ziel als Env an Vite durch; der Proxy-Eintrag liest es aus. Ohne diesen Fix
wäre „pro Worktree geseedet" eine Illusion.

### Der Sidecar liest die Szenarien vom Server, nicht aus dem Bundle

Neue authentifizierte Route `GET /api/demo/szenarien` (hinter `requireSession`, wie
alles andere), die `demo-data/szenarien/` von der Platte liest — cwd-relativ, dasselbe
Muster wie `defaults/`. Dazu `GET /api/demo/szenarien/:slug/dateien/:name` für die
Dateibytes, damit der Sidecar sie als `File` an den normalen Upload-Endpunkt geben
kann. Fehlt der Ordner (z. B. ein Deployment ohne Demo-Daten), liefert die Route leer
und der Sidecar erscheint gar nicht — kein eigener Env-Schalter, kein Dev-Flag.

### Sidecar-Verhalten: einfüllen, nicht automatisch abschicken

Beide Aufnahme-Seiten halten den gesamten Entwurfszustand auf Seitenebene
(`process-chat-page.tsx:164-167`, `process-capture-page.tsx:35-39`) — der Sidecar
braucht keine Komponentenchirurgie, nur die vorhandenen Setter:

- **Chat**: Klick auf eine Drehbuch-Antwort setzt sie in den Composer (`setText`);
  abgeschickt wird wie immer von Hand. So bleibt jeder Zug editierbar — halb tippen,
  halb klicken ist beim Tuning der Normalfall. Klick auf eine Datei baut aus den
  Server-Bytes ein `File` und geht durch `api.upload()` — derselbe Pfad wie ein echter
  Upload.
- **Formular**: ein Knopf „Antworten einfüllen" befüllt alle Themenfelder und
  Arbeitsmerkmale auf einmal, wenn das Szenario einen `formular`-Block mitbringt.
- **Zuordnung**: Der Sidecar wählt das Szenario vor, dessen `cover.processName` zum
  offenen Prozess passt; ein Dropdown erlaubt jederzeit den Wechsel — damit
  funktioniert er auch an Prozessen, die von Hand angelegt wurden.
- Links schwebend, einklappbar, per Voreinstellung eingeklappt; kollidiert auf dem
  Desktop nicht mit dem rechten Prozessbild-Rail (Chat-Spalte beginnt bei
  `col-start-1`, der Sidecar schwebt als Overlay davor).

### Antworten maschinenlesbar, Erwartungen menschenlesbar — ohne Duplikat

Je Szenario zwei Dateien mit klarer Arbeitsteilung: `drehbuch.json` hält die wörtlichen
Zug-für-Zug-Antworten der Persona (die der Sidecar anbietet), `DREHBUCH.md` hält
Persona, Erwartungen je Zug und Fehlersignaturen — und referenziert die Züge nur per
Nummer, statt die Antworten zu wiederholen. So gibt es keine zwei Kopien, die
auseinanderlaufen können.

### Dokumentformate: Markdown/CSV/TXT als Quelle, PDF bei Bedarf erzeugt

Im Repository liegen alle Dokumente als Text — lesbar, diffbar, die Tuningfläche.
Als `pdf` markierte Quellen werden über Headless Chrome gerendert (Muster aus
`scripts/generate-icons.ts`): beim Seeden fürs Anhängen, in der Demo-Route beim ersten
Abruf mit Cache unter `demo-data/.cache/` (gitignoriert). CSV und TXT gehen unverändert
durch. DOCX/XLSX/PPTX bleiben außen vor — keine Bibliothek vorhanden, handgebautes
OOXML über `fflate` lohnt für einen Formattest nicht.

### Fiktives Unternehmen: LifeCorp, zwei Personas

Alle Szenarien spielen bei der **LifeCorp Versicherung** — einem erfundenen
mittelgroßen deutschen Versicherer. `demo-data/UNTERNEHMEN.md` beschreibt das Haus
einmal zentral: Größe, Sparten, Organisationsstruktur und vor allem eine **erfundene
Systemlandschaft mit festen Namen**, die in allen Dokumenten und Drehbuch-Antworten
identisch verwendet wird — genau die Konsistenz, an der sich beim Tuning ablesen lässt,
ob Systeme korrekt zugeordnet werden. E-Mail-Adressen nutzen die reservierte Domain
`lifecorp.example`, damit nichts Reales getroffen werden kann.

Zwei Personas:

- **Edda Brandt** — Fachbereichs-Mitarbeiterin, die Interviewte. Sie ist in allen drei
  Drehbüchern die Stimme des Fachbereichs (`cover.participantName`); je Szenario
  wechselt nur ihr Aufgabengebiet. Das README benennt das offen: Edda steht
  stellvertretend für den Fachbereich, nicht für eine einzelne Stelle. Sie antwortet
  so knapp und lückenhaft, wie echte Sachbearbeiterinnen antworten.
- **Florian Weigel** — AI-Enabler. Er legt Prozesse an, führt die Tuningrunden durch
  und bewertet die Ergebnisse. README und die Erwartungsabschnitte der Drehbücher sind
  an ihn adressiert; der Sidecar ist sein Werkzeug.

### Drei Szenarien mit je eigenem Tuningziel

Nicht drei Varianten desselben Falls, sondern drei verschiedene Belastungen:

1. **Kfz-Glasschaden-Regulierung** (Fachbereich `Schaden`) — der saubere Fall. Drei
   sich ergänzende Dokumente, klarer Ablauf. Prüft die Grundleistung: Schritte in
   richtiger Reihenfolge und Granularität, Rollen und Systeme korrekt,
   `documentCoverage` auf `complete`.
2. **Beitragsanpassung Bestandsvertrag** (Fachbereich `Vertrag`) — der widersprüchliche
   Fall. Ältere Verfahrensanweisung und neueres Besprechungsprotokoll widersprechen
   sich in zwei Punkten, ein dritter steht in keinem Dokument. Prüft, ob der Assistent
   den Widerspruch bemerkt und nachfragt, statt still eine Fassung zu bevorzugen.
3. **Provisionsabrechnung Außendienst** (Fachbereich `Vertrieb`) — der undokumentierte
   Fall. Keine Dokumente, `documentGate` auf `skipped`, reine Gesprächsaufnahme. Prüft
   die Gesprächsführung ohne Textstütze.

### Die Potenzialanalyse wird ohne Chat-Durchlauf tunebar

Die Potenzialanalyse startet erst nach Chat-Bestätigung (`chat-captures.ts:250`) und
konsumiert das bestätigte Prozessverständnis (`opportunity-discovery.ts:164-211`). Wer
nur ihre Prompts tunt, soll nicht jedes Mal zwanzig Chat-Züge spielen müssen: das
Kfz-Glasschaden-Szenario bekommt zusätzlich ein handgeschriebenes, realistisches
`verstaendnis.json`, und `bun run seed kfz-glasschaden --stufe bestaetigt` legt den
Prozess direkt im Zustand `confirmed` mit diesem Verständnis an (Fixture-Muster aus
`tests/process-fixtures.ts`). Danach genügt „Potenzialanalyse starten" im UI. Alle
`DREHBUCH.md` erhalten außerdem einen Abschnitt mit Erwartungen an Hypothesen und
Szenarien der Analyse — damit auch dieser Teil der Pipeline reproduzierbar bewertet
wird.

## Files To Change

### Neu: `demo-data/`

```text
demo-data/
  README.md                        Zweck, Aufbau, wie eine Tuningrunde läuft (für Florian)
  UNTERNEHMEN.md                   LifeCorp: Haus, Sparten, Systemlandschaft, Personas
  szenarien/
    kfz-glasschaden/
      szenario.json                Deckblatt, Modus, Dokumentenliste, formular-Block
      drehbuch.json                Zug-für-Zug-Antworten für den Sidecar
      DREHBUCH.md                  Persona, Erwartungen je Zug, Fehlersignaturen,
                                   Erwartungen an die Potenzialanalyse
      verstaendnis.json            bestätigtes Verständnis für --stufe bestaetigt
      dokumente/
        arbeitsanweisung-glasschaden.md    -> PDF bei Bedarf
        fallliste-glasschaden.csv
        systemhinweise-clearing.txt
    beitragsanpassung/
      szenario.json
      drehbuch.json
      DREHBUCH.md
      dokumente/
        verfahrensanweisung-beitragsanpassung.md   -> PDF bei Bedarf
        protokoll-fachrunde.md
    provisionsabrechnung/
      szenario.json
      drehbuch.json
      DREHBUCH.md                  (ohne dokumente/ — bewusst)
```

`szenario.json`: `slug`, `titel`, `cover` (`department` aus
`defaults/process-capture-config.json:4-12`, `participantName` = „Edda Brandt",
`participantEmail` = `edda.brandt@lifecorp.example`, `processName`),
`interactionMode`, `dokumente[]` mit `quelle`, `zielname`, `format`
(`pdf` | `csv` | `txt` | `md`), optional `formular` (Themenantworten +
Arbeitsmerkmale). Das Zod-Schema dazu lebt einmal in
`apps/server/src/demo-scenarios.ts` (Loader + Schema) und wird von Seed-Skript,
Demo-Route und Test gemeinsam importiert.

### Neu: `scripts/seed-demo-process.ts`

- `bun run seed --list` listet die Szenarien; `bun run seed <slug>` legt einen Prozess
  an und hängt die Dokumente an; `bun run seed --alle` alle drei.
- `--stufe bestaetigt` (nur wo `verstaendnis.json` existiert) legt den Prozess direkt
  bestätigt an.
- Gibt Prozess-ID, URL und Drehbuchpfad aus; bricht klar ab, wenn ein Dokument die
  Uploadprüfung nicht besteht.

### Neu: `apps/server/src/routes/demo.ts`

`GET /api/demo/szenarien` (Liste inkl. Drehbuch-Zügen) und
`GET /api/demo/szenarien/:slug/dateien/:name` (Bytes, PDF-Rendering mit Cache).
Registriert hinter `requireSession`. Fehlender Ordner → leere Liste.

### Neu: `apps/web/src/components/demo-sidecar.tsx`

Schwebendes, einklappbares Panel links; Szenario-Dropdown mit Vorauswahl per
`processName`; Antwortliste (Klick → Composer), Dateiliste (Klick → Upload),
Formular-Befüllung. Eingebunden in `process-chat-page.tsx` und
`process-capture-page.tsx`; erscheint nur, wenn die Demo-Route Szenarien liefert.
Eigenständige Komponente **neben** `components/ui/` (shadcn-Grenze), semantische
Typo-Skala, deutsche Texte.

### Neu: `tests/demo-data.test.ts`

Ohne Prozessanlage: jedes `szenario.json` parst gegen das gemeinsame Schema, jede
referenzierte Quelldatei existiert, `department` steht in der Konfiguration, maximal
fünf Dokumente, `drehbuch.json` und `DREHBUCH.md` vorhanden, `verstaendnis.json` (wo
vorhanden) parst gegen das Verständnis-Schema aus `packages/domain`.

### Geändert

- `package.json` — `"seed": "bun run scripts/seed-demo-process.ts"`.
- `scripts/dev.ts` — freien Serverport wählen, `PORT` setzen, Proxy-Ziel als Env an
  Vite durchreichen; Auto-Seed bei leerem `workspace/process-captures/`
  (`DEMO_SEED=0` schaltet ab).
- `apps/web/vite.config.ts` — Proxy-Ziel aus Env statt Literal (Fallback bleibt 3210).
- `apps/server/src/index.ts` — Demo-Routen registrieren.
- `.gitignore` — `demo-data/.cache/`.
- `AGENTS.md` — Abschnitt zu `demo-data/`: Zweck, ausschließlich erfundene Daten,
  Quelle für Tuningrunden, Sidecar-Verhalten.

## Verification

- `./scripts/qa all` grün (Format, Lint, Typecheck, Test, Build).
- `bun run seed --list` zeigt drei Szenarien; alle drei geseedet: Prozess in der
  Liste, Uploads sichtbar, PDF öffnet in der Dokumentvorschau.
- Frische Worktree: `bun run dev` seedet automatisch; zwei parallel laufende
  Arbeitskopien bedienen nachweislich getrennte Workspaces (Ports geprüft).
- Sidecar im Browser: erscheint am geseedeten Chat-Prozess mit vorgewähltem Szenario,
  Klick füllt den Composer, Datei-Klick landet als Upload am Prozess; an einem
  Formular-Prozess füllt „Antworten einfüllen" alle Felder.
- `--stufe bestaetigt` geseedet, Potenzialanalyse gestartet, Hypothesen erscheinen.
- Ein Szenario per Drehbuch bis zu einem gültigen Zwischenstand durchgespielt.

## Acceptance Criteria

- `demo-data/` enthält kein englisches Dokument und keine realen Daten; Firma
  (LifeCorp), Personas und Systemnamen sind über alle Szenarien und Dokumente
  konsistent.
- Eine frische Arbeitskopie ist nach `bun run dev` ohne weiteren Handgriff mit drei
  realistischen Prozessen benutzbar; Zugangsdaten braucht keins der Skripte.
- Im Chat eines geseedeten Prozesses ist jeder Drehbuch-Zug mit einem Klick im
  Composer; die Dokumente des Szenarios sind mit einem Klick hochgeladen.
- Die Potenzialanalyse ist ohne Chat-Durchlauf tunebar (`--stufe bestaetigt`).
- Jedes Szenario ist allein anhand seines `DREHBUCH.md` von jemand anderem spielbar;
  die drei Szenarien belasten drei verschiedene Stellen (sauber, Widerspruch,
  dokumentenlos).

## Offen, bewusst nicht enthalten

- DOCX/XLSX/PPTX als Uploadformate (handgebautes OOXML über `fflate` — lohnt erst,
  wenn die Dokumentverarbeitung selbst getunt wird).
- Ein Szenario an der Fünf-Dateien- oder 20-MB-Grenze (prüft die Uploadschicht, nicht
  die Instruktionen — gehört in `tests/`).
- Automatisiertes Durchspielen der Drehbücher (Skript spielt den Chat gegen die API)
  — wertvoll, aber erst, wenn sich die manuellen Tuningrunden eingespielt haben.
- Verständnis-Fixtures für alle drei Szenarien; zunächst nur Kfz-Glasschaden.
