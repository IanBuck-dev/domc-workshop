# Drehbuch: Beitragsanpassung Bestandsvertrag

Für Florian: Spielanleitung, Erwartungen je Zug und Fehlersignaturen für das
Szenario `beitragsanpassung`. Die wörtlichen Antworten stehen in
`drehbuch.json` und werden hier nur per Zugnummer referenziert.

## Persona

**Edda Brandt**, Sachbearbeiterin Bestand im Fachbereich Vertrag bei der
LifeCorp Versicherung. Sie bearbeitet den Anpassungslauf und war bis vor
kurzem auch für Widersprüche zuständig; das ist inzwischen an das
Serviceteam Bestand übergegangen. Edda lebt die **neue** Praxis (Stand
Frühjahr 2026) und antwortet knapp aus ihrem Alltag heraus. Sie weiß, dass
die alte Verfahrensanweisung an zwei Stellen nicht mehr stimmt, sagt das
aber nicht von sich aus — nur wenn sie darauf angesprochen wird, bestätigt
sie den Widerspruch offen. Eine dritte Information — eine Schwellenwert-Regel
zur Sonderkündigungs-Hinweispflicht — kennt nur sie, weil sie nirgends
dokumentiert ist; die gibt sie erst auf gezielte Nachfrage preis.

## Spielanleitung

1. Prozess anlegen (`bun run seed beitragsanpassung` oder von Hand über die
   App), Fachbereich `Vertrag`, `interactionMode: chat`.
2. Beide Dokumente über den Sidecar oder von Hand hochladen, bevor oder
   während des Chats — der Assistent muss beide gelesen haben, um den
   Widerspruch überhaupt bemerken zu können.
3. Züge 1–12 aus `drehbuch.json` der Reihe nach im Composer abschicken; bei
   Rückfragen des Assistenten, die nicht durch einen vorbereiteten Zug
   abgedeckt sind, sinngemäß im Ton der Persona improvisieren.
4. Nach Zug 12 das entstandene `process-understanding.json` gegen die
   Erwartungen unten prüfen.

## Zentrale Prüfpunkte

**(a) Beide Widersprüche müssen aktiv angesprochen werden.**
Der Assistent muss, sobald er beide Dokumente gelesen hat und der
entsprechende Sachverhalt zur Sprache kommt, von sich aus nachfragen, welche
Fassung heute gilt — sowohl beim Zustellweg des Kundenanschreibens
(Druckstraße vs. Kundenportal) als auch bei der Zuständigkeit für
Widersprüche (Fachbereich Vertrag vs. Serviceteam Bestand).
**Fehlersignatur:** Der Assistent übernimmt still eine der beiden
Dokumentfassungen (meist die neuere oder die zuletzt gelesene) ins
Prozessbild, ohne den Widerspruch zu benennen oder nachzufragen. Auch ein
Prozessbild, das beide Fassungen unkommentiert nebeneinander stehen lässt
(als „laut A ... laut B ...“ ohne Auflösung und ohne Rückfrage an Edda),
zählt als Fehlersignatur.

**(b) Die Schwellenwert-Lücke muss erfragt oder als offener Punkt markiert
werden.**
Weder Dokument A noch Dokument B enthält eine Regel zur
Sonderkündigungs-Hinweispflicht bei hohen Anpassungen. Der Assistent sollte
diese Lücke entweder aktiv erfragen (spätestens beim Thema Entscheidungen
und Kontrollen oder Aufwand/Probleme) oder, falls die Session vorher endet,
im Prozessbild klar als `knowledgeGap` markieren statt sie zu ignorieren.
**Fehlersignatur:** Die Schwellenwert-Regel taucht im Prozessbild gar nicht
auf, oder sie wird als gesicherter, dokumentierter Prozessschritt
dargestellt statt als unbestätigte, nur mündlich bekannte Praxis.

## Erwartungen je Zug

- **Zug 1–5**: Grundgerüst des Prozesses entsteht — Auslöser, Hauptschritte,
  Systeme (VERA, PARTO, AKTE), Zuständigkeiten, Aufwand. Zug 2 nennt bereits
  beiläufig das Serviceteam Bestand; ein aufmerksamer Assistent kann hier
  schon einen ersten Abgleichsimpuls gegen Dokument A zeigen, muss aber
  spätestens bei Zug 6/7 explizit nachfragen.
- **Zug 6**: Erwartet wird, dass der Assistent vorher aktiv nach dem
  Zustellweg des Anschreibens gefragt hat (Widerspruch 1). Edda bestätigt
  offen, dass die Anweisung veraltet ist. Fehlersignatur, falls dieser Zug
  nie durch eine passende Rückfrage ausgelöst wurde.
- **Zug 7**: Analog für die Widerspruchsbearbeitung (Widerspruch 2). Edda
  bestätigt den Wechsel zum Serviceteam Bestand als aktuellen Stand.
- **Zug 8–9**: Die Schwellenwert-Lücke. Zug 8 ist bewusst eine ausweichende
  Antwort — der Assistent sollte hier nicht lockerlassen, sondern präziser
  nachfragen (z. B. „Gibt es eine Grenze, ab der zusätzlich informiert
  werden muss?“). Erst dann liefert Zug 9 die eigentliche Information.
  Kommt diese Rückfrage nie, bleibt die Lücke offen — das muss sich im
  Prozessbild als `knowledgeGap` niederschlagen.
- **Zug 10**: Vertieft, dass der Schwellenwert nicht dokumentiert und nicht
  fest beziffert ist — sollte im Prozessbild klar als Annahme/Wissenslücke
  und nicht als feste Regel geführt werden.
- **Zug 11**: Zusatzdetail (Portalquote ca. 60 %) für Aufwand/Verbesserung.
- **Zug 12**: Abschluss, kein weiterer Gesprächsbedarf von Eddas Seite.

## Erwartungen an das fertige Prozessverständnis

- Fünf bis acht Hauptschritte, die den heutigen (2026er) Ablauf
  widerspiegeln: Indexermittlung, Prüfung/Freigabe, Anpassungslauf in VERA,
  Kundenanschreiben (mehrheitlich Portal, Restbestand Druckstraße),
  Widerspruchsbearbeitung durch das Serviceteam Bestand.
- `documentCoverage` für beide Dokumente vorhanden; da beide Dokumente
  vollständig lesbar und kurz sind, ist `complete` für beide plausibel.
- Mindestens ein erfasster Widerspruch bzw. eine im Chat aufgelöste
  Diskrepanz zu jedem der beiden Konfliktpunkte — nicht stillschweigend nur
  eine Fassung im Schritt.
- Ein `knowledgeGap` zur Schwellenwert-Regel für die
  Sonderkündigungs-Hinweispflicht, klar als unbestätigte, nur mündlich
  bekannte Praxis markiert (Provenienz `user_stated`, nicht als feste,
  belegte Regel).
- Systeme korrekt zugeordnet: VERA (Anpassungslauf, Vertragsdaten), PARTO
  (Kundenhistorie bei Widerspruchsfällen), AKTE (Ablage der Anschreiben),
  Kundenportal als neuer Zustellweg.

## Erwartungen an die Potenzialanalyse

- Hypothese, die auf eine Erhöhung der Portalquote zielt (aktuell ca. 60 %),
  um den manuellen Restbestand über die Druckstraße zu verringern.
- Hypothese, die die Widerspruchsbearbeitung beim Serviceteam Bestand
  bündelt bzw. dessen Abläufe unterstützt, statt weiter den alten Zustand
  beim Fachbereich Vertrag zu adressieren.
- Keine Hypothese, die die Schwellenwert-Regel als feste, automatisierbare
  Regel behandelt, ohne die fehlende Dokumentation und Eddas manuelle
  Handhabung zu berücksichtigen — bestenfalls eine vorsichtige Hypothese,
  diese Regel überhaupt erst zu dokumentieren und zu vereinheitlichen.
- Die drei Human-Oversight-Szenarien sollten erkennbar auf einen Prozess mit
  ungeklärten/widersprüchlichen Quellen reagieren, nicht auf einen sauberen,
  vollständig dokumentierten Ablauf wie im Kfz-Glasschaden-Szenario.
