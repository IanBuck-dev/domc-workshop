import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronsDown,
  ChevronsRight,
  Copy,
  FileText,
  Printer,
  Search,
} from "lucide-react";
import {
  CorpusDocument,
  CorpusDocumentSkeleton,
} from "../components/corpus-document";
import { CorpusHistory } from "../components/corpus-history";
import { CorpusTree } from "../components/corpus-tree";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Skeleton } from "../components/ui/skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import { api } from "../lib/api-client";
import { copyDocument, printDocument } from "../lib/corpus-export";
import { documentPaths, filterCorpusTree } from "../lib/corpus-search";
import {
  ancestorPaths,
  buildCorpusTree,
  directoryPaths,
  firstDocument,
  type CorpusNode,
} from "../lib/corpus-tree";
import {
  loadCollapsedFolders,
  saveCollapsedFolders,
} from "../lib/corpus-tree-preference";
import type { CorpusEntry, CorpusLogEntry } from "../lib/corpus-types";
import { documentTitle } from "../lib/corpus-types";

/**
 * Der Ordner-Viewer des Dokumentationskorpus.
 *
 * Das Korpus pflegt die Anwendung selbst: nach jeder fachlichen Bestätigung
 * schreibt sie das betroffene Dokument neu. Diese Seite ist die Aufsicht darüber
 * — vollständig lesend, mit einer einzigen Schreibaktion (Änderung zurücknehmen)
 * im Verlauf. Herausnehmen lässt sich ein Dokument über die Zwischenablage oder
 * die Druckansicht des Browsers.
 */
export function DocumentationPage() {
  const [nodes, setNodes] = useState<CorpusNode[] | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState("");
  const [source, setSource] = useState<string | null>(null);
  const [sourceError, setSourceError] = useState("");
  const [history, setHistory] = useState<CorpusLogEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(
    () => new Set(loadCollapsedFolders()),
  );
  const [query, setQuery] = useState("");
  const [contents, setContents] = useState<ReadonlyMap<string, string>>(
    new Map(),
  );

  const loadTree = useCallback(async () => {
    try {
      const entries = await collectDocuments();
      const tree = buildCorpusTree(entries);
      setNodes(tree);
      setSelected((current) =>
        current && entries.some((entry) => entry.path === current)
          ? current
          : (firstDocument(tree)?.path ?? ""),
      );
    } catch (reason) {
      setError((reason as Error).message);
      setNodes([]);
    }
  }, []);

  useEffect(() => {
    void loadTree();
  }, [loadTree]);

  const loadDocument = useCallback(async (path: string) => {
    if (!path) {
      setSource(null);
      setHistory([]);
      return;
    }
    setSource(null);
    setSourceError("");
    setHistoryLoading(true);
    try {
      const [content, entries] = await Promise.all([
        api.corpus.file(path),
        api.corpus.log({ path }),
      ]);
      setSource(content);
      setHistory(entries);
    } catch (reason) {
      setSourceError((reason as Error).message);
      setSource("");
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDocument(selected);
  }, [selected, loadDocument]);

  useEffect(() => {
    saveCollapsedFolders([...collapsed]);
  }, [collapsed]);

  // Das ausgewählte Dokument darf nie hinter einem zugeklappten Ordner liegen —
  // sonst zeigt der Baum eine Auswahl, die man nicht sieht.
  useEffect(() => {
    if (!selected) return;
    const eltern = ancestorPaths(selected);
    setCollapsed((current) => {
      if (!eltern.some((pfad) => current.has(pfad))) return current;
      const next = new Set(current);
      for (const pfad of eltern) next.delete(pfad);
      return next;
    });
  }, [selected]);

  // Der Volltextindex wird erst beim ersten Suchbegriff geholt: ohne Suche wäre
  // er unnötige Last, mit Suche ist er nach einem Durchgang vollständig.
  useEffect(() => {
    if (!query.trim() || !nodes || contents.size) return;
    let abgebrochen = false;
    void (async () => {
      const pfade = documentPaths(nodes);
      const geladen = await Promise.all(
        pfade.map(async (pfad) => {
          try {
            return [pfad, await api.corpus.file(pfad)] as const;
          } catch {
            // Ein unlesbares Dokument darf die Suche nicht anhalten; es bleibt
            // dann über seinen Titel auffindbar.
            return [pfad, ""] as const;
          }
        }),
      );
      if (!abgebrochen) setContents(new Map(geladen));
    })();
    return () => {
      abgebrochen = true;
    };
  }, [query, nodes, contents.size]);

  const suche = useMemo(
    () => filterCorpusTree(nodes ?? [], query, contents),
    [nodes, query, contents],
  );

  if (!nodes) return <DocumentationPageSkeleton />;

  const title = source
    ? documentTitle(source, selected.split("/").pop() ?? "")
    : "";
  const sucheAktiv = Boolean(query.trim());
  // Solange der Volltext noch geholt wird, greift nur die Titelsuche — ein
  // leeres Ergebnis wäre dann eine Falschaussage.
  const indexBereit = contents.size > 0;

  return (
    <section className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:py-12">
      <div className="max-w-3xl space-y-2" data-print-hide>
        <p className="text-eyebrow uppercase text-primary">
          Lebende Dokumentation
        </p>
        <h1 className="text-title sm:text-display">Prozessdokumentation</h1>
        <p className="leading-6 text-muted-foreground">
          Die Anwendung schreibt diese Dokumentation nach jeder fachlichen
          Bestätigung selbstständig fort. Jede Änderung ist im Verlauf
          nachvollziehbar und lässt sich einzeln zurücknehmen. Bearbeitet wird
          hier nichts — Korrekturen entstehen immer an der Prozessaufnahme.
        </p>
      </div>

      {error && (
        <p
          className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-label text-destructive"
          role="alert"
        >
          {error}
        </p>
      )}

      {nodes.length === 0 && !error ? (
        <EmptyCorpus />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)] print:block">
          <Card className="h-fit" data-print-hide>
            <CardContent className="space-y-3 p-3">
              <label className="relative block">
                <Search
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  className="pl-9"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Dokumentation durchsuchen"
                  aria-label="Dokumentation durchsuchen"
                />
              </label>
              {/* Eine Zeile: die Zählung links, das Auf- und Zuklappen rechts.
                  Als Schaltflächen mit Beschriftung liefen die beiden aus der
                  schmalen Spalte heraus — sie tragen ihre Bedeutung deshalb im
                  Sinnbild, den Namen im Tooltip und im Barrierefreiheitsnamen.

                  Das Sinnbild ist bewusst der doppelte Winkel des Baums: dort
                  zeigt ein offener Ordner nach unten, ein zugeklappter nach
                  rechts. Verdoppelt heißt dasselbe für alle Ordner auf einmal. */}
              <div className="flex items-center justify-between gap-2 px-2">
                <Badge variant="secondary">
                  {!sucheAktiv
                    ? `${suche.gesamt} Dokumente`
                    : indexBereit
                      ? `${suche.gefunden} von ${suche.gesamt} Dokumenten`
                      : "Suche läuft …"}
                </Badge>
                <div className="flex shrink-0 items-center gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={sucheAktiv}
                    title="Alle aufklappen"
                    aria-label="Alle aufklappen"
                    onClick={() => setCollapsed(new Set())}
                  >
                    <ChevronsDown aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={sucheAktiv}
                    title="Alle zuklappen"
                    aria-label="Alle zuklappen"
                    onClick={() => setCollapsed(new Set(directoryPaths(nodes)))}
                  >
                    <ChevronsRight aria-hidden="true" />
                  </Button>
                </div>
              </div>
              {sucheAktiv && suche.gefunden === 0 ? (
                <p className="px-2 py-6 text-center text-ui text-muted-foreground">
                  {indexBereit
                    ? `Kein Dokument enthält „${query.trim()}“.`
                    : "Die Dokumente werden durchsucht …"}
                </p>
              ) : (
                <CorpusTree
                  nodes={suche.nodes}
                  selectedPath={selected}
                  onSelect={setSelected}
                  collapsed={sucheAktiv ? leer : collapsed}
                  onToggleFolder={(path) =>
                    setCollapsed((current) => {
                      const next = new Set(current);
                      if (!next.delete(path)) next.add(path);
                      return next;
                    })
                  }
                  treffer={sucheAktiv ? suche.treffer : undefined}
                />
              )}
            </CardContent>
          </Card>
          <Card className="min-w-0 print:border-0 print:py-0">
            <CardContent className="space-y-5 p-5 sm:p-6 print:p-0">
              {/* Auf Papier trägt die Überschrift des Dokuments selbst den
                  Titel — hier stünde er sonst zweimal. */}
              {title && (
                <h2 className="text-heading" data-print-hide>
                  {title}
                </h2>
              )}
              <Tabs defaultValue="dokument">
                <TabsList data-print-hide>
                  <TabsTrigger value="dokument">Dokument</TabsTrigger>
                  <TabsTrigger value="verlauf">Änderungsverlauf</TabsTrigger>
                </TabsList>
                <TabsContent value="dokument" className="pt-5">
                  {sourceError && (
                    <p
                      className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-label text-destructive"
                      role="alert"
                    >
                      {sourceError}
                    </p>
                  )}
                  {source === null && !sourceError && (
                    <CorpusDocumentSkeleton />
                  )}
                  {source && <DocumentPanel source={source} query={query} />}
                </TabsContent>
                <TabsContent value="verlauf" className="pt-5">
                  <CorpusHistory
                    entries={history}
                    loading={historyLoading}
                    documentPath={selected}
                    onReverted={() => {
                      void loadTree();
                      void loadDocument(selected);
                    }}
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      )}
    </section>
  );
}

const leer: ReadonlySet<string> = new Set();

/**
 * Das Dokument mit seinen beiden Ausgabewegen. Beide liegen bewusst im Reiter
 * „Dokument" — was hier herausgeht, ist immer der gerade sichtbare Text.
 */
function DocumentPanel({ source, query }: { source: string; query: string }) {
  const content = useRef<HTMLDivElement>(null);
  const [kopiert, setKopiert] = useState(false);
  const [kopierFehler, setKopierFehler] = useState("");

  useEffect(() => {
    if (!kopiert) return;
    const timer = setTimeout(() => setKopiert(false), 2000);
    return () => clearTimeout(timer);
  }, [kopiert]);

  async function kopieren() {
    if (!content.current) return;
    setKopierFehler("");
    try {
      await copyDocument(content.current);
      setKopiert(true);
    } catch {
      setKopierFehler(
        "Das Dokument konnte nicht kopiert werden. Bitte erlauben Sie den Zugriff auf die Zwischenablage.",
      );
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" data-print-hide>
        <Button variant="outline" size="sm" onClick={() => void kopieren()}>
          {kopiert ? (
            <Check className="size-4" aria-hidden="true" />
          ) : (
            <Copy className="size-4" aria-hidden="true" />
          )}
          {kopiert ? "Kopiert" : "Kopieren"}
        </Button>
        <Button variant="outline" size="sm" onClick={printDocument}>
          <Printer className="size-4" aria-hidden="true" />
          Als PDF exportieren
        </Button>
      </div>
      {kopierFehler && (
        <p
          className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-label text-destructive"
          role="alert"
        >
          {kopierFehler}
        </p>
      )}
      <CorpusDocument source={source} query={query} contentRef={content} />
    </div>
  );
}

/**
 * Der Baum wird über die Ordnerebenen eingesammelt statt in einem Zug geladen:
 * die Server-API liefert je Aufruf genau eine Ebene. Das Korpus hat zwei Ebenen
 * (Fachbereich, Prozess), die Zahl der Aufrufe bleibt damit klein.
 */
async function collectDocuments(path = ""): Promise<CorpusEntry[]> {
  const entries = await api.corpus.tree(path);
  const nested = await Promise.all(
    entries.map(async (entry) =>
      entry.type === "tree" ? collectDocuments(entry.path) : [entry],
    ),
  );
  return nested.flat();
}

function EmptyCorpus() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 px-6 py-14 text-center">
        <div
          className="grid size-12 place-items-center rounded-full bg-secondary text-secondary-foreground"
          aria-hidden="true"
        >
          <FileText className="size-6" />
        </div>
        <h2 className="text-heading">Noch keine Dokumentation vorhanden</h2>
        <p className="max-w-md leading-6 text-muted-foreground">
          Sobald ein Prozess fachlich bestätigt ist, legt die Anwendung das
          zugehörige Dokument hier an. In den Einstellungen lässt sich der
          Abgleich auch von Hand anstoßen.
        </p>
      </CardContent>
    </Card>
  );
}

function DocumentationPageSkeleton() {
  return (
    <section
      className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:py-12"
      role="status"
      aria-busy="true"
      aria-label="Prozessdokumentation wird geladen"
    >
      <span className="sr-only">Prozessdokumentation wird geladen</span>
      <div className="max-w-3xl space-y-2">
        <Skeleton className="h-4 w-44" />
        <Skeleton className="h-9 w-80 sm:h-11" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)]">
        <Skeleton className="h-72 w-full rounded-xl" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    </section>
  );
}
