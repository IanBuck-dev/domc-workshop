import { useCallback, useEffect, useState } from "react";
import { FileText } from "lucide-react";
import {
  CorpusDocument,
  CorpusDocumentSkeleton,
} from "../components/corpus-document";
import { CorpusHistory } from "../components/corpus-history";
import { CorpusTree } from "../components/corpus-tree";
import { Card, CardContent } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import { api } from "../lib/api-client";
import {
  buildCorpusTree,
  firstDocument,
  type CorpusNode,
} from "../lib/corpus-tree";
import type { CorpusEntry, CorpusLogEntry } from "../lib/corpus-types";
import { documentTitle } from "../lib/corpus-types";

/**
 * Der Ordner-Viewer des Dokumentationskorpus.
 *
 * Das Korpus pflegt die Anwendung selbst: nach jeder fachlichen Bestätigung
 * schreibt sie das betroffene Dokument neu. Diese Seite ist die Aufsicht darüber
 * — vollständig lesend, mit einer einzigen Schreibaktion (Änderung zurücknehmen)
 * im Verlauf.
 */
export function DocumentationPage() {
  const [nodes, setNodes] = useState<CorpusNode[] | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState("");
  const [source, setSource] = useState<string | null>(null);
  const [sourceError, setSourceError] = useState("");
  const [history, setHistory] = useState<CorpusLogEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

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

  if (!nodes) return <DocumentationPageSkeleton />;

  const title = source
    ? documentTitle(source, selected.split("/").pop() ?? "")
    : "";

  return (
    <section className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:py-12">
      <div className="max-w-3xl space-y-2">
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
        <div className="grid gap-6 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
          <Card className="h-fit">
            <CardContent className="p-3">
              <CorpusTree
                nodes={nodes}
                selectedPath={selected}
                onSelect={setSelected}
              />
            </CardContent>
          </Card>
          <Card className="min-w-0">
            <CardContent className="space-y-5 p-5 sm:p-6">
              {title && <h2 className="text-heading">{title}</h2>}
              <Tabs defaultValue="dokument">
                <TabsList>
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
                  {source && <CorpusDocument source={source} />}
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
      <div className="grid gap-6 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
        <Skeleton className="h-72 w-full rounded-xl" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    </section>
  );
}
