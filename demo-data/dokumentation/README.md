# Seeddaten der lebenden Prozessdokumentation

Diese Dateien füllen die Prozessdokumentation mit erfundenen, aber realistischen
Inhalten der **LifeCorp Versicherung**, damit sich Übersicht, Einzeldokumente,
Verlauf, Diffs und Rücknahmen von Hand durchklicken lassen. Sie enthalten
ausschließlich erfundene Daten; Systemnamen und Personas stammen aus
[`../UNTERNEHMEN.md`](../UNTERNEHMEN.md).

## Seed ausführen

```sh
bun run seed:docs --list   # nur anzeigen, was vorhanden ist
bun run seed:docs          # in den aktuellen Workspace einspielen
```

Der Seed ist **additiv** und überspringt jede Datei, deren Prozesstitel bereits
im Workspace existiert. Für einen sauberen Ausgangszustand vorher zurücksetzen:

```sh
bun run scripts/reset-workspace.ts ZURÜCKSETZEN
```

Alle Commits entstehen über die produktiven Pfade der Anwendung
(`finalizeChatCapture` → `confirm` → `syncProcess`, für Revisionen
`correctUnderstanding` → `confirm` → `syncProcess`, für Rücknahmen `revert`).
In `workspace/docs` wird nichts von Hand geschrieben — der Archivstand ist
genau das, was die Anwendung selbst erzeugt. Damit die Historie eine Zeitachse
zeigt, friert der Seed Uhr und Git-Datum je Ereignis auf das im Fixture
angegebene Datum ein.

## Was der Seed erzählt

Acht Prozesse aus sechs Fachbereichen, bestätigt zwischen Januar und Juni 2026:

| Datei                                    | Fachbereich | Besonderheit                                             |
| ---------------------------------------- | ----------- | -------------------------------------------------------- |
| `betrugspruefung-schadenmeldungen`       | Schaden     | Ermessensentscheidung im Graphen, Revision im April      |
| `leitungswasserschaden-wohngebaeude`     | Schaden     | vollständig — ohne Wissenslücken, Qualität `complete`    |
| `beitragsanpassung-wohngebaeude`         | Vertrag     | Revision im Mai, **im Juli zurückgenommen**              |
| `bestandsuebertragung-leben`             | Vertrag     | trägt einen echten Widerspruch zwischen zwei Auskünften  |
| `vermittler-onboarding`                  | Vertrieb    | Revision im Juni                                         |
| `rueckversicherungsabrechnung-quartal`   | Finanzen    | Verzweigung nach fachlichem Ermessen                     |
| `stoerungsannahme-anwendersupport`       | IT          | Abbruchzweig: Abgabe an die Fachgruppe endet den Prozess |
| `bewerbermanagement-ausbildungsjahrgang` | Personal    | linearer Ablauf ohne Verzweigung                         |

Die Rücknahme bei `beitragsanpassung-wohngebaeude` lässt das Archiv bewusst vom
Quellstand abweichen — so hat der Abgleich in den Einstellungen etwas zu tun.

## Dateiformat

Geschrieben wird nur der deutsche Fachtext. Alles Mechanische — Kennungen,
Provenienz, Konfidenzen, Evidenzverdrahtung und der Ablaufgraph — leitet
[`../../scripts/documentation-fixtures.ts`](../../scripts/documentation-fixtures.ts)
daraus ab. Das Ergebnis durchläuft dieselbe Prüfung wie ein echtes
Syntheseergebnis (`processUnderstandingSchema`, `validateProcessFlow`);
`tests/documentation-seed.test.ts` hält das für jede Fassung fest.

- `belege` — die Gesprächsäußerungen. Sie werden als Chat-Nachrichten angelegt
  und sind die einzige zulässige Evidenzquelle.
- Inhaltsfelder (`zweck`, `ausloeser`, … `verbesserungsziele`) — entweder direkt
  der Wert oder `{ "wert": …, "belege": ["b1"], "konfidenz": 90 }`. Ohne Belege
  gilt eine Angabe als abgeleitet (`ai_inferred`), mit Belegen als genannt
  (`user_stated`).
- `schritte` — ein bis acht Schritte; daraus entsteht die lineare Kette des
  Ablaufgraphen.
- `verzweigung` — höchstens eine je Prozess. `nachSchritt` bestimmt, wo das Gateway
  sitzt; `ziel` verweist auf eine Schrittnummer oder `"ende"`.
- `revisionen` — je Eintrag ein neuer Bestätigungsstand: `aenderung` ersetzt
  einzelne Inhaltsfelder, `notiz` wird zur Korrekturnachricht. Ein gesetztes
  `zurueckgenommenAm` erzeugt zusätzlich einen Gegen-Commit im Archiv.

Der Slug muss dem Dateinamen entsprechen, `erstelltAm` vor `bestaetigtAm` liegen
und Revisionsdaten müssen streng aufsteigen — der Seed prüft das beim Einlesen.
