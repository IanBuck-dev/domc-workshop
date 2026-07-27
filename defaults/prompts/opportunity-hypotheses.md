# Prozessbezogene Potenzialhypothesen v2

Analysiere jeden Prozessschritt genau einmal. Ein Schritt darf null bis mehrere Hypothesen enthalten. Erfinde keine Hypothese, nur um eine Mindestanzahl zu erreichen. Ohne Hypothese ist eine kompakte fachliche Begründung verpflichtend.

Jede Hypothese benötigt mindestens eine materielle KI-Fähigkeit: Interpretation, Generierung, Erkennung, Vorhersage, Empfehlung oder Planung. Beschreibe zusätzlich unterstützende deterministische Abläufe, benötigte Informationen oder Systemzugriffe und die erwartete Rolle des Menschen.

Trenne Potenzial und Konfidenz strikt. Potenzial beschreibt die mögliche fachliche Veränderung. Konfidenz beschreibt ausschließlich, wie gut der heutige fachliche Bedarf und der materielle KI-Beitrag durch das Prozessbild belegt sind. Mengen, Häufigkeiten und erwartete Aufwandsreduktion beeinflussen die Potenzialhöhe, nicht die Belegbarkeit eines ausdrücklich genannten Bedarfs. Verweise ausschließlich auf vorhandene Prozessschritt- und Evidenz-IDs.

Vergib die Konfidenz nach diesen Regeln:

- `high`: Der heutige Bedarf und die passende KI-Fähigkeit gehen direkt aus dem bestätigten Prozessbild hervor. Mindestens eine Evidenzreferenz und keine materielle Annahme sind erforderlich.
- `medium`: Bedarf oder KI-Beitrag sind plausibel, aber teilweise aus dem Prozessbild abgeleitet. Benenne die fehlende Fachinformation als materielle Annahme und offene Frage.
- `low`: Der Kern des Bedarfs oder des KI-Beitrags hängt von einer weitgehend unbelegten fachlichen Voraussetzung ab.

Noch ungeklärte technische Umsetzung, Datenqualität, Schnittstelle, Systemzugriff oder Zugriffsfreigabe senken diese fachliche Konfidenz nicht automatisch. Führe sie als offene Umsetzungsfrage oder nicht-materielle Annahme. Sie ist nur dann materiell, wenn ohne sie bereits der heutige fachliche Bedarf oder die beschriebene KI-Fähigkeit selbst nicht besteht. Erfinde bei unvollständigen Fachangaben keine Sicherheit: Fehlende Angaben zum heutigen Ablauf, tatsächlichen Inhalt, Ermessensbedarf oder Problem bleiben materiell und führen zu `medium` oder `low`.

Gib ausschließlich das verlangte strukturierte Ergebnis aus. IDs für Hypothesen werden später serverseitig vergeben.
