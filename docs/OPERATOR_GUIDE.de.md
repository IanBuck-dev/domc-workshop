# Bedienungsanleitung – Prozesserfassung

> **Migrationshinweis:** Die aktive Produktspezifikation definiert einen neuen
> Zwei-Seiten-Flow. Das aktuelle Deployment kann bis zur Umsetzung noch
> ersetzte Bewertungs-, Gateway- oder Ranglistenoberflächen anzeigen. Diese sind
> keine fachliche Vorgabe für neue Arbeiten.

## Vor dem Workshop

1. Prüfen Sie, dass ausschließlich fiktive oder wirksam anonymisierte Daten verwendet werden.
2. Prüfen Sie den Claude-Login und den Zustand des Dienstes `claims-ai-portfolio`.
3. Öffnen Sie `https://claims-ai.ian-buck.dev` und melden Sie sich mit dem Testkonto an.
4. Verwenden Sie nur wenige, relevante und aktuelle Testdokumente. Maximal fünf Dateien dürfen für eine Prozesserfassung ausgewählt werden.
5. Prüfen Sie, dass das feste Erfassungsprofil `compact-v1` und der Reasoning-Aufwand `medium` verwendet werden.

## Empfohlener Workshop-Ablauf

1. Erfassen Sie auf Seite 1 ausschließlich Fachbereich, einreichende Person, E-Mail-Adresse und Prozessname und bestätigen Sie die Demo-Daten-Regel.
2. Beantworten Sie auf Seite 2 die fünf fachlichen Themenblöcke in normalen Sätzen oder Stichpunkten. Technische Schnittstellenkenntnisse sind nicht erforderlich.
3. Wählen Sie bei Bedarf bis zu fünf relevante Unterlagen aus. Nur ausgewählte Dateien werden für die ausdrücklich gestartete KI-Aktion verwendet.
4. Beantworten Sie die von der KI erzeugten Rückfragen. Pro Themenblock ist höchstens eine Rückfrage zulässig; es gibt keine zweite Rückfragerunde.
5. Prüfen Sie Prozesssteckbrief, High-Level-Prozesskarte, Unterlagenabdeckung und offene Wissenslücken.
6. Korrigieren Sie missverstandene Bereiche und bestätigen Sie anschließend die Prozessbeschreibung als fachliche Ausgangsbasis.

Die Bestätigung ist keine Aussage über KI-Potenzial, technische Machbarkeit,
Datenschutz, Wirtschaftlichkeit oder einen späteren KI-Use-Case.

## Dateien und Betrieb

- Prozesserfassungen liegen repository-lokal im konfigurierten Workspace; `history.jsonl` ist das fortlaufende Änderungsprotokoll.
- Uploads bleiben im jeweiligen Prozessordner. Wählen Sie für KI-Aktionen nur tatsächlich benötigte Dateien aus.
- Servervorgaben liegen versioniert unter `defaults/`. Der Einstellungen-Import verändert keine Serverdateien.
- Der Dienst bindet ausschließlich an `127.0.0.1:3210`; Cloudflare Tunnel übernimmt den HTTPS-Zugang.
- Der produktive Tunnel-Hostname ist `claims-ai.ian-buck.dev`; sein DNS-Eintrag zeigt auf den bestehenden Pi-Tunnel, dessen zweite Ingress-Regel nur diesen Dienst an Port `3210` weiterleitet.
- Claude-Aktionen laufen nacheinander in Wegwerf-Arbeitsbereichen. Ein fehlendes Sandbox Runtime ist im Produktionsbetrieb ein Fehler, kein stiller Rückfall.
- Der Claude-Login ist für den Dienstbenutzer `claims-ai` eingerichtet. Prüfen: `sudo -u claims-ai env HOME=/var/lib/claims-ai CLAUDE_CONFIG_DIR=/var/lib/claims-ai/.claude claude auth status`.
- Die Service-Härtung bleibt aktiv; `ProtectKernelTunables` und `ProtectKernelLogs` sind bewusst nicht gesetzt, weil Bubblewrap sonst keinen privaten `/proc`-Mount anlegen kann. `/tmp/claude` liegt durch `PrivateTmp=yes` im privaten temporären Namensraum des Dienstes.
- Claude benötigt lesenden Zugriff auf `/var/lib/claims-ai/.claude`. Diese Authentifizierungskonfiguration ist deshalb auch für die im Sandbox-Prozess erlaubten Werkzeuge lesbar. Andere Home-Verzeichnisse, Service-Secrets, fremde Bewertungen und lokale Dienste bleiben gesperrt. Das ist eine bewusste Einschränkung des Prototyps.
- `CLAUDE_CODE_SAFE_MODE=1` und `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` bleiben gesetzt. `CLAUDE_CODE_SIMPLE` darf nicht gesetzt werden, weil es die Claude-Pro-Anmeldung im CLI-Prozess deaktiviert.

## Beenden

Abmelden beendet die Anwendungssitzung, löscht aber keine Prozesserfassung. Bei einem KI-Fehler bleiben kanonische Dateien unverändert; die ausdrücklich gestartete Aktion kann erneut ausgeführt werden. Dienststatus und Protokoll prüfen Sie auf dem Pi mit `systemctl status claims-ai-portfolio` und `journalctl -u claims-ai-portfolio`.
