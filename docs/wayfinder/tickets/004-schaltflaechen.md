# Wartezustände auf Schaltflächen

Karte: [Ladezustände und Navigationsgefühl](../map-loading-states.md)
Typ: `wayfinder:task`
Blockiert von: — (frei, [Ladevokabular](001-ladevokabular.md) ist geschlossen)
Bearbeiter: Claude
Status: geschlossen

## Question

Sechs Schaltflächen tauschen im Wartezustand nur ihre Beschriftung, ohne sichtbare
Bewegung. Wie sieht eine wartende Schaltfläche einheitlich aus?

- `login-page.tsx:73` — `{busy ? "Anmeldung läuft …" : "Anmelden"}`
- `process-start-page.tsx:287` — `{busy ? "Wird angelegt …" : "Weiter zu Schritt 2"}`; das
  Pfeil-Icon wird ausgeblendet und **nichts** rückt nach, die Schaltfläche springt.
- `process-capture-page.tsx:354` — `{busy ? "Wird gestartet …" : …}`
- `opportunity-discovery-page.tsx:172` — zeigt ein **stillstehendes** `RefreshCw` neben
  „Wird gestartet …"
- `process-brief.tsx:284` — zeigt ein stillstehendes `Save` neben „Wird gespeichert …"
- `process-upload-picker.tsx:132` — `{busy ? <Paperclip className="animate-spin" /> : …}`.
  Eine rotierende Büroklammer: das Icon ist nicht rotationssymmetrisch, das sieht aus wie
  ein Fehler, nicht wie ein Ladezustand.

Gegenbeispiel im Haus, das es schon richtig macht: `process-delete-dialog.tsx:69` zeigt
`<LoaderCircle className="animate-spin" /> Wird gelöscht …`.

Mitzuklären: ob eine wartende Schaltfläche zusätzlich `disabled` und `aria-busy` bekommt,
und ob die Breite stabil bleiben muss, damit das Layout beim Umschalten nicht springt —
die deutschen Wartetexte sind durchweg länger als die Ruhetexte.
