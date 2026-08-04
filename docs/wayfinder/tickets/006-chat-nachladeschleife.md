# Nachladeschleife im Chat

Karte: [Ladezustände und Navigationsgefühl](../map-loading-states.md)
Typ: `wayfinder:grilling` (HITL)
Blockiert von: —
Bearbeiter: Claude
Status: geschlossen

## Question

Die Chatseite lädt während eines laufenden Gesprächs wiederholt ihren gesamten
Datenbestand nach. Was davon ist nötig, und was fällt weg?

Ablauf heute in `process-chat-page.tsx`:

- `reloadView({ syncMessages: true })` (`:199-229`) ruft `api.chat(id)` und bekommt den
  kompletten `View` zurück: Transkript, Uploads, Verständnisstand, Zustand,
  Bestätigungsflaggen — alles in einer Antwort.
- Ausgelöst wird das beim Aufbau (`:275-277`), bei jedem `data-understanding-state`-Ereignis
  aus dem Stream (`:261`) **und** noch einmal in `onFinish` (`:267`).
- Während einer Antwort läuft das also mehrfach, und jedes Mal geht die volle Nutzlast über
  die Leitung, obwohl sich meist nur ein Teil geändert hat.

Zu klären:

- Welche der drei Auslöser wirklich einen vollständigen Nachlauf brauchen und welche mit
  dem auskommen, was der Stream ohnehin schon liefert.
- Ob die Ereignisse zusammengefasst werden sollten, statt jedes einzeln zu bedienen.
- Ob `api.chat(id)` überhaupt in dieser Form bleiben soll oder ob die Antwort geteilt
  gehört. Das berührt den Server (`apps/server`), nicht nur die Oberfläche — falls ja, ist
  zu klären, ob das noch zu dieser Karte gehört oder deren Ziel überschreitet.

Nicht blockiert: das ist ein Datenflussproblem, keine Frage der Ladedarstellung, und
unabhängig vom [Ladevokabular](001-ladevokabular.md) bearbeitbar. Die Antwort kann
allerdings Nebel auf der Karte lichten — die regionalen Ladezustände im Chat-Arbeitsbereich
hängen mit daran.

Achtung beim Messen: ohne Caching — bewusst ausgeschlossen, siehe Out of scope der Karte —
ist jeder Nachlauf ein echter Netzwerkgang. Der Effekt ist also real und nicht von einer
Cache-Schicht verdeckt.

## Resolution

Beim genauen Hinsehen ist der Auslöser aus dem Stream (`:250-263`) **nicht** der Schuldige:
er ist bereits über `lastRevision.current` gegen die Revision abgesichert und feuert nur bei
echtem Fortschritt. Das eigentliche Problem ist, dass mehrere Auslöser **gleichzeitig**
laufen dürfen — der Revisionslauf und das direkt darauf folgende `onFinish` überlappen sich,
zwei volle `api.chat(id)`-Antworten sind unterwegs, und die spätere gewinnt das `setView`
unabhängig davon, welche aktueller ist. Das ist nicht nur Verschwendung, das ist ein Rennen.

**Entschieden: Zusammenfassen statt Streichen.** `reloadView` bekommt eine Schleuse — genau
ein Lauf gleichzeitig. Ein Aufruf, der eintrifft, während einer läuft, startet keinen
zweiten, sondern setzt eine Nachlauf-Marke; nach dem Ende läuft dann **einmal** nach. Das
`syncMessages`-Flag wird über die wartenden Aufrufe hinweg verodert, damit ein
Transkript-Abgleich nicht verloren geht.

Warum nicht einfach `onFinish` streichen: `data-understanding-state` feuert nur, wenn sich
die Revision ändert. Ein Zug, der nichts am Verständnisstand ändert, hätte danach kein
Transkript mehr abgeglichen. Die Schleuse löst die Überlappung, ohne diesen Fall zu opfern.

**`api.chat(id)` bleibt wie es ist.** Die Antwort zu teilen hieße, `apps/server` anzufassen —
das liegt hinter dem Ziel dieser Karte. Fällt unter Out of scope, nicht unter Nebel.

**Keine Ladeanzeige für diese Nachläufe.** Die Seite steht bereits; ein Zustand, der bei
jedem Stream-Ereignis aufblitzt, ist schlechter als keiner. Das ist Stufe 3 aus dem
[Ladevokabular](001-ladevokabular.md) und beantwortet zugleich den Nebelpunkt „Ob der
SSE-Kanal ein Ladeaffordance bekommt" mit **nein**.
