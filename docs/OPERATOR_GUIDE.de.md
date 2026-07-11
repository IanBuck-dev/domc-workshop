# Bedienungsanleitung – Claims-Ideenportfolio

## Vor dem Workshop

1. Entpacken Sie das vollständige ZIP in einen eigenen Ordner.
2. Installieren und authentifizieren Sie Claude Code separat.
3. Starten Sie `Claims-Ideenportfolio-windows-x64.exe` per Doppelklick. Unter macOS starten Sie `Claims-Ideenportfolio-macos-arm64`.
4. Falls Windows SmartScreen warnt, prüfen Sie Herausgeber und Herkunft. Der Prototyp ist nicht signiert.
5. Der Browser öffnet die lokale Adresse automatisch. Die Daten bleiben als lesbare Dateien im Ordner `workspace`.

## Empfohlener Workshop-Ablauf

1. Erfassen Sie eine Idee in Alltagssprache. Verwenden Sie ausschließlich freigegebene Demo- oder anonymisierte Daten.
2. Öffnen Sie die Idee und lassen Sie sie strukturieren. Beantworten Sie höchstens drei Rückfragen; `unbekannt` ist zulässig.
3. Prüfen Sie Bewertung, Annahmen, Risiken und die konventionelle Alternative. Claude gibt eine Empfehlung, keine Entscheidung.
4. Ändern Sie Scores bei Bedarf und dokumentieren Sie den Grund.
5. Vergleichen Sie Projekte im Portfolio und in der Impact-/Aufwand-Matrix.
6. Wählen Sie geeignete Projekte ausdrücklich für die IT-Übergabe aus und erstellen Sie Markdown- und CSV-Dateien.

## Anpassungen und Reset

- `workspace/CLAUDE.md` enthält die fachlichen Arbeitsregeln.
- `workspace/workshop.yaml` enthält Workshop-Titel, Modell und Denkaufwand.
- Beim Reset muss `ZURÜCKSETZEN` eingegeben werden. Vorher wird eine Sicherung unter `workspace/backups` angelegt. Exporte und Sicherungen werden nicht gelöscht.

## Beenden

Schließen Sie das Programmfenster beziehungsweise beenden Sie den Prozess. Beim nächsten Start werden bestehende Ideen wieder geladen. Bei einem Fehler bleiben Dateien erhalten und eine Claude-Aktion kann erneut gestartet werden.
