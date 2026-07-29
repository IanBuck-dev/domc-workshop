# Plan: shadcn/ui und Tailwind als einzige UI-Basis

## Ziel

Die Web-App verwendet shadcn/ui mit Tailwind CSS v4 statt der heutigen
selbstgebauten UI-Primitives und komponentenspezifischen Stylesheets. Layout,
Open-Sans-Schrift und die grüne Zukunftswerkstatt-Farbwelt bleiben erhalten;
Kontrollhöhen, Abstände, Fokuszustände und Overlays folgen shadcn `new-york`.

Feste Entscheidungen:

- Vite, React 19, Bun und Lucide bleiben bestehen.
- shadcn verwendet Radix, `new-york`, TypeScript und CSS-Variablen.
- Tailwind Utilities ersetzen alle Klassen aus `apps/web/src/styles/`.
- Es gibt keine dauerhaften Kompatibilitätswrapper für die alte `Button`-,
  `Card`-, `Badge`-, `Kicker`- oder `Meter`-API.
- `apps/web/src/styles.css` enthält am Ende nur Font-, Tailwind-, shadcn- und
  Theme-/Base-Imports; keine Komponenten- oder Layoutselektoren.
- Das Setup-Formular ist der Pilot, danach wird die gesamte Web-App migriert.

## Ziel-Theme

Die shadcn/Tailwind-Variablen übernehmen die aktuellen Markenwerte:

| Rolle                  | Wert       |
| ---------------------- | ---------- |
| `background`           | `#f3f6f4`  |
| `foreground`           | `#16302a`  |
| `card`, `popover`      | `#ffffff`  |
| `primary`              | `#14563c`  |
| `primary-foreground`   | `#ffffff`  |
| `secondary`, `muted`   | `#e8f1ec`  |
| `secondary-foreground` | `#14563c`  |
| `muted-foreground`     | `#61736e`  |
| `accent`               | `#dbeae1`  |
| `accent-foreground`    | `#14563c`  |
| `destructive`          | `#b42318`  |
| `border`               | `#d8e2dd`  |
| `input`                | `#7a998e`  |
| `ring`                 | `#2f9070`  |
| `radius`               | `0.625rem` |

## Umsetzung

### 1. Tooling und Theme

- `package.json`, `bun.lock`: Tailwind v4, `@tailwindcss/vite`, shadcn- und
  Radix-Abhängigkeiten sowie `clsx`, `tailwind-merge` und
  `class-variance-authority` installieren.
- `apps/web/vite.config.ts`: Tailwind-Vite-Plugin und Alias `@` auf
  `apps/web/src` konfigurieren.
- `tsconfig.json`: denselben `@/*`-Alias für TypeScript ergänzen.
- `components.json`: shadcn `new-york`, Radix, `rsc: false`, `tsx: true`,
  `cssVariables: true`, `baseColor: olive` und Ziel
  `@/components/ui` festlegen.
- `apps/web/src/styles.css`: Tailwind/shadcn importieren, Open Sans behalten und
  ausschließlich das oben definierte Theme sowie minimale `body`-Base-Regeln
  setzen.
- `apps/web/src/lib/utils.ts`: shadcn-`cn()` hinzufügen.

### 2. shadcn-Primitives

Folgende Dateien werden über die shadcn CLI erzeugt und nur über Theme-Tokens
angepasst:

- `apps/web/src/components/ui/button.tsx`
- `apps/web/src/components/ui/card.tsx`
- `apps/web/src/components/ui/badge.tsx`
- `apps/web/src/components/ui/input.tsx`
- `apps/web/src/components/ui/label.tsx`
- `apps/web/src/components/ui/textarea.tsx`
- `apps/web/src/components/ui/select.tsx`
- `apps/web/src/components/ui/checkbox.tsx`
- `apps/web/src/components/ui/dialog.tsx`
- `apps/web/src/components/ui/alert-dialog.tsx`
- `apps/web/src/components/ui/dropdown-menu.tsx`
- `apps/web/src/components/ui/collapsible.tsx`
- `apps/web/src/components/ui/progress.tsx`
- `apps/web/src/components/ui/separator.tsx`

`brand-mark.tsx` bleibt als Markenkomponente und erhält Tailwind-Klassen.
`class-names.ts`, `kicker.tsx` und `meter.tsx` werden entfernt; deren Aufrufer
verwenden `cn`, normale Tailwind-Typografie und `Progress`.

### 3. Pilot: Setup-Formular

`apps/web/src/pages/process-start-page.tsx` wird vollständig auf `Card`,
`Button`, `Input`, `Label`, `Select` und `Checkbox` aus shadcn umgestellt.
Die bestehende Feldvalidierung, Texte und Aktivierungslogik bleiben identisch.
Das Ergebnis dient als visuelle Referenz für Kontrollhöhe, Radius, Fokus,
Fehlermeldung und responsive Abstände.

### 4. Vollständige Migration

Direkt auf shadcn und Tailwind umzustellen sind:

- Seiten: `login-page.tsx`, `process-list-page.tsx`,
  `process-capture-page.tsx`, `process-detail-page.tsx`,
  `opportunity-discovery-page.tsx`, `settings-page.tsx`.
- Shell und Dokumente: `app-shell.tsx`, `document-coverage.tsx`,
  `document-preview-dialog.tsx`, `instruction-preview-dialog.tsx`,
  `process-upload-picker.tsx`.
- Prozesserfassung: `process-topic-card.tsx`, `process-brief.tsx`,
  `process-map.tsx`, `process-step-card.tsx`,
  `process-step-information.tsx`, `process-step-decisions.tsx`,
  `process-delete-dialog.tsx`, `process-step-delete-dialog.tsx`.
- KI-Potenziale: `opportunity-hypotheses-view.tsx`,
  `opportunity-scenarios-view.tsx`.
- Typzuordnung: `apps/web/src/lib/process-provenance.ts` verwendet anschließend
  die shadcn-`Badge`-Varianten statt `BadgeTone`.

Native Bestätigungsdialoge werden `AlertDialog`, Vorschauen `Dialog`,
Kontextaktionen `DropdownMenu`, aufklappbare Bereiche `Collapsible` und
Auswahlfelder shadcn `Select`. Alle Layout- und Statusklassen werden dabei
direkt durch Tailwind Utilities ersetzt.

### 5. Alte UI-Schicht entfernen

- Alte Varianten/APIs aus `button.tsx`, `card.tsx` und `badge.tsx` sind nach
  der Call-Site-Migration nicht mehr vorhanden.
- Sämtliche Dateien unter `apps/web/src/styles/` werden gelöscht.
- `apps/web/src/styles.css` importiert keine lokalen Stylesheets mehr.
- Suche nach `panel`, `button secondary`, `text-button`, `danger-button`,
  `icon-button`, `badge-*`, `kicker`, `meter` und `classNames(` liefert in
  `apps/web/src` keine Legacy-Nutzung.

## Verifikation

Automatisch:

```zsh
./scripts/qa changed
./scripts/qa all
./scripts/qa release
git diff --check
```

Chrome DevTools, jeweils bei 1440 px und 768 px:

1. Login und Hauptnavigation;
2. Setup-Formular inklusive Fehlern, Checkbox und aktivem Primärbutton;
3. vollständige Prozessaufnahme mit Upload und Dialogen;
4. Prozesssteckbrief im Lese- und Bearbeitungsmodus;
5. Löschen mit `AlertDialog` und Kontextmenü;
6. Hypothesen- und Szenarioansichten;
7. Einstellungen und Instruction-Preview.

Abnahme:

- keine Console-Fehler, fehlgeschlagenen Requests oder horizontaler
  Seitenüberlauf;
- alle Dialoge, Selects, Menüs und Collapsibles sind per Tastatur bedienbar;
- aktiver Primärbutton verwendet `#14563c`, Fokus `#2f9070` und die App behält
  Open Sans sowie die heutige grüne Markenwirkung;
- `apps/web/src/styles/` und alle alten UI-Primitives sind entfernt;
- es gibt keine parallele Custom-CSS-Komponentenbibliothek neben shadcn.
