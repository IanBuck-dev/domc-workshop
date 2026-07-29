# Bedienungsanleitung – Zukunftswerkstatt

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
4. Starten Sie `Angaben prüfen lassen`. Rückfragen erscheinen rechts neben dem
   zugehörigen Eingabeblock; auf Tablets stehen sie darunter. Ergänzen Sie die
   ursprüngliche Angabe links und wählen Sie bei Bedarf ausdrücklich `Erneut
prüfen`. Jede Prüfung verwendet eine neue Claude-Session und startet keine
   selbstständige Prüfschleife. Nach der ersten Prüfung können Sie jederzeit mit
   `Mit Prozessbild fortfahren` weitergehen. Bei offenen Fragen heißt die Aktion
   `Trotz offener Rückfragen fortfahren`; diese Entscheidung wird protokolliert
   und die offenen Punkte bleiben im Prozessbild als Wissenslücken sichtbar.
5. Prüfen Sie zuerst das Diagramm. Öffnen Sie danach unter `Schritte` die
   einzelnen Schritte und kontrollieren Sie Input, Output, Informationen mit
   Quelle und Art, Varianten und Entscheidungen sowie Sonstiges.
6. Öffnen Sie bei Bedarf die Vorschau einer berücksichtigten Unterlage. PDF-, Bild- und Textdateien werden direkt angezeigt; Word-, PowerPoint- und Excel-Dateien stehen als Originaldownload bereit.
7. Öffnen Sie `Prozessbild bearbeiten`, wenn Schrittbezeichnungen, Reihenfolge,
   Inputs, Outputs, Informationsquellen, Entscheidungsoptionen oder Sonstiges
   nicht stimmen. Diagramm und Schrittkarten bleiben an ihrer Position. Im
   linearen Diagramm können Sie zwischen fünf und acht Schritten ergänzen,
   umbenennen und verschieben. Ein Schritt lässt sich erst löschen, wenn keine
   Entscheidungsoption mehr auf ihn verweist. Fehlende Angaben sind mit
   `Angabe fehlt` markiert. Wählen Sie Quellen und Informationsarten aus den
   angebotenen Listen oder verwenden Sie `Andere Quelle eingeben …` bzw.
   `Andere Art eingeben …`. Jede Information kann einzeln ergänzt oder entfernt
   werden; Entscheidungen enthalten Frage, Modus, Optionen, Feststellung,
   Folge und einen optionalen Folgeschritt. `Bearbeitung abbrechen` verwirft
   den gesamten Entwurf. Speichern Sie alle Änderungen gemeinsam mit einer
   kurzen fachlichen Begründung. Bei einem bereits bestätigten Prozess hebt die
   Korrektur die Bestätigung auf, bis das Prozessbild erneut bestätigt wird.
8. Prüfen Sie unter `Unterlagen und offene Punkte` Dateieinschränkungen und
   erkannte Widersprüche. Nicht belegte Angaben bleiben separat unter
   `Noch unbekannt` sichtbar. Bestätigen Sie anschließend das Prozessbild als
   fachliche Ausgangsbasis.

## KI-Potenziale und Szenarien entdecken

Nach der fachlichen Bestätigung zeigt die Prozessübersicht die Aktion
`KI-Potenziale entdecken`. Sie startet einmalig eine zweiphasige Analyse:

1. Claude untersucht jeden bestätigten Hauptschritt und dokumentiert mögliche
   KI-Beiträge mit Begründung, Evidenz, Annahmen, Potenzial und Konfidenz.
2. Mit mindestens einer Hypothese hoher Konfidenz erstellt eine neue
   Claude-Session drei Zukunftsbilder: assistiert, teilautonom und agentisch.
   Gibt es keine hohe, aber mindestens zwei mittlere Hypothesen, werden
   ersatzweise die besten zwei bis drei verwendet. Die Oberfläche kennzeichnet
   dann den fachlichen Klärungsbedarf; die Szenarien erhalten höchstens mittlere
   Konfidenz.

Die Ergebnisse werden während der Verarbeitung schrittweise sichtbar. Nach
Beginn der zweiten Phase kann zwischen Hypothesen und Szenarien gewechselt
werden. Ein authentifizierter Ereignisstrom aktualisiert Warteschlange und
Prozessstand ohne periodische Abfragen; nach einem Verbindungsabbruch verbindet
sich der Browser erneut. Ohne ausreichend belastbare Hypothese endet die Analyse neutral und
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
- Impressum, Datenschutzhinweise und Nutzungshinweise sind unter den öffentlichen Routen `/impressum`, `/datenschutz` und `/nutzungshinweise` ohne Anmeldung erreichbar. Die Betreiberangaben liegen ausschließlich in `/var/lib/claims-ai/public-site-information.json`; die kontrollierte Übertragung steht im [Pi-Runbook](PI-DEPLOYMENT.md).
- Der produktive Tunnel-Hostname ist `claims-ai.ian-buck.dev`; sein DNS-Eintrag zeigt auf den bestehenden Pi-Tunnel, dessen zweite Ingress-Regel nur diesen Dienst an Port `3210` weiterleitet.
- Claude-Aktionen laufen nacheinander in Wegwerf-Arbeitsbereichen. Ein fehlendes Sandbox Runtime ist im Produktionsbetrieb ein Fehler, kein stiller Rückfall.
- Der Claude-Login ist für den Dienstbenutzer `claims-ai` eingerichtet. Status und Deployment werden im [Pi-Runbook](PI-DEPLOYMENT.md) mit den vollständigen, reproduzierbaren Befehlen beschrieben.
- Die Service-Härtung bleibt aktiv; `ProtectKernelTunables` und `ProtectKernelLogs` sind bewusst nicht gesetzt, weil Bubblewrap sonst keinen privaten `/proc`-Mount anlegen kann. `/tmp/claude` liegt durch `PrivateTmp=yes` im privaten temporären Namensraum des Dienstes.
- Claude benötigt lesenden Zugriff auf `/var/lib/claims-ai/.claude`. Diese Authentifizierungskonfiguration ist deshalb auch für die im Sandbox-Prozess erlaubten Werkzeuge lesbar. Andere Home-Verzeichnisse, Service-Secrets, fremde Prozessaufnahmen und lokale Dienste bleiben gesperrt. Das ist eine bewusste Einschränkung des Prototyps.
- `CLAUDE_CODE_SAFE_MODE=1` und `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` bleiben gesetzt. `CLAUDE_CODE_SIMPLE` darf nicht gesetzt werden, weil es die Claude-Pro-Anmeldung im CLI-Prozess deaktiviert.

## Beenden

Abmelden beendet die Anwendungssitzung, löscht aber keine Prozesserfassung. Bei einem KI-Fehler bleiben kanonische Dateien unverändert; die ausdrücklich gestartete Aktion kann erneut ausgeführt werden. Dienststatus und Protokoll prüfen Sie auf dem Pi mit `systemctl status claims-ai-portfolio` und `journalctl -u claims-ai-portfolio`.

# Lokaler Präsentationsmodus ohne KI-Sandbox

Für eine lokale Vorführung mit ausschließlich fiktiven Demo-Daten kann die
Anwendung ausdrücklich ohne KI-Sandbox gestartet werden:

```bash
bun run dev:local-no-sandbox
```

Dieser Opt-in gilt nur für den lokalen Bun-Entwicklungsbetrieb. Release- und
Produktionsstarts weisen den Modus zurück. Claude erhält dabei weiterhin nur
den je Aktion zusammengestellten Prozesskontext, verwendet für jede Aktion
eine frische, nicht fortsetzbare Session und startet keine autonomen Schleifen.
Der normale Start `bun run dev` verwendet weiterhin die Sandbox.
