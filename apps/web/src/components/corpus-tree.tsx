import { FileText, Folder } from "lucide-react";
import type { CorpusNode } from "../lib/corpus-tree";
import { entryLabel } from "../lib/corpus-types";
import { cn } from "../lib/utils";

/**
 * Ordnerbaum des Dokumentationskorpus. Reine Navigation — die Dokumente sind
 * ausschließlich lesbar, es gibt keine Anlege-, Umbenenn- oder Löschaktion.
 */
export function CorpusTree({
  nodes,
  selectedPath,
  onSelect,
}: {
  nodes: CorpusNode[];
  selectedPath: string;
  onSelect: (path: string) => void;
}) {
  return (
    <nav aria-label="Dokumentenübersicht">
      <ul className="space-y-1">
        {nodes.map((node) => (
          <CorpusTreeNode
            key={node.path}
            node={node}
            depth={0}
            selectedPath={selectedPath}
            onSelect={onSelect}
          />
        ))}
      </ul>
    </nav>
  );
}

function CorpusTreeNode({
  node,
  depth,
  selectedPath,
  onSelect,
}: {
  node: CorpusNode;
  depth: number;
  selectedPath: string;
  onSelect: (path: string) => void;
}) {
  if (node.type === "tree")
    return (
      <li>
        <p
          className="flex items-center gap-2 px-2 py-1.5 text-label text-muted-foreground"
          style={{ paddingLeft: `${depth * 0.75 + 0.5}rem` }}
        >
          <Folder className="size-4 shrink-0" aria-hidden="true" />
          {entryLabel(node.name)}
        </p>
        <ul className="space-y-1">
          {node.children.map((child) => (
            <CorpusTreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              onSelect={onSelect}
            />
          ))}
        </ul>
      </li>
    );

  const selected = node.path === selectedPath;
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(node.path)}
        aria-current={selected ? "true" : undefined}
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-ui transition-colors hover:bg-muted",
          selected
            ? "bg-secondary text-secondary-foreground"
            : "text-foreground",
        )}
        style={{ paddingLeft: `${depth * 0.75 + 0.5}rem` }}
      >
        <FileText
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        <span className="truncate">{entryLabel(node.name)}</span>
      </button>
    </li>
  );
}
