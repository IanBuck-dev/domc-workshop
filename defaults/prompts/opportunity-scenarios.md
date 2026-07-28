# Mensch-KI-Szenarien v2

Verwende ausschließlich die übergebenen, für die Szenarienphase ausgewählten Hypothesen. Die Eingabe nennt die Auswahlbasis `high` oder `medium_fallback`. Erzeuge exakt drei Szenarien in dieser Reihenfolge: `assistive`, `delegated`, `agentic`.

- Assistiert: KI analysiert, empfiehlt oder erstellt Entwürfe; der Mensch führt jede relevante fachliche Aktion aus. Keine autonome Aktion.
- Teilautonom: KI führt klar begrenzte risikoarme Routineaktionen aus; Menschen bestätigen wichtige Aktionen und bearbeiten Ausnahmen.
- Agentisch: strategische Vision, in der ein Agent risikoarme Fälle innerhalb definierter Leitplanken über mehrere Schritte bearbeitet; Menschen überwachen und übernehmen kritische Fälle. Mindestens eine explizite Eskalation ist erforderlich.

Ordne jede relevante Aktion `autonomous`, `approval_required` oder `human_only` zu. Lege nicht endgültig fest, was im Unternehmen risikoarm ist; kennzeichne Risikomerkmale und Schwellen als Annahmen oder offene Punkte.

Jedes Szenario muss jede übergebene Hypothese entweder einschließen oder mit Begründung ausschließen. Trenne KI-Verantwortung, deterministische Automation, Orchestrierung, menschliche Verantwortung und Systemzugriff. Das agentische Szenario darf zukünftige Voraussetzungen annehmen, ist aber keine Machbarkeitszusage.

Kennzeichne feste Prüfungen, Pflicht-Hinweise und regelbasierte Buchungsbedingungen auch dann als deterministische Automation oder Leitplanke, wenn ein Agent sie innerhalb seines Ablaufs ausführt. Begründe KI-Konfidenz und höhere Autonomie niemals allein mit solchen festen Regeln; der variable KI-Beitrag muss eigenständig erkennbar bleiben.

Bei `medium_fallback` bleiben alle Szenarien höchstens `medium` in ihrer Konfidenz. Benenne in der Konfidenzbegründung den fachlichen Klärungsbedarf und führe die wichtigsten fehlenden Angaben als offene Fragen auf. Stelle Annahmen nicht als Tatsachen dar. Die drei Szenarien dürfen auf denselben zwei oder drei Hypothesen aufbauen; sie unterscheiden sich durch die Arbeitsteilung und Autonomie, nicht durch künstlich verschiedene Anwendungsfälle.

Verwende beim Zugriffsmechanismus `unknown` nur allein. Sobald du mindestens einen konkreten Mechanismus wie `api`, `connector`, `mcp`, `file_exchange`, `manual` oder `ui_automation` nennst, darf `unknown` nicht zusätzlich enthalten sein.

Halte die Ausgabe strikt kompakt: pro Textfeld höchstens zwei kurze Sätze, pro Liste höchstens drei wesentliche Einträge und pro Szenario höchstens vier Aktionen. Wiederhole keine Erklärung in mehreren Feldern.

Gib ausschließlich das verlangte strukturierte Ergebnis aus. Technische IDs und Provenienz ergänzt die Anwendung nach der Antwort.
