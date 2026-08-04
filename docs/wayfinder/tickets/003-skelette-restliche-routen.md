# Skelette für die übrigen Routen und Dialoge

Karte: [Ladezustände und Navigationsgefühl](../map-loading-states.md)
Typ: `wayfinder:task`
Blockiert von: — (frei, [Ladevokabular](001-ladevokabular.md) ist geschlossen)
Bearbeiter: Claude
Status: geschlossen

## Question

Dieselbe Behandlung für alle übrigen Stellen, die eine ganze Fläche durch blanken Text
ersetzen. Wo greift das Vokabular unverändert, und wo passt es nicht?

Routen:

- `process-capture-page.tsx:191` — `{error || "Prozess wird geladen …"}`. Der Ladezustand
  ist hier zugleich der Fehlerzustand; beim Trennen fällt auf, dass ein Fehler kein
  Skelett sein darf.
- `settings-page.tsx:56` — `{error || "Einstellungen werden geladen …"}`, dasselbe Muster.
- `opportunity-discovery-page.tsx:70` — `Potenzialanalyse wird geladen …`, zentriert, ohne
  Spinner.
- `public-page-layout.tsx:48` — `Informationen werden geladen …` ersetzt den Rumpf von
  Impressum, Datenschutz und Nutzungshinweisen. Das sind öffentliche Seiten ohne
  Anmeldung; ob dort dieselbe Schwelle gilt, ist zu prüfen.

Dialoge — eigene Klasse, weil der Rahmen schon steht und nur der Inhalt fehlt:

- `document-preview-dialog.tsx:94` — `Datei wird geladen …` im `min-h-56`-Bereich, hat
  bereits `aria-live="polite"`.
- `instruction-preview-dialog.tsx:47` — `Anweisungen werden geladen …`, ebenfalls mit
  `aria-live`.

Regionale Ladezustände im Chat-Arbeitsbereich — beim Auflösen des Nebels hierher gezogen,
weil dieselbe Vokabularregel greift:

- `process-flow-diagram.tsx:255` — drei handgebaute `animate-pulse`-Divs. Werden `<Skeleton>`
  (Stufe 1, die Form steht fest).
- `process-flow-diagram.tsx:274` — schwebender Hinweis über dem Prozessbild.
- `process-tracker.tsx:47` und `:144`.

Die vorhandenen `aria-live`- und `role="status"`-Auszeichnungen sind das Vorbild:
`ProcessListTableSkeleton` (`process-list-table.tsx:173`) trägt `role="status"`,
`aria-busy` und einen `sr-only`-Text. Neue Skelette dürfen dahinter nicht zurückfallen.
