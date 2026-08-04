# Erster Bildaufbau und die Anmeldeprüfung

Karte: [Ladezustände und Navigationsgefühl](../map-loading-states.md)
Typ: `wayfinder:grilling` (HITL) — entschieden, Umsetzung siehe Resolution
Blockiert von: — (frei, [Ladevokabular](001-ladevokabular.md) ist geschlossen)
Bearbeiter: Claude
Status: geschlossen

## Question

Was sieht jemand in den ersten Sekunden nach dem Öffnen der Anwendung — und was soll er
stattdessen sehen?

Heutige Abfolge:

1. `apps/web/index.html:20` liefert ein leeres `<div id="root"></div>`. Bis das JavaScript
   geladen und ausgeführt ist, ist die Seite **weiß**.
2. Dann greift `app.tsx:44`: `if (auth === "loading") return <main
className="app-loading">Anwendung wird geladen …</main>;` — die dritte Verwendung der
   undefinierten Klasse, hier vor AppShell, Router und allem anderen. Ungestylter Text
   oben links, während `api.session()` läuft.
3. Erst danach erscheint die eigentliche Oberfläche.

Also zweimal ein sichtbarer Zustandswechsel, bevor überhaupt etwas Nützliches steht.

Zu klären:

- Ob der leere `#root` einen Platzhalter direkt im HTML bekommt. Das ist die einzige
  Stelle dieser Karte, die **nicht** in React gelöst werden kann — bevor React läuft, gibt
  es nur HTML und CSS. Es hieße, ein Stück Markup und etwas Stil in `index.html`
  einzubauen, die zur Anwendung passen und dort separat gepflegt werden müssten. Ob das
  den Unterhalt wert ist, ist genau die Frage.
- Ob die Anmeldeprüfung überhaupt blockieren muss. Sie entscheidet zwischen angemeldeter
  Oberfläche und Anmeldeseite — eine falsche Vorwegnahme würde also kurz die falsche Seite
  zeigen. Ob das schlimmer ist als der heutige Zustand, ist zu entscheiden, nicht zu raten.
- Ob die Marke aus `components/brand-mark.tsx` hier eine Rolle spielt. Sie liegt zusätzlich
  als Datei unter `assets/zukunftswerkstatt-mark.svg` und ließe sich in `index.html`
  einbinden, ohne auf React zu warten. Achtung: `tests/brand-mark.test.ts` wacht über beide
  Fassungen, eine dritte Kopie darf nicht unbemerkt entstehen.

## Resolution

**Kein Markup in `index.html`.** Ein Platzhalter dort wäre eine dritte, handgepflegte Kopie
der Marke plus handgeschriebenes CSS außerhalb von Tailwind — der Unterhalt lohnt für die
wenigen Millisekunden nicht, die ein Vite-Bundle zum Starten braucht. **Aber** `index.html`
bekommt eine Zeile Hintergrundfarbe auf `html, body` mit demselben Wert wie `--background`
aus `styles.css`, damit der Rahmen vor dem Start nicht als fremdes Weiß aufblitzt, sondern
schon die Farbe der Anwendung hat.

**Die Anmeldeprüfung bleibt blockierend.** Vorwegnehmen hieße raten, und ein Fehlgriff zeigt
kurz die falsche Seite — das ist sichtbar schlimmer als eine kurze Stille. Was ersetzt wird,
ist nur die Darstellung: statt `<main className="app-loading">` eine neue Komponente
`components/app-boot-screen.tsx` — bildschirmfüllend, mittig die `BrandMark`, dazu
`role="status"`, `aria-label="Anwendung wird geladen"` und ein `sr-only`-Text. **Kein
Spinner**: was nur 50 ms steht, sieht drehend nach Störung aus, nicht nach Ladezustand.

**Gegen das Aufblitzen** bekommt der Bildschirm in `styles.css` eine kleine Keyframe, die
die ersten ~200 ms auf `opacity: 0` hält und dann weich einblendet. Ist die Sitzungsprüfung
schnell — der Normalfall —, sieht niemand irgendetwas; dauert sie, erscheint eine ruhige
Markenfläche statt eines Zuckens. Dieselbe Keyframe steht danach jedem Ladezustand dieser
Karte zur Verfügung, der ebenfalls meist zu schnell ist, um gesehen zu werden.

**Die Marke wird als React-Komponente eingebunden**, nicht als dritte Kopie —
`tests/brand-mark.test.ts` bleibt damit die vollständige Wacht über beide Fassungen.

Mit dem Abschluss verschwindet die letzte Verwendung von `app-loading`. Zusammen mit
[Skelette für Prozessdetail und Chat](002-skelette-detail-und-chat.md) sollte danach ein
Grep nach `app-loading` im ganzen Verzeichnis `apps/web` leer ausgehen — das ist die
Abnahmebedingung für beide.
