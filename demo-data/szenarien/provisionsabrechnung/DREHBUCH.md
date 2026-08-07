# Drehbuch: Provisionsabrechnung Außendienst

Fachbereich **Vertrieb** bei der LifeCorp Versicherung. Der dokumentenlose Fall: Es
gibt keine schriftliche Prozessdokumentation, der Ablauf lebt in Eddas Kopf. Dieses
Szenario prüft die Gesprächsführung des Assistenten ohne jede Textstütze — keine
Unterlagen zum Nachlesen, alles muss im Chat erfragt werden.

## Persona

**Edda Brandt**, Sachbearbeiterin Vertriebsunterstützung, Mitte 50, seit über 20
Jahren im Haus. Sie kennt ihre Arbeit im Detail, aber nicht das Vokabular der
Prozessmodellierung. Ihre Antworten sind knapp, praktisch, manchmal lückenhaft —
und einmal schweift sie kurz vom Thema ab, wie es im echten Gespräch passiert.

E-Mail: `edda.brandt@lifecorp.example`

## Spielanleitung

1. Prozess über `bun run seed provisionsabrechnung` anlegen (oder per Sidecar an
   einem vorhandenen Chat-Prozess mit passendem `processName`).
2. Der Chat beginnt mit der Dokumentenfrage. **Dieses Szenario hat bewusst keinen
   `dokumente/`-Ordner** — im UI **„ohne Dokumente fortfahren"** wählen, danach Zug 1
   als Antwort auf die Nachfrage des Assistenten senden bzw. direkt vor dem Klick
   abschicken, je nachdem wie der Assistent die Ablehnung aufgreift.
3. Danach die Züge 2–14 der Reihe nach im Composer abschicken (Sidecar-Klick oder von
   Hand aus `drehbuch.json`). Antworten hier nicht wiederholt, nur Zugnummer.
4. Ergebnis am Ende dieses Dokuments unter „Erwartungen an das fertige
   Prozessverständnis" und „Erwartungen an die Potenzialanalyse" prüfen.

## Züge und Erwartungen

**Zug 1** — Erwartung: Assistent akzeptiert das Fehlen von Dokumenten sachlich und
wechselt ohne Umschweife in die reine Gesprächsaufnahme, keine Nachfrage nach
Unterlagen, die es laut Edda nicht gibt. Fehlersignatur: Assistent besteht auf
Dokumenten oder unterstellt, dass doch etwas existieren müsse.

**Zug 2** — Erwartung: Die Antwort ist absichtlich zu knapp für ein belastbares
Prozessbild. Der Assistent sollte gezielt nachfassen (Auslöser, Ergebnis, Umfang),
statt mit dem Einzeiler weiterzuarbeiten oder unstrukturiert mehrere Themen auf
einmal abzufragen. Fehlersignatur: Assistent stellt mehrere unabhängige Fragen in
einer Nachricht oder springt sofort zu Rollen/Systemen, ohne erst Zweck und
Abgrenzung zu klären.

**Zug 3** — Erwartung: Auslöser (Buchungsschluss), Rhythmus (monatlich) und
Zielergebnis (Auszahlung/Gutschrift) werden als solche erfasst.

**Zug 4** — Erwartung: Mengenangabe (ca. 120 Außendienstler, ca. 40 Makler) landet im
Verständnis, idealerweise mit Hinweis auf die Schwankung.

**Zug 5** — Erwartung: PROVISO als automatisch rechnendes System und als erster
Hauptschritt korrekt benannt.

**Zug 6** — Erwartung: Stornohaftung erscheint im Verständnis — inklusive
Rückbelastung bei Storno in der Haftungszeit und dass Edda die automatisch
gerechneten Fälle gegenprüft, statt PROVISO blind zu vertrauen. Zentraler Prüfpunkt
dieses Szenarios.

**Zug 7** — Erwartung: Manuelle Korrekturen bei Vertragsänderungen als eigener
Schritt/Entscheidung erfasst. Gute Rückfrage wäre, woran Edda erkennt, dass eine
Änderung noch nicht nachgezogen ist — wenn das offenbleibt, gehört es als
Wissenslücke ins Verständnis.

**Zug 8** — Bewusste Ablenkung (Außendienst-Workshop, irrelevant für die Abrechnung).
Erwartung: Der Assistent nimmt die Information nicht in den Prozessschritten oder
Systemen auf und lenkt das Gespräch zurück zur Abrechnung. Fehlersignatur: Workshop
wird fälschlich als Prozessschritt, System oder Termin im Ablauf geführt.

**Zug 9** — Zentraler Prüfpunkt: Die Excel-Sonderliste für Maklersondervereinbarungen
muss im Verständnis auftauchen — inklusive der Tatsache, dass sie **eine Kollegin
aus dem Vertriebsinnendienst pflegt**, nicht Edda selbst. Das ist die typische
gewachsene Ecke des Prozesses (Single Point of Failure außerhalb von Eddas
Zuständigkeit).

**Zug 10** — Bewusste Wissenslücke (Aufbau der Excel-Liste unbekannt). Erwartung:
Als `knowledgeGap` oder als bewusst unbeschriebene Systemgrenze erfasst.
Fehlersignatur: Assistent erfindet einen Aufbau, Spalten oder Inhalte der
Excel-Liste, die Edda nie genannt hat, oder behauptet Wissen über eine Unterlage,
die es in diesem Szenario gar nicht gibt.

**Zug 11** — Erwartung: SAP FI als Abstimmungssystem für die Auszahlung erfasst,
inklusive sauberer Rollentrennung — die Finanzbuchhaltung zahlt aus, Edda liefert
nur freigegebene Beträge.

**Zug 12** — Erwartung: Reklamationsbearbeitung per Outlook als eigener Schritt,
unstrukturiert (keine Vorlage, kein Ticketsystem), Edda sortiert selbst.

**Zug 13** — Erwartung: Zeitdruck zum Monatsabschluss wird als Aufwands-/
Problempunkt erfasst, nicht als zusätzlicher Regelschritt im Hauptablauf.

**Zug 14** — Erwartung: Eskalationsregel bei größeren Abweichungen (Rücksprache mit
Teamleitung) rundet Entscheidungen/Kontrollen ab.

## Zentrale Prüfpunkte

- **Strukturiertes Nachfassen statt Themenspringen**: Der Assistent sollte den
  Interviewfaden erkennbar entlang der Themen aus
  `defaults/process-capture-config.json` führen (Zweck, Ablauf/Rollen,
  Informationen/Systeme, Entscheidungen, Aufwand), statt bei jeder Antwort in ein
  neues Thema zu springen oder mehrere Fragen gleichzeitig zu stellen.
- **Excel-Nebenliste muss auftauchen** (Züge 9–10), inklusive der Kollegin als
  Pflegeperson und der offenen Wissenslücke zum Aufbau.
- **Stornohaftung muss auftauchen** (Zug 6), inklusive Rückbelastung in der
  Haftungszeit.
- **Fehlersignatur, die den ganzen Chat betrifft**: Der Assistent erfindet
  Dokumenteninhalte oder behauptet Dokumentwissen (z. B. „laut Ihrer
  Verfahrensanweisung …"), obwohl in diesem Szenario keine Dokumente vorliegen.
  Jede Bezugnahme auf eine Unterlage ist hier ein Fehler.

## Erwartungen an das fertige Prozessverständnis

- Hauptablauf mit PROVISO-Lauf, Stornohaftungsprüfung, manuellen Korrekturen bei
  Vertragsänderungen, Abstimmung mit SAP FI und Reklamationsbearbeitung über
  Outlook als erkennbare, geordnete Schritte.
- Systeme korrekt benannt: PROVISO, PARTO (Vermittlerdaten, ergibt sich implizit aus
  dem Kontext, ggf. gute Rückfrage wert, falls Edda es nicht von selbst nennt),
  SAP FI, Outlook.
- Rollen sauber getrennt: Edda (Sachbearbeitung/Prüfung), Kollegin
  Vertriebsinnendienst (Excel-Sonderliste), Finanzbuchhaltung (SAP FI-Auszahlung),
  Teamleitung (Eskalation bei größeren Abweichungen).
- Mengengerüst (ca. 120 Außendienstler, ca. 40 Makler) und Rhythmus (monatlich, nach
  Buchungsschluss) im Verständnis sichtbar.
- Wissenslücke zum Aufbau der Excel-Sonderliste dokumentiert statt stillschweigend
  aufgefüllt.
- `documentGate` auf `skipped`, keine `documentCoverage`-Einträge, keine erfundenen
  Belege.

## Erwartungen an die Potenzialanalyse

Naheliegende, evidenzbasierte Hypothesen für dieses Szenario:

- **Excel-Sonderliste ablösen**: Die Sondervereinbarungen der Makler strukturiert in
  einem System statt in einer von einer Kollegin allein gepflegten Excel-Liste
  vorzuhalten, senkt Abstimmungsaufwand und Personenabhängigkeit.
- **Reklamationen strukturieren**: Die unstrukturiert per Outlook eingehenden
  Reklamationen in einen geführten, nachvollziehbaren Bearbeitungsweg zu überführen,
  statt sie einzeln per Mail zu sortieren.
- **Dunkelverarbeitung der Standardläufe**: Der PROVISO-Standardlauf und die
  Stornohaftungsprüfung für die Mehrzahl der unauffälligen Fälle laufen bereits
  automatisch bzw. ließen sich in den Regelfällen weiter automatisiert
  gegenprüfen, sodass Eddas manuelle Prüfung sich auf Korrektur- und Sonderfälle
  konzentriert.

Fehlersignatur für diesen Teil: Hypothesen, die sich nicht auf die im Gespräch
belegten Reibungspunkte stützen (z. B. allgemeine KI-Vorschläge ohne Bezug zur
Excel-Liste, den Reklamationen oder der Stornohaftung), oder die stillschweigend
Bewertung, Priorisierung oder Kosten einführen, statt bei Hypothesen zu bleiben.
