# Discovery — KI-Potenzialhypothesen und Szenarien

## Status und Zweck

Status: abgestimmte und implementierte Discovery-Grundlage. Die verbindlichen
Implementierungsdetails und Abnahmekriterien stehen in
[`PLAN-KI-POTENTIAL-SCENARIOS.md`](./PLAN-KI-POTENTIAL-SCENARIOS.md).

Die bestehende Prozessaufnahme endet weiterhin mit einem fachlich bestätigten,
strukturierten Prozessbild. Ein neues, getrennt entwickelbares Modul soll auf
Anforderung eines KI-Verantwortlichen mögliche KI-Potenziale in diesem Prozess
entdecken und daraus bis zu drei nachvollziehbare Ausbauszenarien ableiten.

Das Modul endet mit den Szenarien. Wirtschaftliche Kennzahlen,
Umsetzbarkeitsbewertung, Scoring, Priorisierung und Portfolio-Ranking werden
explizit später definiert.

## Ausgangslage

Die Prozessaufnahme stellt bereits die fachliche Grundlage bereit:

- Zweck, Auslöser, Ergebnis und Grenzen des Prozesses;
- fünf bis acht chronologisch geordnete Hauptschritte;
- Rollen, Informationen, Dokumente und Systeme;
- Entscheidungen, Kontrollen und Übergaben;
- Volumen- und Zeitangaben, Engpässe und Verbesserungsziele;
- Evidenz, Provenienz, Annahmen, Konflikte und Wissenslücken.

Frühere Versuche haben gezeigt, dass eine KI-Potenzialbewertung vor dem
Prozessverständnis zu falschen negativen Entscheidungen führen kann. Außerdem
sind Nutzen, Kosten, Risiko und Machbarkeit nicht Eigenschaften eines abstrakten
Prozesses, sondern eines konkret definierten Zukunftsszenarios.

Das neue Modul schließt genau diese Lücke zwischen bestätigtem Ist-Prozess und
einer späteren Szenariobewertung.

## Zielbild

```text
Bestätigter Prozess
        ↓ manueller Start
Phase 1: Prozessschritte untersuchen und Potenzialhypothesen erzeugen
        ↓ validierter Übergang mit hoher oder gebündelter mittlerer Evidenzbasis
Phase 2: Assistiertes, teilautonomes und agentisches Szenario erzeugen
        ↓
Read-only-Ergebnis als Grundlage einer späteren Bewertung
```

Das Modul beantwortet zwei Fragen:

1. An welchen Stellen des heutigen Prozesses gibt es nachvollziehbare
   KI-Potenziale?
2. Wie könnte der Prozess in drei unterschiedlich weitreichenden
   Ausbauszenarien aussehen?

## Produktgrenze

### Im Umfang

- manueller Start aus der Prozessübersicht;
- Verarbeitung ausschließlich bestätigter Prozessbilder;
- Untersuchung jedes Hauptschritts auf KI-Potenziale;
- null bis mehrere begründete Hypothesen je Prozessschritt;
- Potenzial- und Konfidenzeinordnung jeder Hypothese;
- deterministische Auswahl ausreichend belegter Hypothesen als Szenarioeingabe;
- standardmäßig drei Szenarien: `assistive`, `delegated`, `agentic`;
- live aktualisierte, wieder aufrufbare Zwei-Phasen-Oberfläche;
- versionierte, phasenspezifische KI-Anweisungen und Antwortschemata;
- persistente, nachvollziehbare KI-Ergebnisse mit Prozessreferenz,
  Evidenz, Annahmen und Promptversionen.

### Explizit außerhalb des Umfangs

- monetäre Werte, Einsparungen, ROI und Amortisation;
- Machbarkeits-, Risiko-, Nutzen- oder Reifegradscoring;
- Gewichtung, Priorisierung und Ranking;
- Entscheidung für ein umzusetzendes Szenario;
- manuelles Erstellen, Bearbeiten oder Löschen einzelner Hypothesen;
- Bearbeiten der erzeugten Szenarien;
- fachlich motivierte Neuberechnung oder Variantenbildung;
- Rückfragen- oder Chatflow innerhalb des neuen Moduls;
- technische Lösungsarchitektur oder Produktauswahl;
- automatische Analyse aller vorhandenen Prozesse;
- Rollen- und Berechtigungsverwaltung für KI-Verantwortliche.

## Akteur, Start und Vorbedingungen

Der fachliche Akteur ist der KI-Verantwortliche für den jeweiligen Prozess. Im
Prototyp wird dafür kein zusätzliches Rollenmodell eingeführt; jeder bereits
authentifizierte Benutzer kann die Aktion ausführen.

Die Aktion `KI-Potenziale entdecken` ist nur verfügbar, wenn:

- der Prozess den Zustand `confirmed` besitzt;
- ein bestätigtes Prozessverständnis vorhanden ist;
- fünf bis acht Prozessschritte vorhanden sind;
- für die aktuelle bestätigte Prozessversion noch keine abgeschlossene
  Potenzialanalyse existiert.

Der Benutzer startet die Pipeline genau einmal manuell aus der
Prozessübersicht. Es gibt keinen automatischen Nachtlauf und keine automatische
Verarbeitung neu bestätigter Prozesse.

## Phasenmodell

### Phase 1 — Potenzialhypothesen

Jeder bestätigte Prozessschritt wird einzeln untersucht. Das Modell muss für
jeden Schritt eine kurze Einordnung liefern, darf aber bei fehlendem oder
schwachem Signal null Hypothesen zurückgeben. Eine erzwungene Hypothese je
Schritt würde unbelegte Einsatzideen erzeugen und ist nicht zulässig.

Die Analyse eines Schritts enthält:

- Referenz und Reihenfolge des Prozessschritts;
- kurze Einordnung des erkennbaren KI-Potenzials;
- Begründung, wenn kein belastbares Potenzial erkennbar ist;
- null bis mehrere Potenzialhypothesen.

Jede Potenzialhypothese enthält mindestens:

- stabile ID;
- Prozessschritt-ID und Prozessschrittreihenfolge;
- kompakter Titel;
- Beschreibung der heutigen Ausgangslage;
- Beschreibung des möglichen KI-Beitrags;
- erwartete qualitative Veränderung;
- Erklärung der KI-spezifischen Fähigkeit innerhalb der möglichen Lösung;
- voraussichtlich unterstützende deterministische Abläufe;
- fachlich benötigte Informationen und Systemzugriffe, ohne eine konkrete
  Integrationsarchitektur vorzugeben;
- erwartete Rolle des Menschen;
- qualitative Potenzialstufe;
- qualitative Konfidenzstufe;
- kompakte Begründung der beiden Einstufungen;
- Referenzen auf verwendete Prozessfakten und Evidenz;
- materielle Annahmen;
- offene Informationen.

#### Potenzial und Konfidenz

Potenzial und Konfidenz sind unabhängig voneinander:

- `potentialLevel` beschreibt die vermutete Stärke der möglichen fachlichen
  Verbesserung.
- `confidenceLevel` beschreibt, wie gut die Hypothese durch das bestätigte
  Prozessbild belegt ist.

Für beide Felder werden die Werte `high`, `medium` und `low` verwendet. Es gibt
in dieser Phase keine numerischen Scores.

Konfidenz wird nach folgenden Regeln vergeben:

- `high`: direkt durch bestätigte Angaben oder Dateievidenz gestützt und ohne
  wesentliche ungeklärte Annahme;
- `medium`: fachlich plausibel, aber von mindestens einer materiellen Annahme
  oder fehlenden Information abhängig;
- `low`: überwiegend spekulativ oder durch wesentliche Wissenslücken geprägt.

Die Potenzialstufe beschreibt ausschließlich den qualitativen Umfang der
möglichen Verbesserung:

- `high`: adressiert einen zentralen Prozessschritt, wesentlichen Engpass oder
  ein ausdrücklich genanntes Verbesserungsziel;
- `medium`: bietet eine klar erkennbare, aber begrenzte Verbesserung;
- `low`: bietet nur eine kleine, optionale oder indirekte Verbesserung.

Diese Einstufung ist noch keine spätere Nutzen- oder Umsetzbarkeitsbewertung.

#### KI, Automation, Integration und Autonomie

Rein deterministische Verbesserungsideen sind keine KI-Potenzialhypothesen.
Eine Hypothese bleibt aber ein gültiges KI-Potenzial, wenn ihre spätere Lösung
zusätzlich klassische Automation, Integration oder Orchestrierung benötigt.
Realistische KI-Lösungen bestehen regelmäßig aus einer Kombination dieser
Elemente.

Das Modul unterscheidet deshalb:

- **KI-Fähigkeit:** Interpretation, Generierung, probabilistische Erkennung,
  kontextabhängige Empfehlung oder Planung;
- **deterministische Automation:** feste Regeln, Validierungen, Trigger und
  wiederholbare Prozessschritte;
- **Integration:** Lesen, Schreiben oder Auslösen von Aktionen in anderen
  Systemen;
- **Orchestrierung:** Reihenfolge, Status, Übergaben, Wiederholungen und
  Fehlerbehandlung innerhalb eines Ablaufs;
- **Autonomie:** Umfang der Entscheidungen und Aktionen, die KI ohne vorherige
  Einzelfreigabe ausführen darf;
- **menschliche Kontrolle:** Freigaben, Überwachung, Stichproben, Ausnahmen und
  Eskalationen.

Eine Hypothese ist als KI-Potenzial zulässig, wenn mindestens eine materielle
Aufgabe von variablen, sprachlichen, visuellen, probabilistischen oder
kontextabhängigen Anforderungen geprägt ist und KI dafür einen nachvollziehbaren
fachlichen Beitrag leisten kann. Der Umfang zusätzlich notwendiger Automation
oder Integration senkt weder Potenzial noch Konfidenz. Er wird als Voraussetzung
dokumentiert und erst in einer späteren Phase auf Umsetzbarkeit bewertet.

Integrationstiefe und Integrationsmechanismus werden ebenfalls getrennt. Ein
MCP-Server, eine API, ein vorhandener Connector oder UI-Automation können einem
Agenten Systemzugriff geben; sie beseitigen den Integrationsbedarf nicht. Für die
Discovery wird zunächst beschrieben:

- welches System oder welche Informationsquelle benötigt wird;
- ob gelesen, geschrieben, beobachtet oder eine Aktion ausgelöst werden muss;
- ob der Zugriff sofort, ereignisbasiert oder im Bearbeitungsfall benötigt wird;
- welcher Zugriffsweg plausibel erscheint oder noch ungeklärt ist.

MCP darf als möglicher standardisierter Werkzeugzugriff genannt werden. Das
Ergebnis darf nicht behaupten, dass ein geeigneter MCP-Server, Connector oder
eine belastbare Berechtigung bereits vorhanden ist.

#### Deterministische Sortierung

Die UI sortiert nicht nach der zufälligen Reihenfolge der Modellantwort. Sie
verwendet folgende feste Reihenfolge:

1. Prozessschrittreihenfolge aufsteigend;
2. innerhalb eines Schritts Potenzial `high`, `medium`, `low`;
3. bei gleicher Potenzialstufe Konfidenz `high`, `medium`, `low`;
4. bei weiterem Gleichstand stabile Hypothesen-ID.

### Übergang zwischen den Phasen

Die Antwort aus Phase 1 wird vollständig gegen das versionierte Schema und die
fachlichen Regeln validiert und atomar gespeichert. Erst danach darf Phase 2
beginnen.

Als Eingabe für Phase 2 dienen alle Hypothesen mit `confidenceLevel: high`.
Existiert keine solche Hypothese, startet Phase 2 ersatzweise ab mindestens zwei
Hypothesen mit `confidenceLevel: medium`; verwendet werden höchstens die drei
nach Potenzial und Prozessreihenfolge priorisierten mittleren Hypothesen. Eine
einzelne mittlere oder ausschließlich niedrige Hypothesen reichen nicht.

Die Auswahlbasis wird als `high` oder `medium_fallback` gespeichert und an
Phase 2 übergeben. Bei `medium_fallback` weist die UI auf fachlichen
Klärungsbedarf hin, und kein Szenario darf hohe Konfidenz ausweisen. Hypothesen,
die nicht ausgewählt wurden, bleiben sichtbar. Das Modell darf die
deterministische Schwelle nicht selbst verändern.

Wenn die Auswahlregel keine Szenarioeingabe liefert, endet die Pipeline nach
Phase 1 erfolgreich ohne Szenarien und zeigt die Informationslücken. Andernfalls
startet Phase 2 automatisch. Es gibt keinen fachlichen Bestätigungs- oder
Auswahlstopp zwischen den Phasen.

### Phase 2 — Szenarien

Phase 2 erhält:

- einen unveränderten Snapshot des bestätigten Prozessbilds;
- die deterministisch ausgewählten Hypothesen samt Auswahlbasis;
- die versionierten Szenario-Anweisungen;
- das versionierte Szenario-Antwortschema.

Sie erzeugt standardmäßig genau drei Szenarien:

1. `assistive` — Assistiert
2. `delegated` — Teilautonom
3. `agentic` — Agentisch

Die drei Szenarien sind unterschiedlich weitreichende, in sich schlüssige
Zukunftsbilder desselben Prozesses. Ihre primäre Vergleichsdimension ist die
Arbeitsteilung zwischen Mensch und KI. Prozessumfang, Integration und
Orchestrierung dürfen sich ebenfalls unterscheiden, müssen aber getrennt von der
Autonomie beschrieben werden. Die Szenarien dürfen passende Hypothesen
kombinieren und müssen ihre Auswahl transparent machen.

#### Assistiert — Mensch führt aus

- kleinster sinnvoller KI-Einsatz;
- Fokus auf die stärkste, einfach abgrenzbare Hypothese;
- KI analysiert, empfiehlt oder erstellt Entwürfe;
- der Mensch entscheidet und führt jede relevante fachliche Aktion aus;
- Systemzugriff kann über manuelle Eingabe, Upload oder Export erfolgen;
- schreibende Aktionen der KI sind nicht erforderlich.

#### Teilautonom — Mensch bestätigt wichtige Schritte

- mehrere fachlich zusammenpassende Hypothesen;
- KI führt klar begrenzte, risikoarme Routineaufgaben selbst aus;
- der Mensch bestätigt wichtige Entscheidungen, Aktionen oder Fallgruppen;
- gezielter lesender oder schreibender Systemzugriff ist möglich;
- deterministische Regeln und Orchestrierung sichern Grenzen, Status und
  Übergaben ab;
- Menschen bearbeiten Ausnahmen und kritische Fälle.

#### Agentisch — Mensch überwacht und übernimmt kritische Fälle

- strategische Vision für die breiteste fachlich kohärente Nutzung der
  ausgewählten Hypothesen;
- ein Agent plant und bearbeitet risikoarme Fälle innerhalb definierter
  Leitplanken über mehrere Schritte hinweg;
- der Mensch definiert Leitplanken, überwacht Ergebnisse und übernimmt
  kritische, ungewöhnliche oder eskalierte Fälle;
- kritische Aktionen bleiben Human-in-the-loop, während risikoarme Aktionen
  unter Human-on-the-loop-Aufsicht autonom erfolgen können;
- benötigte Systemzugriffe können über freigegebene Werkzeuge, APIs, Connectoren
  oder MCP-Server erfolgen und benötigen nicht zwingend eine vollständige native
  Einbettung in jedes Bestandssystem;
- Kontroll-, Rückfall-, Berechtigungs- und Freigabemechanismen werden
  ausdrücklich beschrieben.

`Agentisch` bedeutet weder unkontrollierte Vollautomatisierung noch bestätigte
kurzfristige Machbarkeit. Das Szenario ist ein begründetes Zukunftsbild und darf
von zukünftig zu schaffenden Integrationen, Berechtigungen und Kontrollen
ausgehen. Es muss diese Voraussetzungen sichtbar machen und relevante
menschliche Entscheidungshoheit erhalten.

Für jede relevante Aktion legt ein Szenario eine Ausführungsregel fest:

- `autonomous`: KI darf innerhalb der beschriebenen Leitplanken selbst handeln;
- `approval_required`: ein Mensch muss die Aktion vor der Ausführung freigeben;
- `human_only`: Entscheidung oder Handlung bleibt vollständig beim Menschen.

Die KI darf nicht endgültig festlegen, welche Kunden, Fälle oder Aktionen im
Unternehmenskontext tatsächlich risikoarm sind. Sie beschreibt plausible
Risikomerkmale und Eskalationsauslöser als zu bestätigende Annahmen. Dazu können
hoher Kundenwert, Enterprise-Kunden, rechtliche Auswirkungen, hohe finanzielle
Folgen, ungewöhnliche Daten oder geringe Modellkonfidenz gehören.

Jedes Szenario enthält mindestens:

- Szenariotyp, Titel und kompakte Zusammenfassung;
- Zielbild und Umfang;
- enthaltene Hypothesen-IDs;
- nicht enthaltene ausgewählte Hypothesen mit Ausschlussbegründung;
- betroffene Prozessschritte;
- konkrete Veränderung gegenüber dem heutigen Ablauf;
- KI-Verantwortlichkeiten und KI-spezifische Fähigkeiten;
- unterstützende deterministische Automation und Orchestrierung;
- Aufgaben und Verantwortlichkeiten des Menschen;
- relevante Aktionen mit `autonomous`, `approval_required` oder `human_only`;
- Eskalationsauslöser, menschliche Überwachung und Ausnahmewege;
- benötigte Informationen und Dokumente;
- benötigte Systemzugriffe mit Lese-, Schreib-, Beobachtungs- oder Aktionsbedarf;
- plausible Zugriffsmechanismen, darunter manuell, Export, API, Connector,
  MCP-Werkzeugzugriff, UI-Automation oder `unknown`;
- notwendige Kontrollen;
- Voraussetzungen und Abhängigkeiten;
- Risiken und plausible Fehlerbilder ohne numerische Bewertung;
- Annahmen und offene Fragen;
- Evidenzreferenzen und zusammenfassende Konfidenz.

Die Szenarien dürfen keine erfundenen Geldbeträge, Einsparungen,
Implementierungszeiten oder technischen Machbarkeitszusagen enthalten.

## Bedienkonzept

### Prozessübersicht

Ein bestätigter Prozess erhält die sekundäre Aktion
`KI-Potenziale entdecken`. Nicht bestätigte Prozesse zeigen diese Aktion nicht.
Existiert bereits eine Analyse, führt die Aktion beziehungsweise der
Statusindikator zum vorhandenen Ergebnis; sie startet keine Neuberechnung.

Der Prozessstatus der Prozessaufnahme bleibt `confirmed`. Der Fortschritt der
Potenzialanalyse wird getrennt angezeigt.

### Potenzialdetailseite

Die neue Detailseite besitzt einen sichtbaren Zwei-Schritt-Stepper:

1. `Potenzialhypothesen`
2. `KI-Szenarien`

Während Phase 1 läuft, ist der erste Schritt aktiv und der zweite noch nicht
verfügbar. Nach erfolgreicher Phase 1 bleiben die Hypothesen sichtbar, während
Phase 2 ihren eigenen Laufstatus zeigt. Sobald Phase 2 begonnen hat, kann der
Benutzer zwischen beiden Schritten wechseln. Nach Abschluss bleiben beide
Ansichten frei zugänglich.

Die Hypothesenansicht gruppiert Karten nach den chronologisch angeordneten
Prozessschritten. Jede Karte zeigt mindestens Titel, Erklärung, Potenzial,
Konfidenz, KI-Begründung, Evidenz, Annahmen und offene Punkte.

Die Szenarioansicht zeigt Assistiert, Teilautonom und Agentisch auf dem Desktop
als drei ausgerichtete Vergleichsspalten. Titel, kurzer Pitch, Konfidenz,
betroffene Prozessschritte, enthaltene Potenziale, Rolle des Menschen und
KI-Fähigkeiten stehen in identischen Zeilen und sind ohne Öffnen vergleichbar.
Genau ein Szenario kann seine vollständigen Inhalte in einer gemeinsamen,
spaltenübergreifenden Detailfläche darunter zeigen. Auf Tabletbreite stehen die
drei Szenarien untereinander. Diese Vergleichsansicht ersetzt die frühere Idee
horizontaler Szenariozeilen.

### Bedeutung von „live aktualisiert“

Der Browser aktualisiert Laufstatus und verfügbare Phasenergebnisse ohne
manuelles Neuladen. Persistierte Ergebnisse sind nach einem Browser-Refresh
weiter sichtbar.

Für den Prototyp werden nur vollständig validierte Phasenergebnisse
veröffentlicht:

- während eines Modellaufrufs wird der Laufstatus aktualisiert;
- nach Abschluss von Phase 1 erscheinen alle Hypothesen gemeinsam;
- anschließend wird der Laufstatus der Szenarioerstellung sichtbar;
- nach Abschluss von Phase 2 erscheinen alle validierten Szenarien gemeinsam.

Tokenweises Streaming und das vorzeitige Anzeigen unvollständiger JSON-Objekte
sind nicht Bestandteil des Prototyps.

## Fachliche und technische Trennung

Die Prozessaufnahme bleibt der Eigentümer des bestätigten Ist-Prozesses. Das
neue Modul besitzt einen separaten Potenzialdatensatz und erweitert die
Zustandsmaschine der Prozessaufnahme nicht.

Ein Potenzialdatensatz referenziert mindestens:

- Prozess-ID;
- bestätigte Prozessversion beziehungsweise stabilen Inhalts-Hash;
- Zeitpunkt und Akteur des manuellen Starts;
- eigene Zustände beider Phasen;
- Snapshots der verwendeten Konfiguration, Prompts und Schemas;
- Hypothesenergebnis;
- für Phase 2 verwendete Hypothesen-IDs;
- Szenarioergebnis;
- technische Fehler und Auditereignisse.

Die KI-Ergebnisse bleiben advisory und werden in diesem Ausbau nicht fachlich
bestätigt oder bearbeitet.

Ändert sich das bestätigte Prozessbild später, bleibt die vorhandene Analyse als
Ergebnis ihres ursprünglichen Snapshots erhalten, wird aber als veraltet
gekennzeichnet. Eine Neuberechnung für die neue Prozessversion ist in diesem
Ausbau nicht vorgesehen.

Beim endgültigen Löschen eines Prozesses müssen abhängige Potenzialdaten und
deren Auditdaten gemeinsam mit dem Prozess gelöscht werden. Es gibt weiterhin
keine Archivierung oder Wiederherstellung.

## KI-Operationsmodell

Die Pipeline besteht aus genau zwei begrenzten, voneinander getrennten
Claude-Aufrufen:

1. Hypothesenfindung;
2. Szenarioerstellung.

Jede Phase verwendet eine frische Claude-Session ohne Session-Resume. Phase 2
wird ausschließlich durch den erfolgreichen, schema-validierten Abschluss von
Phase 1 ausgelöst. Es gibt keine agentische Schleife, keine eigenständigen
Rückfragen und keine weiteren Toolaufrufe aufgrund von Modellentscheidungen.

Damit erweitert dieses Modul die bisherige Laufzeitregel von „eine
Benutzeraktion, eine KI-Operation“ bewusst auf „eine Benutzeraktion, eine exakt
zweiphasige und begrenzte Pipeline“. Die Repository-Anweisungen und aktive
Produktspezifikation müssen vor der Implementierung entsprechend präzisiert
werden.

Ein technischer Fehler speichert keinen teilweise validierten fachlichen
Output. Ein Retry darf nur eine fehlgeschlagene, noch nicht erfolgreich
persistierte Phase wiederholen; er ist keine fachliche Neuberechnung eines
bereits abgeschlossenen Ergebnisses.

## Prompt- und Schemakonzept

Das neue Modul erhält eigene versionierte Anweisungen und verwendet nicht den
Prompt der Prozessaufnahme als versteckte Erweiterung.

Vorgesehen sind drei klar getrennte Ebenen:

- globale Rolle für evidenzbasierte KI-Potenzialentdeckung;
- spezielle Instructions für die schrittbezogene Hypothesenfindung;
- spezielle Instructions für die vergleichende Szenarioerstellung.

Die globale Rolle stellt insbesondere sicher:

- ausschließlich das bereitgestellte Prozessbild wird verwendet;
- fehlende Informationen werden als Lücke oder Annahme ausgewiesen;
- keine Unternehmens-, Branchen- oder Systemdetails werden als Tatsachen
  erfunden;
- rein deterministische Verbesserungsideen werden nicht als KI-Potenzial
  ausgegeben;
- unterstützende Automation, Orchestrierung und Integration werden nicht gegen
  ein KI-Potenzial gewertet, sondern getrennt ausgewiesen;
- Erklärungen bleiben kompakt und für fachliche Verantwortliche verständlich;
- technische Architekturbegriffe werden nur verwendet, wenn sie zum Verständnis
  eines Szenarios notwendig sind;
- keine Bewertungszahlen oder Umsetzungsempfehlungen werden vorweggenommen.

Beide Modellantworten erhalten eigene strikte Laufzeitschemas. Jeder Dateizugriff
und jede Antwort wird vor Verwendung validiert. Die Inputs enthalten nur das
bestätigte Prozessbild und die für die jeweilige Phase benötigten Ergebnisse;
unabhängige Repository-Inhalte werden nicht an Claude übergeben.

## Zustände

Das spätere Domänenmodell benötigt mindestens folgende unterscheidbare Zustände:

- Hypothesen warten auf Ausführung;
- Hypothesen werden erstellt;
- Hypothesen sind verfügbar;
- keine ausreichende hohe oder gebündelte mittlere Evidenzbasis vorhanden;
- Szenarien warten auf Ausführung;
- Szenarien werden erstellt;
- Szenarien sind verfügbar;
- Phase 1 technisch fehlgeschlagen;
- Phase 2 technisch fehlgeschlagen;
- Ergebnis wegen einer neueren Prozessversion veraltet.

Die konkreten TypeScript-Namen und erlaubten Zustandsübergänge werden im
Implementierungsplan festgelegt.

## Qualitäts- und Sicherheitsanforderungen

- Jede Hypothese referenziert genau einen vorhandenen Prozessschritt.
- Jede hoch-konfidente Hypothese besitzt mindestens eine gültige Evidenzreferenz
  und keine ungelöste materielle Annahme.
- Jede Szenario-Hypothesenreferenz verweist auf eine deterministisch ausgewählte
  Hypothese aus derselben Analyse.
- Szenarien auf Basis von `medium_fallback` besitzen höchstens mittlere
  Konfidenz und zeigen fachlichen Rücksprachebedarf.
- Jede relevante Szenarioaktion besitzt genau eine Ausführungsregel:
  `autonomous`, `approval_required` oder `human_only`.
- Jeder angenommene Systemzugriff beschreibt Ziel, Zugriffsart und bekannten
  oder noch ungeklärten Zugriffsmechanismus getrennt.
- Alle betroffenen Prozessschritte existieren im referenzierten
  Prozesssnapshot.
- Das Szenarioergebnis enthält keine unbekannte vierte Szenariostufe.
- Fachliche Ergebnisse werden erst nach vollständiger Validierung atomar
  gespeichert und angezeigt.
- KI- und manuelle Systemereignisse bleiben in einem append-only Auditverlauf
  nachvollziehbar.
- Ein Refresh, Serverneustart oder erneutes Öffnen erzeugt keine zusätzliche
  KI-Operation.
- Es gibt höchstens eine globale KI-Operation gleichzeitig.
- Der Claude-Aufruf erhält keinen Webzugriff und keinen Zugriff auf unabhängige
  Prozess- oder Repository-Daten.

## Festgelegte MVP-Entscheidungen

- Das Modul wird fachlich, technisch und in der Speicherung von der
  Prozessaufnahme getrennt.
- Nur bestätigte Prozesse können analysiert werden.
- Der Start erfolgt ausschließlich manuell aus der Prozessübersicht.
- Jeder Prozessschritt wird untersucht; Hypothesen werden nicht erzwungen.
- Potenzial und Konfidenz werden getrennt ausgewiesen.
- Alle hohen Hypothesen oder ersatzweise zwei bis drei priorisierte mittlere
  Hypothesen werden für Szenarien verwendet.
- Phase 2 startet nach erfolgreicher Phase 1 automatisch.
- Es entstehen standardmäßig Assistiert, Teilautonom und Agentisch.
- Der Szenariolevel beschreibt primär die Arbeitsteilung zwischen Mensch und KI;
  Integration und deterministische Automation bleiben eigene Dimensionen.
- Das agentische Szenario dient als strategische Vision und nicht als
  Machbarkeitszusage.
- Nutzer können verfügbare Phasen frei ansehen, aber keine Ergebnisse
  bearbeiten.
- Es gibt keine fachliche Neuberechnung abgeschlossener Ergebnisse.
- Bewertung und Priorisierung beginnen erst in einer späteren Produkterweiterung.

## Später separat zu entdecken

Folgende Themen werden bewusst nicht vorweggenommen:

- Bestätigung oder Auswahl eines Szenarios;
- erforderliche zusätzliche Evidenz für eine Bewertung;
- Überführung von Annahmen in bestätigte Eingaben;
- wirtschaftliche, technische, organisatorische und regulatorische Kriterien;
- Herleitung belastbarer Werte und Bandbreiten;
- Bewertungslogik, Gewichtung und Ranking;
- Vergleich mehrerer Prozesse oder Szenarien;
- Bearbeitung, Ergänzung und gezielte Neuberechnung.
