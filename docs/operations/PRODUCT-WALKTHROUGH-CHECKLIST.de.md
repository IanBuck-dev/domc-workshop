# Produkt-Walkthrough und Abnahmecheckliste

Diese Checkliste dokumentiert eine vollständige fachliche Prüfung des Prototyps. Ein
Haken zählt nur für den angegebenen Lauf und die angegebene Umgebung. Automatisierte
Alt-Nachweise sind als Baseline markiert und ersetzen keinen aktuellen Produkt-Walkthrough.

## Status und Nachweise

- `[ ]` noch nicht geprüft
- `[x]` bestanden
- `[!]` fehlgeschlagen; Fehler und Reproduktion im Fehlerprotokoll festhalten
- `[-]` bewusst nicht anwendbar; Begründung ergänzen
- Für jeden Abschnitt mindestens einen Nachweis notieren: URL, Prozess-ID, Downloadname,
  Screenshotpfad oder kurze Beobachtung.
- Browser-Konsole und fehlgeschlagene Netzwerkanfragen werden für jeden automatisierten
  Abschnitt mitgeprüft.
- Testdaten bleiben vollständig erfunden und gehören zur LifeCorp Versicherung.

## Laufdaten

| Feld             | Wert                                                      |
| ---------------- | --------------------------------------------------------- |
| Lauf-ID          | `WALKTHROUGH-2026-09-03-01`                               |
| Zielsystem       | `https://claims-ai.ian-buck.dev`                          |
| Release          | `245290c5c1238cea152dd30946e45aebfd313fee`                |
| Browser          | Playwright Chromium; persönliche Browserprüfung folgt     |
| Desktop-Viewport | `1440 × 1000`                                             |
| Tablet-Viewport  | `1024 × 900`                                              |
| Testperson       | Codex-Automation und persönliche Prüfung durch den Nutzer |
| Start            | `2026-09-03 10:02 CEST`                                   |
| Ende             | Noch einzutragen                                          |
| Gesamtergebnis   | In Arbeit                                                 |

## Bereits vorhandene technische Baseline

Diese Nachweise stammen vom Release vor dem aktuellen persönlichen Walkthrough.

- [x] `./scripts/qa all` bestand auf dem Release-Commit.
- [x] Der Release-Build bestand mit validierter öffentlicher Seitenkonfiguration.
- [x] Ein lokaler Playwright-Lauf durchlief Chat, Bestätigung, KI-Potenziale,
      drei Szenarien, agentische Bewertung und beide Excel-Downloads mit echtem Codex-Aufruf.
- [x] Desktop- und Tablet-Screenshotläufe bestanden ohne Konsolenfehler oder unerwartet
      fehlgeschlagene Requests.
- [x] Der Pi-Dienst lief nach dem Deployment und die persistenten Workspace-Dateien
      blieben unverändert.
- [x] Ein echter Codex-Smoke-Test auf dem Pi lieferte `PI_CODEX_OK`.

## 0. Betriebsbereitschaft

- [x] Öffentliche Health-Route antwortet mit HTTP 200.
- [x] Startseite antwortet mit HTTP 200.
- [x] Login-Seite lädt ohne Konsolenfehler.
- [x] Pi-Dienst läuft auf genau dem erwarteten Release-Commit.
- [x] `AI_PROVIDER=codex-cli` ist im Dienst aktiv.
- [x] Codex ist für das Dienstkonto angemeldet.
- [x] Der Demo-Workspace enthält die erwarteten LifeCorp-Prozesse.
- [x] Der Leitungswasser-Präsentationsfall ist vorhanden.
- [x] Bestehende Demo-Daten werden durch den Walkthrough nicht überschrieben.

Nachweis:

> 2026-09-03: Dienst `active`; `/api/health` liefert 200. Ein rsync-Checksum-
> Dry-Run zeigt außerhalb dieser neuen Checkliste keine inhaltliche Abweichung zwischen
> `main` und `/opt/claims-ai-portfolio/current`. Dienstdatei setzt Codex, Loginstatus ist
> `Logged in using ChatGPT`. Workspace enthält 23 Prozessverzeichnisse; der
> Leitungswasserfall liegt unter `PROC-0009`. Alle Prüfungen waren read-only.

## 1. Öffentliche Seiten und Anmeldung

- [x] `/impressum` ist ohne Anmeldung erreichbar und zeigt Betreiberinformationen.
- [x] `/datenschutz` ist ohne Anmeldung erreichbar und zeigt die Datenschutzhinweise.
- [x] `/nutzungshinweise` ist ohne Anmeldung erreichbar.
- [x] Die öffentlichen Seiten verlinken untereinander korrekt.
- [x] Eine geschützte URL zeigt ohne Sitzung die Anmeldung.
- [ ] Ein falscher Benutzername zeigt eine fachliche deutsche Fehlermeldung.
- [ ] Ein falsches Passwort zeigt dieselbe Fehlermeldung wie ein falscher Benutzername.
- [ ] Gültige Anmeldedaten öffnen die Prozessübersicht.
- [x] Die Anmeldung erzeugt keine sichtbaren technischen Daten oder Stacktraces.
- [ ] Neuladen erhält die aktive Sitzung.
- [ ] Abmelden beendet die Sitzung.
- [ ] Nach dem Abmelden ist eine geschützte URL wieder gesperrt.
- [!] Die Datenschutzseite benennt den tatsächlich aktiven KI-Anbieter korrekt.

Nachweis:

> Playwright Chromium gegen das Pi: 1 Test bestanden, keine Konsolenfehler, keine
> fehlgeschlagenen Requests. Alle drei öffentlichen Seiten und ihre Footer-Links wurden
> geprüft; `/api/processes` liefert ohne Sitzung 401 mit `Bitte melden Sie sich an.`.
> Fehler W-001: Datenschutz nennt Anthropic und Claude-CLI, obwohl Codex aktiv ist.

### 1a. Impressum eines privaten Betreibers

Arbeitsannahme für diesen Lauf: Der Prototyp wird von einer natürlichen Person privat
und ohne Verbraucherangebot betrieben. Er ist öffentlich erreichbar, dient aber nicht
ausschließlich persönlichen oder familiären Zwecken. Dies ist eine technische
Vollständigkeitsprüfung und keine individuelle Rechtsberatung.

- [x] Vollständiger Name des privaten Betreibers ist vorhanden.
- [x] Die Anschrift besteht aus Straße und Hausnummer, Postleitzahl und Ort sowie Land.
- [x] Der Betreiber bestätigt, dass die Anschrift aktuell und zustellfähig ist.
- [x] Eine Kontakt-E-Mail-Adresse ist vorhanden und als `mailto:` verlinkt.
- [x] Der Betreiber bestätigt, dass die Kontaktadresse regelmäßig gelesen wird.
- [x] Die Live-Konfiguration enthält keine Platzhalterwerte.
- [-] Rechtsform und Vertretungsberechtigte sind für die natürliche Person nicht anwendbar.
- [-] Register und Registernummer sind mangels Eintragung nicht anwendbar.
- [-] Umsatzsteuer- oder Wirtschafts-ID ist mangels vorhandener Nummer nicht anwendbar.
- [-] Eine Aufsichtsbehörde ist nicht anzugeben; der Prototyp erbringt keine
  erlaubnispflichtige Versicherungsleistung.
- [-] Ein Verantwortlicher nach § 18 Abs. 2 MStV ist nicht anzugeben; die App ist kein
  journalistisch-redaktionelles Angebot.
- [-] Verbraucherstreitbeilegung ist nicht anzugeben; es gibt kein unternehmerisches
  Verbraucherangebot oder einen Verbrauchervertrag.
- [x] Ein Link zur früheren EU-OS-Plattform fehlt zu Recht; die zugrunde liegende
      Verordnung wurde zum 20. Juli 2025 aufgehoben.
- [ ] Falls die Seite später geschäftsmäßig oder für Vertragsabschlüsse genutzt wird:
      DDG-Anwendbarkeit neu bewerten und einen zweiten schnellen Kontaktweg vorsehen.
- [x] Bibliotheksnamen gehören nicht in die gesetzlichen Betreiberangaben des Impressums.
- [!] Vollständige Drittanbieter-Lizenztexte und Copyright-Hinweise werden mit Web-App
  und Downloadpaketen ausgeliefert.
- [!] Die ausgelieferten Geist-WOFF2-Dateien enthalten den vollständigen
  OFL-1.1-Lizenztext oder werden von einer mitgelieferten Lizenzdatei begleitet.
- [ ] Eine repository-eigene Datei `THIRD_PARTY_NOTICES` ist die einzige Quelle für
      Drittanbieterhinweise; der Build kopiert sie unverändert in die ausgelieferte
      Web-App und jedes Downloadpaket.

Nachweis:

> Live-Konfiguration enthält Name, dreizeilige Anschrift und E-Mail; optionale Felder für
> USt-ID, Register und Aufsicht sind `null`. Das Release enthält keine `LICENSE`,
> `NOTICE`- oder `THIRD_PARTY_NOTICES`-Datei. Installiert sind 496 Paketversionen über
> Laufzeit und Entwicklung: überwiegend MIT, außerdem Apache-2.0, ISC, BSD, OFL-1.1 und
> weitere permissive Lizenzen. Browser und kompilierte Releasepakete enthalten
> Drittanbietercode; der sichtbare Geist-Kurztext mit externem Link ersetzt die
> vollständigen Auslieferungshinweise nicht zuverlässig. Fehler W-002 erfasst.

Quellenstand 2026-09-03:

- [§ 5 DDG](https://www.gesetze-im-internet.de/ddg/__5.html)
- [§ 18 MStV](https://www.gesetze-bayern.de/Content/Document/MStV-18)
- [§ 36 VSBG](https://www.gesetze-im-internet.de/vsbg/__36.html)
- [EU-Verordnung 2024/3228](https://eur-lex.europa.eu/eli/reg/2024/3228/oj)
- [MIT-Lizenz](https://opensource.org/license/mit)
- [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0.html)
- [SIL Open Font License 1.1](https://software.sil.org/oflt/)

## 2. Globaler App-Rahmen

- [ ] Die Hauptnavigation zeigt `Prozesse`, `Prozess erfassen` und
      `Prozessdokumentation`.
- [ ] Der aktive Navigationspunkt ist eindeutig erkennbar.
- [ ] Logo und Startnavigation führen zuverlässig zur Prozessübersicht.
- [ ] Der Hinweis `Nur Demo-Daten verwenden` erscheint in einer frischen Browser-Sitzung.
- [ ] Der Demo-Hinweis nennt lokale Speicherung und Weitergabe an den konfigurierten
      KI-Dienst verständlich.
- [ ] Der Demo-Hinweis lässt sich für diesen Browser schließen.
- [ ] Der geschlossene Demo-Hinweis bleibt nach Navigation und Neuladen geschlossen.
- [ ] Footer-Links zu Impressum, Datenschutz und Nutzungshinweisen funktionieren.
- [ ] Kein normaler Bildschirm zeigt JSON, Prompttext, Dateipfade, Modellnamen,
      Terminaltext oder Git-Begriffe.
- [ ] Alle sichtbaren Produkttexte sind für deutschsprachige Versicherungsführungskräfte
      verständlich.

Nachweis:

> Noch einzutragen.

## 3. Prozessportfolio

- [ ] Die Überschrift `Prozesse` und der primäre Einstieg `Prozess erfassen` sind sichtbar.
- [ ] Die Seed-Prozesse zeigen plausible deutsche Versicherungsprozesse.
- [ ] Titel, Fachbereich, Status und nächster Schritt sind je Prozess verständlich.
- [ ] Suche filtert nach einem Titelbestandteil sofort und korrekt.
- [ ] Ein Filter ohne Treffer zeigt einen hilfreichen Leerzustand.
- [ ] Sortierung funktioniert für die angebotenen Spalten.
- [ ] Ein Klick auf eine Tabellenzeile öffnet den richtigen Prozess.
- [ ] Der explizite Prozesslink ist per Tastatur erreichbar.
- [ ] Zurücknavigation erhält eine sinnvolle Listenposition und Filterlage.
- [ ] Der Leitungswasserprozess führt zur erwarteten Prozess-ID.

Nachweis:

> Noch einzutragen.

## 4. Neuen Prozess anlegen

- [ ] `Prozess erfassen` öffnet die Anlage ohne Vorbelegung mit fremden Prozessdaten.
- [ ] Prozessname ist verpflichtend und erklärt sich selbst.
- [ ] Fachbereich lässt sich aus den sieben konfigurierten Werten wählen.
- [ ] Chat ist als primärer Erfassungsmodus verständlich beschrieben.
- [ ] Formular ist als alternativer Erfassungsmodus verständlich beschrieben.
- [ ] Ein ähnlicher vorhandener Prozessname löst einen verständlichen Hinweis aus.
- [ ] Der Nutzer kann nach dem Ähnlichkeitshinweis bewusst fortfahren oder abbrechen.
- [ ] Das Anlegen erzeugt genau einen neuen Prozess.
- [ ] Der neue Prozess erscheint anschließend im Portfolio.
- [ ] Der gewählte Erfassungsmodus bleibt nach der Anlage unveränderlich.

Nachweis:

> Noch einzutragen.

## 5. Chat-Erfassung: Einstieg und Unterlagen

- [ ] Ein neuer Chat-Prozess öffnet den einmaligen Drei-Schritte-Hinweis.
- [ ] Der Hinweis erklärt Unterlagen, freie Fachsprache und Prüfung des Prozessbilds.
- [ ] Abschließen oder Überspringen des Hinweises wird im Browser gemerkt.
- [ ] Vor der Unterlagenentscheidung ist das Gespräch blockiert.
- [ ] Unterstützte Demo-Unterlagen lassen sich hochladen.
- [ ] Dateiname, Typ und Status der Unterlage sind sichtbar.
- [ ] Die Vorschau öffnet die ausgewählte Unterlage verständlich.
- [ ] Eine Unterlage lässt sich für die KI-Verwendung an- und abwählen.
- [ ] Eine hochgeladene Unterlage lässt sich vor der Auswertung löschen.
- [ ] Nicht unterstützte oder manipulierte Dateien werden fachlich verständlich abgelehnt.
- [ ] `Unterlagen auswerten` startet genau eine sichtbare Verarbeitung.
- [ ] `Ohne Unterlagen fortfahren` öffnet das Gespräch ohne künstliche Dokumentevidenz.
- [ ] Nach der Auswertung ist die Dokumentabdeckung sichtbar.
- [ ] Vollständig, teilweise und nicht gelesene Unterlagen sind unterscheidbar.
- [ ] Seitenneuladen setzt den Unterlagenstatus nicht zurück.

Nachweis:

> Noch einzutragen.

## 6. Chat-Erfassung: Gespräch

- [ ] Der Assistent beginnt mit einer fachlich passenden Frage zum Ist-Prozess.
- [ ] Der Nutzer kann eine freie deutschsprachige Antwort senden.
- [ ] Während des Laufs sind Eingabe und Senden gegen Doppelabsenden geschützt.
- [ ] Sichtbare Aktivitäten verwenden ausschließlich sichere Produktbegriffe.
- [ ] Die Antwort erscheint erst vollständig und nicht als roher Provider-Stream.
- [ ] Der Verlauf bleibt nach Neuladen vollständig erhalten.
- [ ] Eine zweite Nutzernachricht setzt denselben Prozesskontext sinnvoll fort.
- [ ] Eine Korrektur wird in Gespräch und Prozessbild berücksichtigt.
- [ ] Unklare Angaben führen zu gezielten Rückfragen statt erfundenen Fakten.
- [ ] Der Assistent deckt Zweck, Ablauf, Rollen, Informationen, Entscheidungen,
      Übergaben, Aufwand, Probleme und Ziele ab.
- [ ] Die vier festen Arbeitsmerkmale werden im Gespräch belastbar abgedeckt.
- [ ] Evidenz aus Nutzeraussagen und Unterlagen bleibt unterscheidbar.
- [ ] Die UI zeigt keine internen Tool-Aufrufe, Reasoning-Texte oder Session-IDs.
- [ ] Ein Providerfehler zeigt eine handlungsfähige deutsche Meldung und Retry-Möglichkeit.
- [ ] Ein abgebrochener oder fehlgeschlagener Turn zerstört den letzten gültigen Stand nicht.

Nachweis:

> Noch einzutragen.

## 7. Prozessbild

- [ ] Vor dem ersten gültigen Stand erscheint ein datenfreier Platzhalter.
- [ ] Das Prozessbild aktualisiert sich während oder direkt nach dem Gespräch.
- [ ] Genau ein Start- und ein Endereignis sind sichtbar.
- [ ] Prozessschritte erscheinen in fachlich richtiger Reihenfolge.
- [ ] Jeder Schritt zeigt einen kurzen Namen und eine verständliche Tätigkeit.
- [ ] XOR-Entscheidungen erscheinen als Verzweigungen mit Frage.
- [ ] Alle Entscheidungszweige haben verständliche Labels.
- [ ] Vergrößern, Verkleinern, Verschieben und `Ansicht einpassen` funktionieren.
- [ ] `Prozessbild erweitern` nutzt die verfügbare Fläche sinnvoll.
- [ ] Ein Schritt öffnet die zugehörigen Details.
- [ ] Schrittdetails zeigen Eingaben, Ausgaben und erfasste Zusatzinformationen.
- [ ] Hover oder Fokus auf einen Schritt bietet eine Chat-Erwähnung an.
- [ ] Eine Schritt-Erwähnung erscheint als typisierte Markierung im Composer.
- [ ] Eine Übergangs-Erwähnung lässt sich ebenfalls in den Chat übernehmen.
- [ ] Nach Auswahl einer Erwähnung wechselt die schmale Ansicht zurück zum Gespräch.
- [ ] Das Diagramm bleibt read-only; es suggeriert kein manuelles Verschieben als Änderung.
- [ ] Ein vorübergehend ungültiger KI-Stand ersetzt nicht das letzte gültige Diagramm.
- [ ] Nutzer können keine freien Kommentar-Karten anlegen; das ist ein erfasstes
      zukünftiges Feature und kein Fehler dieses Laufs.

Nachweis:

> Noch einzutragen.

## 8. Prozess bestätigen

- [ ] Der Bestätigungsbutton bleibt gesperrt, solange kein gültiges Prozessbild vorliegt.
- [ ] Der aktuelle Stand zeigt offene Punkte und Widersprüche deutlich.
- [ ] Reine Annahmen erzwingen keinen zusätzlichen Bestätigungsdialog.
- [ ] Offene Punkte oder Widersprüche lösen den Override-Dialog aus.
- [ ] `Trotzdem bestätigen` erzeugt die Qualität `mit offenen Punkten`.
- [ ] Ein vollständiger Stand erzeugt die Qualität `vollständig`.
- [ ] Bestätigung erfolgt nur durch einen expliziten Nutzerklick.
- [ ] Nach Bestätigung ist der Chat-Prozess read-only.
- [ ] Die UI zeigt den Meilenstein `Prozess bestätigt`.
- [ ] Die Bestätigung startet die Potenzialanalyse im Hintergrund.
- [ ] Die Bestätigung startet die Wissensdestillation unabhängig davon.
- [ ] Die Bestätigung startet die Prozessdokumentation unabhängig davon.
- [ ] Ein Fehler eines Folgejobs nimmt die Prozessbestätigung nicht zurück.
- [ ] Der Prozess ist im Portfolio als bestätigt erkennbar.

Nachweis:

> Noch einzutragen.

## 9. Prozessdetail und Ist-Verständnis

- [ ] Das Prozessdetail zeigt Titel, Fachbereich, Status und Bestätigungsqualität.
- [ ] Die Seite macht aktuellen Zustand und nächsten sinnvollen Schritt klar.
- [ ] Übersicht, Beteiligte, Ablauf, Entscheidungen, Probleme und offene Punkte sind auffindbar.
- [ ] Herkunft und Konfidenz von Fakten sind verständlich dargestellt.
- [ ] Nutzeraussage, Dateievidenz, KI-Strukturierung, KI-Annahme und Bestätigung sind
      unterscheidbar.
- [ ] Beteiligte Rollen und Systeme entsprechen dem bestätigten Prozessbild.
- [ ] Mengen, Zeiten, Probleme und Verbesserungsziele zeigen keine erfundenen Werte.
- [ ] Offene Werte erscheinen als unbekannt oder offen und nicht als leere Wahrheit.
- [ ] Der Änderungsverlauf enthält Erfassung, KI-Aktionen und Bestätigung.
- [ ] Ein bestätigter Chat-Prozess bietet keine nachträgliche Bearbeitung an.
- [ ] Die vier Modulkarten Prozessverständnis, Dokumentation, KI-Potenziale und
      Potenzialbewertung zeigen korrekte Zustände.

Nachweis:

> Noch einzutragen.

## 10. PDD-Excel-Export

- [ ] Die PDD-Karte ist nur für einen passenden bestätigten Profil-3-Prozess aktiv.
- [ ] Ein Prozess mit offenen Punkten bleibt exportierbar und zeigt eine Warnung.
- [ ] `Excel erstellen` lädt genau eine `.xlsx`-Datei herunter.
- [ ] Der Dateiname identifiziert Prozess und Revision sinnvoll.
- [ ] Die Arbeitsmappe öffnet ohne Reparaturhinweis.
- [ ] Alle 17 Vorlagenblätter sind vorhanden.
- [ ] `Deckblatt` enthält die richtigen Prozess- und Bestätigungsdaten.
- [ ] `01_Prozessdefinition` enthält ausschließlich bestätigte Ist-Daten.
- [ ] `02_Prozessschritte` enthält Reihenfolge, Rollen, Ein- und Ausgaben korrekt.
- [ ] Unbekannte Werte stehen als `Nicht bekannt` in der Arbeitsmappe.
- [ ] Zukunftsfelder tragen den ausdrücklichen Ist-Scope-Hinweis.
- [ ] Blätter 4–17 bleiben fachlich unbefüllt.
- [ ] Ein zweiter Download liefert denselben fachlichen Inhalt ohne neuen KI-Aufruf.
- [ ] Der Export verändert weder Prozessverständnis noch Bestätigungsstand.
- [ ] Der Änderungsverlauf enthält den Export mit Zeit und Revision.

Nachweis:

> Noch einzutragen.

## 11. KI-Potenziale: Hypothesen

- [ ] Der Fortschritt nach Bestätigung ist ohne Neuladen sichtbar.
- [ ] Die Hypothesenphase zeigt Queue-, Lauf- und Abschlusszustand verständlich.
- [ ] Jede Hypothese verweist auf einen vorhandenen Prozessschritt.
- [ ] Jede Hypothese zeigt Problem, potenziellen Beitrag und Begründung.
- [ ] Evidenz und Annahmen sind getrennt erkennbar.
- [ ] Konfidenz erscheint als hoch, mittel oder niedrig und nicht als Pseudo-Score.
- [ ] Es werden keine Kosten, Finanzwerte oder erfundenen Nutzenwerte gezeigt.
- [ ] Es wird keine Priorisierungs- oder Freigabeaktion angeboten.
- [ ] Bei mindestens einer hohen Konfidenz werden nur hohe Hypothesen weitergegeben.
- [ ] Der definierte Medium-Fallback ist fachlich nachvollziehbar, falls er greift.
- [ ] Zu wenig belastbare Hypothesen führen zu einem klaren Leerzustand ohne Szenarien.
- [ ] Ein Fehler bietet genau einen bewussten Retry für die fehlgeschlagene Phase.

Nachweis:

> Noch einzutragen.

## 12. KI-Potenziale: drei Szenarien

- [ ] Nach erfolgreicher Analyse ist `Drei Szenarien im Vergleich` erreichbar.
- [ ] Genau assistives, delegiertes und agentisches Szenario werden gezeigt.
- [ ] Die zunehmende KI-Autonomie ist zwischen den drei Szenarien klar erkennbar.
- [ ] Jedes Szenario beschreibt, was sich gegenüber heute ändert.
- [ ] KI-Aufgaben, deterministische Automatisierung und Orchestrierung sind getrennt.
- [ ] Menschliche Aufgaben und Aufsicht sind in jedem Szenario konkret benannt.
- [ ] Aktionen nennen ihren Ausführungsmodus.
- [ ] Systemzugriffe nennen Modus, Zeitpunkt und Mechanismus.
- [ ] Voraussetzungen, Risiken, Annahmen und offene Fragen sind sichtbar.
- [ ] Einbezogene und ausgeschlossene Hypothesen widersprechen sich nicht.
- [ ] Evidenz und betroffene Prozessschritte sind nachvollziehbar.
- [ ] Szenarien sind read-only und bieten keine Bestätigung oder Freigabe an.
- [ ] Das agentische Szenario führt über `Bewertung öffnen` zur Bewertung.

Nachweis:

> Noch einzutragen.

## 13. Agentische Potenzialbewertung

- [ ] Ohne vorhandene Bewertung erklärt die Seite Zweck und Voraussetzung.
- [ ] `Bewertung erstellen` startet genau einen begrenzten KI-Aufruf.
- [ ] Queue- und Laufstatus bleiben während der Bewertung sichtbar.
- [ ] Ein Fehler zeigt `Erneut versuchen` und verändert kein altes Ergebnis.
- [ ] Nach Abschluss zeigt `Ergebnisüberblick` bewertete, offene und ausgeschlossene Kriterien.
- [ ] Die Kriterien erscheinen als kompakte Excel-ähnliche Tabelle.
- [ ] Zeilennummer, Kriterienname und Wert sind ohne Aufklappen sichtbar.
- [ ] Jede Zeile lässt sich inline auf- und zuklappen.
- [ ] Aufgeklappte Zeilen zeigen Skala, Begründung, Evidenz, Hypothesen und offene Informationen.
- [ ] Filter `Alle`, `Bewertet`, `Nicht ausreichend belegt` und `Ausgeschlossen` funktionieren.
- [ ] Nur hohe Konfidenz mit Evidenz, Hypothese und ohne Annahme erhält einen Score.
- [ ] Mittlere oder niedrige Konfidenz lässt das Scorefeld leer.
- [ ] Policy-ausgeschlossene Kriterien bleiben ohne Score.
- [ ] Gruppen- und Gesamtergebnisse bleiben ausdrücklich unberechnet.
- [ ] Finanz-, Regulatorik- und Compliance-Werte werden nicht erfunden.
- [ ] Eine veraltete Quellrevision erzeugt eine sichtbare Warnung.
- [ ] `Excel erstellen` ist erst nach abgeschlossener Bewertung aktiv.
- [ ] Der Download enthält dieselben gespeicherten Werte wie die Webansicht.
- [ ] Alle fünf Blätter der Vorlage bleiben vorhanden.
- [ ] Die vier Referenzblätter bleiben durch den Export unverändert.
- [ ] Wiederholter Export startet keinen KI-Aufruf und verändert die Bewertung nicht.
- [ ] Dateiname, Hash und Bewertungsrevision werden im Audit nachvollziehbar festgehalten.

Nachweis:

> Noch einzutragen.

## 14. Lebende Prozessdokumentation

- [ ] `/dokumentation` zeigt die Prozessdokumentation mit Seed-Prozessen.
- [ ] Der Baum gruppiert Prozesse unter verständlichen Fachbereichen.
- [ ] `index.md` und `katalog.json` bleiben in der Managementansicht verborgen.
- [ ] Ein Prozess öffnet das richtige lesbare Dokument.
- [ ] Frontmatter, JSON, Git-Begriffe und Provenance-Codes bleiben verborgen.
- [ ] Alle festen Abschnitte des Prozessdokuments erscheinen in sinnvoller Reihenfolge.
- [ ] Fehlende Inhalte erscheinen als `Keine Angaben erfasst`.
- [ ] Suche findet Treffer in Titeln.
- [ ] Suche findet Treffer im Volltext und markiert sie im Dokument.
- [ ] Trefferzahlen pro Dokument sind plausibel.
- [ ] Einklappen des Baums bleibt nach Neuladen erhalten.
- [ ] `Kopieren` legt HTML und Klartext in die Zwischenablage.
- [ ] `Als PDF exportieren` öffnet eine druckbare, sauber formatierte Ansicht.
- [ ] `Änderungsverlauf` zeigt Fassungen ohne Git-Vokabular.
- [ ] Eine geänderte Fassung zeigt einen verständlichen Vergleich.
- [ ] `Rücknahme` verlangt eine bewusste Bestätigung.
- [ ] Die Rücknahme erzeugt eine neue Fassung statt Historie zu löschen.
- [ ] Tabellen-Darstellung wird nicht als bestanden markiert; fehlendes GFM-Rendering ist
      ein bekannter Backlog-Punkt.

Nachweis:

> Noch einzutragen.

## 15. Einstellungen und Agent Brain

- [ ] Einstellungen zeigen den Bereich `Gelerntes Firmenwissen`.
- [ ] Glossar, Systeme, Zuständigkeiten, Muster und offene Fragen sind getrennt.
- [ ] Jeder Wissenseintrag zeigt eine verständliche Prozessquelle.
- [ ] Gelöschte oder unlesbare Quellen brechen die Ansicht nicht.
- [ ] Ein nach Chat-Bestätigung destillierter Fakt erscheint nach Abschluss.
- [ ] Konsolidierung wird nur durch einen bewussten Nutzerklick gestartet.
- [ ] Während einer Konsolidierung kann keine zweite gestartet werden.
- [ ] Konsolidierung erhält Quellen und entfernt keine unbestätigten Inhalte unbemerkt.
- [ ] Reset verlangt eine bewusste Bestätigung und erklärt die Wirkung.
- [ ] Ein Reset löscht Firmenwissen, aber keine Prozesse oder Prozessdokumente.
- [ ] Der Chat-Tutorialstatus lässt sich zurücksetzen.
- [ ] Die Dokumentations-Reconciliation lässt sich bewusst starten.
- [ ] Reconciliation ergänzt fehlende Dokumentation ohne bestätigte Prozesse zu ändern.
- [ ] Form-Prozesse speisen derzeit kein Firmenwissen; das ist ein bekannter Backlog-Punkt.

Nachweis:

> Noch einzutragen.

## 16. Formular-Erfassung als Regression

- [ ] Ein Formular-Prozess zeigt genau fünf Themenblöcke.
- [ ] Alle fünf Freitextantworten sind verpflichtend.
- [ ] Die vier festen Arbeitsmerkmale erscheinen am fachlich passenden Thema.
- [ ] `keine` und `unsicher` schließen andere Mehrfachauswahlen aus.
- [ ] Unterlagen lassen sich hochladen, auswählen, abwählen, ansehen und löschen.
- [ ] `Prüfen` startet genau eine begrenzte Follow-up-Operation.
- [ ] Vorherige Rückfragen werden als beantwortet oder offen nachvollzogen.
- [ ] Neue Rückfragen erscheinen am richtigen Themenblock.
- [ ] Antworten bleiben editierbar und ein weiterer Prüflauf ist möglich.
- [ ] Synthese erzeugt ein prüfbares Prozessverständnis.
- [ ] Übersicht, Schritte, Arbeitsmerkmale und offene Punkte lassen sich korrigieren.
- [ ] Jede menschliche Korrektur verlangt einen Grund.
- [ ] Schritte lassen sich einfügen, verschieben und entfernen, ohne Referenzen zu zerstören.
- [ ] Bestätigung mit offenen Punkten verlangt den Override.
- [ ] Bestätigung synchronisiert die Prozessdokumentation.
- [ ] Potenzialanalyse lässt sich anschließend bewusst starten.
- [ ] Form-Modus zeigt derzeit nur die lineare Schrittleiste; fehlende Gateway-Darstellung
      ist ein bekannter Backlog-Punkt.
- [ ] Form-Bestätigung startet derzeit keine Wissensdestillation; dies ist ein bekannter
      Backlog-Punkt.

Nachweis:

> Noch einzutragen.

## 17. Fehlerfälle, Sicherheit und Datenintegrität

- [ ] Alle geschützten API-Routen antworten ohne Sitzung mit 401.
- [ ] Fehlende Prozesse liefern eine fachliche 404-Ansicht oder sichere Weiterleitung.
- [ ] Falscher Erfassungsmodus wird mit einer verständlichen Meldung abgelehnt.
- [ ] Doppelklicks erzeugen keine doppelten Prozesse, Turns, Jobs oder Exporte.
- [ ] Lange laufende Aktionen zeigen Status statt einer eingefrorenen Oberfläche.
- [ ] Netzwerkunterbrechung bewahrt den letzten bestätigten oder gültigen Stand.
- [ ] Reload während eines laufenden Jobs nimmt den aktuellen Serverstatus wieder auf.
- [ ] Fehlertexte enthalten keine Stacktraces, Shellausgabe oder absolute Dateipfade.
- [ ] Downloads werden als private `no-store`-Antworten ausgeliefert.
- [ ] Uploads mit falscher Dateisignatur werden abgelehnt.
- [ ] Externe oder aktive Inhalte gelangen nicht in die Excel-Exporte.
- [ ] KI-Ausgaben ohne gültiges Schema verändern keine kanonischen Daten.
- [ ] Menschliche Korrekturen und Bestätigungen bleiben im append-only Audit erhalten.
- [ ] Gleichzeitige Chat-Tabs werden nicht als bestanden markiert; Backend-Locking fehlt
      bewusst und steht im Backlog.

Nachweis:

> Noch einzutragen.

## 18. Desktop, Tablet, Tastatur und visuelle Qualität

- [ ] Der komplette Primärfluss ist bei `1440 × 1000` ohne horizontales Seiten-Scrolling nutzbar.
- [ ] Chat und Prozessbild verwenden am Desktop eine sinnvolle 42/58-Aufteilung.
- [ ] Der komplette Review-Fluss ist bei `1024 × 900` nutzbar.
- [ ] Auf schmaler Breite wechseln Gespräch und Prozessbild über verständliche Tabs.
- [ ] Aktualisierungsindikatoren an inaktiven Tabs sind sichtbar und nicht störend.
- [ ] Tabellen bleiben scrollbar, ohne Aktionen oder erste Spalte zu verlieren.
- [ ] Fokusreihenfolge folgt dem sichtbaren Aufbau.
- [ ] Alle interaktiven Elemente haben einen sichtbaren Fokuszustand.
- [ ] Buttons und Links haben eindeutige zugängliche Namen.
- [ ] Modale Dialoge halten Fokus und schließen per Escape, sofern gefahrlos.
- [ ] Status wird nicht ausschließlich durch Farbe vermittelt.
- [ ] Kontrast, Schriftgrößen und Klickziele sind bei 100 % Zoom gut nutzbar.
- [ ] Browserzoom bei 125 % bleibt ohne verdeckte Kernaktionen nutzbar.
- [ ] Ladezustände verschieben die Seite nicht störend.
- [ ] Leere, Fehler- und Erfolgszustände wirken visuell konsistent.
- [ ] Es gibt keinen Dark Mode und keine vom Systemfarbschema abhängige Darstellung.
- [ ] Jeder geprüfte Bildschirm bleibt frei von Konsolenfehlern.
- [ ] Jeder geprüfte Bildschirm bleibt frei von unerwartet fehlgeschlagenen Requests.

Nachweis:

> Noch einzutragen.

## 19. Persönlicher End-to-End-Testfall

- [ ] Einen neuen LifeCorp-Chat-Prozess mit eindeutigem Testnamen anlegen.
- [ ] Mindestens eine plausible Versicherungsunterlage hochladen und auswerten.
- [ ] Den Ist-Prozess in freier Sprache vollständig erfassen.
- [ ] Mindestens eine gezielte Korrektur per Schritt-Erwähnung durchführen.
- [ ] Prozessbild fachlich gegen die eigene Beschreibung prüfen.
- [ ] Prozess trotz echter offener Frage bewusst bestätigen oder die Lücke vorher schließen.
- [ ] Prozessdetail und Änderungsverlauf prüfen.
- [ ] PDD exportieren und in Excel öffnen.
- [ ] Automatisch gestartete Potenzialanalyse bis zum Abschluss beobachten.
- [ ] Hypothesen auf Evidenz, Annahmen und Versicherungsrelevanz prüfen.
- [ ] Drei Aufsichtsszenarien vergleichen.
- [ ] Agentische Bewertung erzeugen und mindestens drei Zeilen aufklappen.
- [ ] Bewertungs-Excel exportieren und mit der Webansicht vergleichen.
- [ ] Veröffentlichtes Prozessdokument öffnen, suchen, kopieren und drucken.
- [ ] Neuen Firmenwissenseintrag samt Quelle in Einstellungen finden.
- [ ] Browser auf unerwartete Fehler prüfen.
- [ ] Prozess nach Neuladen und neuer Anmeldung unverändert wiederfinden.

Nachweis:

> Noch einzutragen.

## Fehlerprotokoll

| ID    | Bereich     | Beobachtung                                                                             | Reproduktion                                                                           | Erwartung                                                                                                                                       | Schwere | Status |
| ----- | ----------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------ |
| W-001 | Datenschutz | Seite nennt `Anthropic` und `Claude-CLI`, Dienst nutzt `codex-cli`.                     | Ohne Anmeldung `/datenschutz` öffnen, Abschnitt 7 lesen.                               | Anbieterneutrale oder zur aktiven Konfiguration passende Information.                                                                           | Hoch    | Offen  |
| W-002 | Lizenzen    | Web-Build und Releasepakete enthalten keine vollständigen Drittanbieter-Lizenzhinweise. | Release bauen; `dist/` nach `LICENSE`, `NOTICE` und `THIRD_PARTY_NOTICES` durchsuchen. | Repository-Datei `THIRD_PARTY_NOTICES` als Quelle; unverändert in Web-Build und Downloadpakete kopiert, einschließlich vollständiger Geist-OFL. | Hoch    | Offen  |

## Abschlussentscheidung

- [ ] Keine Blocker im persönlichen Primärfluss.
- [ ] Alle fehlgeschlagenen Punkte sind im Fehlerprotokoll erfasst.
- [ ] Alle bekannten Produktgrenzen wurden von neuen Regressionen getrennt.
- [ ] Beide Excel-Artefakte wurden außerhalb des Browsers geöffnet und stichprobenartig geprüft.
- [ ] Desktop- und Tablet-Kernfluss sind frei von Konsolen- und Netzwerkfehlern.
- [ ] Das Ergebnis ist für den Prototypentest freigegeben.

Entscheidung:

> Noch offen.
