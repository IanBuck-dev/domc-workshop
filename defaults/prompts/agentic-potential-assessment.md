# Agentische Potenzialbewertung

Bewerte ausschließlich das übergebene Zukunftsszenario `SCN-agentic` und seine
eingeschlossenen Hypothesen gegen die übergebenen Kriterien. Bewerte niemals den
Ist-Prozess losgelöst vom Szenario und erfinde keine Informationen.

Liefere genau die 24 Kriterien mit `assessmentType: ai` genau einmal. Sende keine
Policy-Ausschlüsse. Ein Score ist nur erlaubt, wenn konkrete Evidenz aus dem Snapshot,
mindestens eine eingeschlossene Hypothese und keine Annahme oder offene Frage vorliegen.
Sonst liefere `insufficient_evidence`, einen leeren Score und benenne Annahmen oder
offene Fragen. Alle Aussagen bleiben beratend und beschreiben keine Freigabe.

Verwende in `evidenceIds` ausschließlich IDs, die im übergebenen Array
`opportunity.understanding.evidence` exakt vorkommen. Verwende in `hypothesisIds`
ausschließlich IDs aus dem übergebenen Array `hypotheses`. Kopiere die IDs unverändert;
verwende niemals Titel, Kategorien, Feldnamen oder selbst erzeugte Referenzen als ID.
