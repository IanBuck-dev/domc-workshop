import { useEffect, useState } from "react";
import { Diff, Hunk, parseDiff } from "react-diff-view";

const splitQuery = "(min-width: 1280px)";

/**
 * Der Server liefert einen rohen Unified-Diff; geparst und dargestellt wird er
 * im Client. Auf schmalen Breiten untereinander, ab 1280 px nebeneinander —
 * darunter reicht die Breite für zwei Spalten Fließtext nicht aus.
 */
function useSplitView() {
  const [split, setSplit] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(splitQuery);
    const update = () => setSplit(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return split;
}

export function CorpusDiff({ diff }: { diff: string }) {
  const split = useSplitView();
  const files = diff.trim() ? parseDiff(diff) : [];

  if (files.length === 0 || files.every((file) => file.hunks.length === 0))
    return (
      <p className="rounded-md border border-border bg-muted p-3 text-ui text-muted-foreground">
        Zwischen diesen beiden Ständen gibt es keinen inhaltlichen Unterschied.
      </p>
    );

  return (
    <div className="space-y-4">
      {files.map((file) => (
        <div
          key={`${file.oldPath}-${file.newPath}`}
          className="overflow-hidden rounded-lg border border-border"
        >
          <p className="border-b border-border bg-muted px-3 py-2 text-label text-muted-foreground">
            {documentLabel(file.newPath, file.oldPath)}
          </p>
          <div className="overflow-x-auto [&_.diff-code]:text-ui [&_.diff-gutter]:cursor-default [&_.diff-gutter]:text-caption [&_.diff-gutter]:text-muted-foreground [&_.diff-line]:font-sans">
            <Diff
              viewType={split ? "split" : "unified"}
              diffType={file.type}
              hunks={file.hunks}
            >
              {(hunks) =>
                hunks.map((hunk) => <Hunk key={hunk.content} hunk={hunk} />)
              }
            </Diff>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Dateipfade tragen Git-Präfixe (`a/`, `b/`) und `/dev/null` für neue oder
 * entfernte Dateien. In der Oberfläche erscheint stattdessen Fachsprache.
 */
function documentLabel(newPath: string, oldPath: string): string {
  const strip = (value: string) => value.replace(/^[ab]\//, "");
  if (newPath === "/dev/null") return `Entfernt: ${strip(oldPath)}`;
  if (oldPath === "/dev/null") return `Neu angelegt: ${strip(newPath)}`;
  if (oldPath !== newPath)
    return `${strip(oldPath)} → ${strip(newPath)} (verschoben)`;
  return strip(newPath);
}
