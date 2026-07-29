# Prozessbezogene Potenzialhypothesen v2

Analysiere jeden Prozessschritt genau einmal. Ein Schritt darf null bis mehrere Hypothesen enthalten. Erfinde keine Hypothese, nur um eine Mindestanzahl zu erreichen. Ohne Hypothese ist eine kompakte fachliche Begründung verpflichtend.

Jede Hypothese benötigt mindestens eine materielle KI-Fähigkeit: Interpretation, Generierung, Erkennung, Vorhersage, Empfehlung oder Planung. Beschreibe zusätzlich unterstützende deterministische Abläufe, benötigte Informationen oder Systemzugriffe und die erwartete Rolle des Menschen.

Trenne Potenzial und Konfidenz strikt. Potenzial beschreibt die mögliche fachliche Veränderung. Konfidenz beschreibt ausschließlich, wie gut der heutige fachliche Bedarf und der materielle KI-Beitrag durch das Prozessbild belegt sind. Mengen, Häufigkeiten und erwartete Aufwandsreduktion beeinflussen die Potenzialhöhe, nicht die Belegbarkeit eines ausdrücklich genannten Bedarfs. Verweise ausschließlich auf vorhandene Prozessschritt- und Evidenz-IDs.

Vergib die Konfidenz nach diesen Regeln:

- `high`: Der heutige Bedarf und die passende KI-Fähigkeit gehen direkt aus dem bestätigten Prozessbild hervor. Mindestens eine Evidenzreferenz und keine materielle Annahme sind erforderlich.
- `medium`: Bedarf oder KI-Beitrag sind plausibel, aber teilweise aus dem Prozessbild abgeleitet. Benenne die fehlende Fachinformation als materielle Annahme und offene Frage.
- `low`: Der Kern des Bedarfs oder des KI-Beitrags hängt von einer weitgehend unbelegten fachlichen Voraussetzung ab.

Bewerte bei gemischten Hypothesen die Belegbarkeit des materiellen KI-Beitrags getrennt von festen Regeln und Validierungen. Eine direkt belegte Pflichtregel beweist nicht, dass eine kontextabhängige Empfehlung fachlich ableitbar ist. Fehlen dafür Kriterien, Beispiele oder bestätigtes Ermessen, ist dies eine materielle Annahme und `high` unzulässig. Nutze den deterministischen Anteil dann als unterstützende Automation oder Leitplanke, nicht als Begründung für hohe KI-Konfidenz.

Berücksichtige die strukturierten Entscheidungen im Prozessschritt ausdrücklich. `rule_based` allein begründet kein KI-Potenzial. `professional_judgement` oder `mixed` begründen nur dann einen materiellen KI-Beitrag, wenn der heutige fachliche Bedarf und die benötigte KI-Fähigkeit durch Schritt und Evidenz belegt sind. Fehlende Quellen, Informationsarten, Optionen oder Feststellungskriterien bleiben materielle offene Fachfragen, wenn die Hypothese von ihnen abhängt.

Noch ungeklärte technische Umsetzung, Datenqualität, Schnittstelle, Systemzugriff oder Zugriffsfreigabe senken diese fachliche Konfidenz nicht automatisch. Führe sie als offene Umsetzungsfrage oder nicht-materielle Annahme. Sie ist nur dann materiell, wenn ohne sie bereits der heutige fachliche Bedarf oder die beschriebene KI-Fähigkeit selbst nicht besteht. Erfinde bei unvollständigen Fachangaben keine Sicherheit: Fehlende Angaben zum heutigen Ablauf, tatsächlichen Inhalt, Ermessensbedarf oder Problem bleiben materiell und führen zu `medium` oder `low`.

Gib ausschließlich das verlangte strukturierte Ergebnis aus. IDs für Hypothesen werden später serverseitig vergeben.
