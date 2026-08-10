# Review-Modell in der App (statt Pull Requests)

Karte: [Lebende Prozessdokumentation](../map-lebende-prozessdoku.md)
Typ: `wayfinder:grilling` (HITL)
Blockiert von: [007 Datenmodell](007-datenmodell-quelle-der-wahrheit.md)
Bearbeiter: Claude
Status: geschlossen

## Question

Der Report empfiehlt „autonom schreiben, nicht autonom autorisieren" mit Git-PRs als
Schranke. Unser Git-Repo ist lokal und eingebettet, Review passiert in der App. Wie
sieht diese Schranke konkret aus?

Zu klären:

1. **Was wird reviewt?** Das typisierte Proposal (Feld-Operationen + Begründung +
   Review-Fragen), der gerenderte Markdown-Diff, oder beides nebeneinander?
2. **Wann wird committet?** Erst nach Bestätigung (Proposal wartet in einer
   Review-Queue, Commit = Annahme) — oder sofort committen auf eine Art Staging-Zweig
   und Annahme = Merge? Was ist mit dem AGENTS.md-Grundsatz „nur eine Nutzeraktion
   bestätigt das Prozessverständnis" konsistent?
3. **Gibt es Änderungen ohne Review?** Der Report staffelt (mechanisch → auto,
   semantisch → Review). Gilt im Prototyp „alles braucht Bestätigung", oder dürfen rein
   mechanische Renders (Index, Links, Renderer-Version) direkt committen?
4. **Wie erscheinen Widersprüche im Review?** Konkurrierende Aussagen, Scope,
   Review-Frage — was zeigt die App mindestens an, damit die Fachperson ohne
   Transkript-Lektüre entscheiden kann?
5. **Was passiert bei Ablehnung?** Verwerfen, überarbeiten lassen, oder als offener
   Punkt im Korpus sichtbar bleiben?

## Resolution

Entschieden vom Nutzer (8. Aug 2026), Rahmen: das Modul soll die „agentic future"
zeigen — **optimistic approval statt Vorab-Freigabe**.

1. **Kein Review vor dem Commit.** Jede Doku-Änderung — semantisch wie mechanisch —
   wird sofort auf den Hauptzweig des eingebetteten Korpus-Repos committet. Es gibt
   keine Review-Queue, keinen Staging-Zweig, keine PR-Analogie.
2. **Die Schranke ist der Audit-Trail plus Revert.** Jeder Commit trägt vollständige
   Attribution: Anlass (Gesprächsabschluss oder Reconciliation), Quell-Prozess
   (PROC-xxxx), Quell-Revision, Zusammenfassung der Änderung. Der Ordner-Viewer macht
   die Historie sichtbar; **Zurücknehmen ist eine First-Class-Aktion** in der App und
   erzeugt einen Gegen-Commit (Git-Revert-Semantik, Historie bleibt vollständig —
   nichts wird umgeschrieben).
3. **Konsistenz mit AGENTS.md:** Der Grundsatz „nur eine Nutzeraktion bestätigt das
   Prozessverständnis" bleibt unberührt — er gilt dem _Prozessverständnis_ (Quelle).
   Das Korpus ist eine abgeleitete Sicht auf bereits bestätigte Stände; seine Pflege
   ist mechanische Folge der Bestätigung. Die Spec formuliert das als neue
   AGENTS.md-Klausel (siehe [013](013-spec-schreiben.md)).
4. **Widersprüche werden nicht wegharmonisiert.** Erkennt die Operation einen Konflikt
   mit bestehendem Doku-Inhalt, committet sie beides sichtbar: der Abschnitt „Offene
   Fragen und Widersprüche" der betroffenen Prozessdatei nennt die konkurrierenden
   Aussagen samt Herkunft (leichtgewichtiges Konfliktmodell, siehe
   [007](007-datenmodell-quelle-der-wahrheit.md)). Auflösung geschieht fachlich im
   Quell-Prozess (Korrektur/Neu-Bestätigung), nicht durch Editieren des Korpus.
5. **Ablehnung = Revert + optionaler Folge-Fix an der Quelle.** Es gibt keinen
   „überarbeiten lassen"-Zwischenzustand.
