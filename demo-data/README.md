# Demo-Daten

Dieser Ordner liefert realistische Demo-Daten und reproduzierbare
Tuningrunden für die Prozessaufnahme und die Potenzialanalyse. Adressiert an
Florian (bzw. jeden, der die App testet oder tunt).

Alle fachlichen Annahmen zum Demo-Versicherer beginnen im zentralen
[`LIFECORP.md`](../LIFECORP.md).

## Warum das nötig ist

Die App friert Prompts und Schemas pro Prozess ein („Contract Freeze") —
sowohl in der Chat-Aufnahme als auch in der Potenzialanalyse. Eine
Promptänderung wirkt deshalb nur auf **neu angelegte** Prozesse, nicht auf
bestehende. Wer eine Tuningrunde fährt, braucht also jedes Mal einen frisch
geseedeten Prozess mit identischem Ausgangsmaterial — sonst vergleicht man
am Ende zwei Änderungen gleichzeitig, ohne es zu merken.

`bun run seed:showcase` erzeugt in einem leeren Workspace den vollständigen
Präsentationsstand mit 14 bestätigten Prozessen und vier bewusst fortsetzbaren
Aufnahmezuständen. `bun run seed:showcase --list` zeigt die feste Reihenfolge,
ohne Daten anzulegen.

## Aufbau

```text
demo-data/
  UNTERNEHMEN.md         Unternehmensprofil, Systemnamen und Personas
  ORGANISATION.md        Teams, Rollen und Übergaben
  DATENQUELLEN.md        Systeme, Quellen, Kanäle und Dateiformate
  MODELLIERUNGSRAHMEN.md Pflichtangaben für jeden Demo-Prozess
  PROZESSPORTFOLIO.md    Zielauswahl und gewünschter Potenzial-Mix
  ABNAHMEMATRIX.md       Seed-Tiefe, UI-Zustand und Abnahme je Prozess
  showcase.json          Maschinenlesbare Reihenfolge und Sollzustände
  szenarien/
    <slug>/
      szenario.json      Deckblatt (Fachbereich, Beteiligte, Prozessname),
                          Dokumentenliste, optional ein formular-Block
      drehbuch.json       Wörtliche Zug-für-Zug-Antworten der Persona,
                          füttert den Sidecar in der App
      DREHBUCH.md          Persona, Erwartungen je Zug, Fehlersignaturen
      dokumente/          Quellen als Markdown/CSV/TXT — als `pdf`
                          markierte Dokumente werden beim Seeden bzw. beim
                          ersten Abruf gerendert
      verstaendnis.json   (optional) bestätigtes Prozessverständnis für
                          `--stufe bestaetigt`
      aufnahme.json       (optional) kompakte Quelle für einen vorbereiteten
                          Showcase-Prüfstand
```

`drehbuch.json` und `DREHBUCH.md` haben bewusst eine klare Arbeitsteilung:
`drehbuch.json` hält die Antworten, `DREHBUCH.md` referenziert sie nur per
Zugnummer. So gibt es keine zwei Kopien, die auseinanderlaufen können.

## Wie eine Tuningrunde läuft

1. Prompt unter `defaults/prompts/` ändern.
2. `bun run seed <slug>` (oder `bun run seed --alle` für alle Szenarien).
3. Den Prozess im Browser öffnen und mit dem Sidecar das Drehbuch
   Zug für Zug durchspielen.
4. Das Ergebnis gegen die Erwartungen im jeweiligen `DREHBUCH.md` halten.

Für die Potenzialanalyse muss nicht jedes Mal der ganze Chat gespielt werden:
`bun run seed kfz-glasschaden --stufe bestaetigt` legt den Prozess direkt im
Zustand `confirmed` mit einem vorbereiteten Prozessverständnis an — danach
genügt „Potenzialanalyse starten" im UI.

`bun run seed:docs` legt zusätzlich für den Präsentationsfall
`SCH-01 · Leitungswasserschaden Wohngebäude regulieren` vier fachlich ausgearbeitete
Potenzialhypothesen, drei Aufsichtsszenarien und eine abgeschlossene
Potenzialbewertung an. Das ist ein ausdrücklich gekennzeichneter,
deterministischer Demo-Seed: Er ruft keine KI auf und dient der reproduzierbaren
Web-, Export- und Videoprüfung. Der normale Produktfluss erzeugt dieselben
Datensätze weiterhin genau einmal über den konfigurierten KI-Provider.

## Die sechs Aufnahmeszenarien

- **kfz-glasschaden** (Fachbereich Schaden) — der saubere Fall: klarer
  Ablauf, drei sich ergänzende Dokumente. Tuningziel: Grundleistung prüfen —
  Schritte, Rollen und Systeme korrekt erkannt, `documentCoverage`
  auf `complete`.
- **beitragsanpassung** (Fachbereich Vertrag) — der widersprüchliche Fall:
  zwei Dokumente widersprechen sich. Tuningziel: bemerkt der Assistent den
  Widerspruch und fragt nach, statt still eine Fassung zu bevorzugen?
- **provisionsabrechnung** (Fachbereich Vertrieb) — der dokumentenlose Fall:
  keine Dokumente, reine Gesprächsaufnahme. Tuningziel: Gesprächsführung ohne
  Textstütze.
- **leitungswasserschaden-wohngebaeude** (Fachbereich Schaden) — der
  Präsentationsfall für Versicherungsmanagement: hoher Eingang, heterogene
  Unterlagen, Gutachtersteuerung, professionelles Urteil, Fristen und
  kontrollierte Übergaben. Tuningziel ist die komplette Strecke bis zum
  agentischen Szenario und zu beiden Excel-Artefakten.
- **einbruchdiebstahl-hausrat** (Fachbereich Schaden) — ein bereits
  begonnener Chat mit ausgewählter Checkliste und zwei gespeicherten Zügen.
- **bezugsrechtsaenderung-leben** (Fachbereich Vertrag) — ein fertiges
  Prozessbild, das bewusst noch auf die menschliche Prüfung wartet.

## Automatisches Seeding beim Dev-Start

Ist `workspace/process-captures/` beim Start von `bun run dev` leer, wird der
vollständige Showcase einmal automatisch angelegt. `DEMO_SEED=0` schaltet das
ab. Für gezielte Tuningrunden bleibt `bun run seed` manuell nutzbar.

## Warnung

Ausschließlich erfundene Daten. Niemals reale Kunden-, Vertrags- oder
Schadendaten in diesem Ordner ablegen.
