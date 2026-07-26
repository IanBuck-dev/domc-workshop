# Bedienungsanleitung – Prozesserfassung

## Vor dem Workshop

1. Prüfen Sie, dass ausschließlich fiktive oder wirksam anonymisierte Daten verwendet werden.
2. Prüfen Sie den Claude-Login und den Zustand des Dienstes `claims-ai-portfolio`.
3. Öffnen Sie `https://claims-ai.ian-buck.dev` und melden Sie sich mit dem Testkonto an.
4. Verwenden Sie nur wenige, relevante und aktuelle Testdokumente. Maximal fünf Dateien dürfen für eine Prozesserfassung ausgewählt werden.
5. Prüfen Sie, dass das feste Erfassungsprofil `compact-v1` und der Reasoning-Aufwand `medium` verwendet werden.

## Empfohlener Workshop-Ablauf

1. Erfassen Sie auf Seite 1 ausschließlich Fachbereich, einreichende Person, E-Mail-Adresse und Prozessname und bestätigen Sie die Demo-Daten-Regel.
2. Beantworten Sie auf Seite 2 die fünf fachlichen Themenblöcke in normalen
   Sätzen oder Stichpunkten. Wählen Sie zusätzlich die vier verpflichtenden
   Arbeitsmerkmale aus. Diese sind keine KI-Bewertung. Technische
   Schnittstellenkenntnisse sind nicht erforderlich.
3. Wählen Sie bei Bedarf bis zu fünf relevante Unterlagen aus. Nur ausgewählte Dateien werden für die ausdrücklich gestartete KI-Aktion verwendet.
4. Beantworten Sie die von der KI erzeugten Rückfragen. Pro Themenblock ist höchstens eine Rückfrage zulässig; es gibt keine zweite Rückfragerunde.
5. Prüfen Sie Prozesssteckbrief, Arbeitsmerkmale,
   High-Level-Prozesskarte, Unterlagenabdeckung und offene Wissenslücken. Eine
   Korrektur der Arbeitsmerkmale benötigt eine kurze fachliche Begründung.
6. Öffnen Sie bei Bedarf die Vorschau einer berücksichtigten Unterlage. PDF-, Bild- und Textdateien werden direkt angezeigt; Word- und Excel-Dateien stehen als Originaldownload bereit.
7. Korrigieren Sie missverstandene Bereiche und bestätigen Sie anschließend die Prozessbeschreibung als fachliche Ausgangsbasis.

## KI-Potenziale und Szenarien entdecken

Nach der fachlichen Bestätigung zeigt die Prozessübersicht die Aktion
`KI-Potenziale entdecken`. Sie startet einmalig eine zweiphasige Analyse:

1. Claude untersucht jeden bestätigten Hauptschritt und dokumentiert mögliche
   KI-Beiträge mit Begründung, Evidenz, Annahmen, Potenzial und Konfidenz.
2. Nur wenn mindestens eine Hypothese eine hohe Konfidenz besitzt, erstellt eine
   neue Claude-Session drei Zukunftsbilder: assistiert, teilautonom und agentisch.

Die Ergebnisse werden während der Verarbeitung schrittweise sichtbar. Nach
Beginn der zweiten Phase kann zwischen Hypothesen und Szenarien gewechselt
werden. Ohne ausreichend belastbare Hypothese endet die Analyse neutral und
ohne erfundene Szenarien. Ein technischer Fehler kann wiederholt werden; bereits
gespeicherte Hypothesen bleiben bei einem Fehler der Szenariophase erhalten.
Die Ergebnisse sind in diesem Prototyp read-only und enthalten keine
Wirtschaftlichkeits-, Machbarkeits-, Risiko- oder Priorisierungsbewertung.

Unter `Prozessaufnahme einstellen` können Sie im Bereich `Hinweise für die
KI-Unterstützung` über `Vollständige Anweisungen ansehen` prüfen, welche
Anweisungen für Rückfragen und Prozessbild tatsächlich wirksam wären. Die
Vorschau enthält auch noch nicht gespeicherte Änderungen aus den beiden
Textfeldern, speichert aber selbst nichts und kann nicht bearbeitet werden.
Der einmal angezeigte globale erste Abschnitt gilt für beide Aktionen und beschreibt Rolle,
Formularkontext, höfliche deutsche Ansprache, kompakte Texte und die Grenze zur
erst späteren Identifikation möglicher KI-Potenziale.

Die Bestätigung ist keine Aussage über KI-Potenzial, technische Machbarkeit,
Datenschutz, Wirtschaftlichkeit oder einen späteren KI-Use-Case.

Prozessaufnahmen können in der Übersicht über das rote Papierkorb-Symbol und
die anschließende Bestätigung dauerhaft gelöscht werden. Dies gilt auch für
fachlich bestätigte Aufnahmen und ihre abhängige Potenzialanalyse. Es gibt keine
Wiederherstellung; während einer laufenden KI-Aktion ist das Löschen gesperrt.

## Dateien und Betrieb

- Prozesserfassungen liegen repository-lokal im konfigurierten Workspace; `history.jsonl` ist das fortlaufende Änderungsprotokoll.
- Potenzialanalysen liegen im jeweiligen Prozessordner unter `opportunity-discovery/`; Prompt-, Schema-, Konfigurations- und Prozesssnapshots werden gehasht und für beide Phasen unverändert verwendet.
- Uploads bleiben im jeweiligen Prozessordner. Wählen Sie für KI-Aktionen nur tatsächlich benötigte Dateien aus.
- Vorschau und Download lesen ausschließlich die zum aktuellen Prozess gehörende Originaldatei. Vor jeder Ausgabe werden Dateigröße und SHA-256-Prüfsumme gegen die gespeicherten Metadaten geprüft.
- Servervorgaben liegen versioniert unter `defaults/`. Der Einstellungen-Import verändert keine Serverdateien.
- Der Dienst bindet ausschließlich an `127.0.0.1:3210`; Cloudflare Tunnel übernimmt den HTTPS-Zugang.
- Der produktive Tunnel-Hostname ist `claims-ai.ian-buck.dev`; sein DNS-Eintrag zeigt auf den bestehenden Pi-Tunnel, dessen zweite Ingress-Regel nur diesen Dienst an Port `3210` weiterleitet.
- Claude-Aktionen laufen nacheinander in Wegwerf-Arbeitsbereichen. Ein fehlendes Sandbox Runtime ist im Produktionsbetrieb ein Fehler, kein stiller Rückfall.
- Der Claude-Login ist für den Dienstbenutzer `claims-ai` eingerichtet. Prüfen: `sudo -u claims-ai env HOME=/var/lib/claims-ai CLAUDE_CONFIG_DIR=/var/lib/claims-ai/.claude claude auth status`.
- Die Service-Härtung bleibt aktiv; `ProtectKernelTunables` und `ProtectKernelLogs` sind bewusst nicht gesetzt, weil Bubblewrap sonst keinen privaten `/proc`-Mount anlegen kann. `/tmp/claude` liegt durch `PrivateTmp=yes` im privaten temporären Namensraum des Dienstes.
- Claude benötigt lesenden Zugriff auf `/var/lib/claims-ai/.claude`. Diese Authentifizierungskonfiguration ist deshalb auch für die im Sandbox-Prozess erlaubten Werkzeuge lesbar. Andere Home-Verzeichnisse, Service-Secrets, fremde Prozessaufnahmen und lokale Dienste bleiben gesperrt. Das ist eine bewusste Einschränkung des Prototyps.
- `CLAUDE_CODE_SAFE_MODE=1` und `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` bleiben gesetzt. `CLAUDE_CODE_SIMPLE` darf nicht gesetzt werden, weil es die Claude-Pro-Anmeldung im CLI-Prozess deaktiviert.

## Beenden

Abmelden beendet die Anwendungssitzung, löscht aber keine Prozesserfassung. Bei einem KI-Fehler bleiben kanonische Dateien unverändert; die ausdrücklich gestartete Aktion kann erneut ausgeführt werden. Dienststatus und Protokoll prüfen Sie auf dem Pi mit `systemctl status claims-ai-portfolio` und `journalctl -u claims-ai-portfolio`.
