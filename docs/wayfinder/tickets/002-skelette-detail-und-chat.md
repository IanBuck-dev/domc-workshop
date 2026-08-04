# Skelette für Prozessdetail und Chat

Karte: [Ladezustände und Navigationsgefühl](../map-loading-states.md)
Typ: `wayfinder:task`
Blockiert von: — (frei, [Ladevokabular](001-ladevokabular.md) ist geschlossen)
Bearbeiter: Claude
Status: geschlossen

## Question

Die beiden Routen, zwischen denen der Wechsel den ungestylten Text sichtbar macht:
`/processes/:id` und `/processes/:id/chat`. Wie sehen ihre Skelette aus, und was zeichnet
sich sofort?

Bekannter Ausgangszustand:

- `process-detail-page.tsx:65` — `if (!process) return <main className="app-loading">Prozess
wird geladen …</main>;`. Vorher wird **nichts** gezeichnet: kein Zurück-Link, kein Titel,
  keine Kartenrahmen.
- `process-detail-page.tsx:42-54` holt `Promise.all([api.process(id),
api.opportunitySummaries()])`. Die Seite wartet damit auf die **langsamere** der beiden
  Anfragen, obwohl der Kopfbereich nur `process` braucht. Das ist unabhängig vom Skelett
  ein Fehler im Aufbau und gehört hierher.
- `process-chat-page.tsx:401` — `if (!view) return <main className="app-loading">Gespräch
wird geladen …</main>;`. Ersetzt den kompletten dreispaltigen Arbeitsbereich. Die Daten
  kommen als ein großer `View` aus `api.chat(id)`, deshalb springt das Layout auf einmal
  ins Bild.
- `process-chat-page.tsx:85-97` — `useDesktop()` liest `window.matchMedia` synchron. Die
  Layoutbreite steht also **vor** den Daten fest; die Hülle könnte sofort gezeichnet werden.

Mit dem Abschluss verschwinden zwei der drei Verwendungen der undefinierten Klasse
`app-loading`. Die dritte (`app.tsx:44`) gehört zu
[Erster Bildaufbau](005-erster-bildaufbau.md); die Klasse ist erst weg, wenn beide fertig
sind — wer zuletzt geht, prüft mit einem Grep nach.
