# Kompakte Tabelle der agentischen Potenzialbewertung

## Zielbild

Die Kriterienprüfung zeigt alle 32 Kriterien in einer kompakten, Excel-ähnlichen Tabelle. Jede Zeile enthält laufende Nummer, Kriteriumsname und fachlichen Wert. Ein Klick auf die Zeile klappt unmittelbar darunter die gespeicherten Details auf, ohne Navigation oder Bearbeitung.

## Verhalten

- Die bestehende Filterleiste bleibt erhalten und zeigt weiterhin Trefferzahlen.
- Kategorien erscheinen als kompakte, nicht nummerierte Abschnittszeilen innerhalb derselben Tabelle.
- Kriteriumszeilen haben die Spalten `#`, `Kriterium`, `Wert` und rechts einen Auf-/Zuklapp-Indikator.
- `Wert` zeigt bei bewerteten Kriterien `0|1|2 von 2`, bei offenen Kriterien `Nicht ausreichend belegt` und bei ausgeschlossenen Kriterien `Ausgeschlossen`.
- Die gesamte Kriteriumszeile ist per Maus und Tastatur bedienbar und setzt `aria-expanded` sowie `aria-controls`.
- Die aufgeklappte Detailzeile spannt über alle Spalten und zeigt Skala, Konfidenz, Begründung, Belege, Hypothesen sowie offene Punkte.
- Mehrere Kriterien dürfen gleichzeitig geöffnet sein; initial sind alle geschlossen.
- Die vorhandene Erklärung zu nicht berechneten Gesamtwerten bleibt als kompakter Hinweis unter der Tabelle.
- Desktop und Tablet zeigen dieselben Spalten ohne horizontalen Seiten-Overflow. Lange Inhalte umbrechen nur in der Detailzeile.

## Files To Change

- `apps/web/src/components/agentic-potential-assessment-table.tsx`
- `tests/agentic-potential-assessment-ui.test.ts`
- `docs/plans/agentic-assessment-compact-table.md`

## Tests und Abnahme

- UI-Test prüft Tabellenüberschriften, Zeilennummerierung, `aria-expanded`, Detailinhalt und Filter.
- `./scripts/qa test tests/agentic-potential-assessment-ui.test.ts`
- `./scripts/qa changed`
- `./scripts/qa all`
- Chrome DevTools auf `/processes/PROC-0006/opportunities/agentic-assessment` bei 1440×900 und 1024×768: kompakte Zeilen, funktionierendes Aufklappen, kein horizontaler Overflow, keine Console- oder Netzwerkfehler.

## Festgelegte Annahmen

- `Wert` bedeutet den gespeicherten Kriterienstatus beziehungsweise den numerischen Score, nicht einen neu berechneten Gesamtwert.
- Die Detailzeile ist rein lesend und verändert die immutable Bewertung nicht.
