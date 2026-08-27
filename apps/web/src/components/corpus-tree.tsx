import { ChevronDown, FileText, Folder } from "lucide-react";
import type { CorpusNode } from "../lib/corpus-tree";
import { cn } from "../lib/utils";

/**
 * Ordnerbaum des Dokumentationskorpus. Reine Navigation — die Dokumente sind
 * ausschließlich lesbar, es gibt keine Anlege-, Umbenenn- oder Löschaktion.
 *
 * Der Klappzustand liegt außerhalb: die Seite hält ihn, weil er im
 * Browserspeicher überdauert und die Schaltflächen „Alle aufklappen" und
 * „Alle zuklappen" ihn gemeinsam mit dem Baum verändern.
 */
export function CorpusTree({
  nodes,
  selectedPath,
  onSelect,
  collapsed,
  onToggleFolder,
  treffer,
}: {
  nodes: CorpusNode[];
  selectedPath: string;
  onSelect: (path: string) => void;
  collapsed: ReadonlySet<string>;
  onToggleFolder: (path: string) => void;
  /** Fundstellen je Dokument, wenn eine Suche aktiv ist. */
  treffer?: ReadonlyMap<string, number>;
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
            collapsed={collapsed}
            onToggleFolder={onToggleFolder}
            treffer={treffer}
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
  collapsed,
  onToggleFolder,
  treffer,
}: {
  node: CorpusNode;
  depth: number;
  selectedPath: string;
  onSelect: (path: string) => void;
  collapsed: ReadonlySet<string>;
  onToggleFolder: (path: string) => void;
  treffer?: ReadonlyMap<string, number>;
}) {
  const indent = { paddingLeft: `${depth * 0.75 + 0.5}rem` };

  if (node.type === "tree") {
    const open = !collapsed.has(node.path);
    return (
      <li>
        <button
          type="button"
          onClick={() => onToggleFolder(node.path)}
          aria-expanded={open}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-label text-muted-foreground transition-colors hover:bg-muted"
          style={indent}
        >
          <ChevronDown
            className={cn(
              "size-4 shrink-0 transition-transform",
              open ? undefined : "-rotate-90",
            )}
            aria-hidden="true"
          />
          <Folder className="size-4 shrink-0" aria-hidden="true" />
          <span className="truncate">{node.label}</span>
        </button>
        {open && (
          <ul className="space-y-1">
            {node.children.map((child) => (
              <CorpusTreeNode
                key={child.path}
                node={child}
                depth={depth + 1}
                selectedPath={selectedPath}
                onSelect={onSelect}
                collapsed={collapsed}
                onToggleFolder={onToggleFolder}
                treffer={treffer}
              />
            ))}
          </ul>
        )}
      </li>
    );
  }

  const selected = node.path === selectedPath;
  const fundstellen = treffer?.get(node.path) ?? 0;
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
        style={indent}
      >
        <FileText
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        <span className="truncate">{node.label}</span>
        {fundstellen > 0 && (
          <span className="ml-auto shrink-0 text-caption text-muted-foreground">
            {fundstellen === 1 ? "1 Stelle" : `${fundstellen} Stellen`}
          </span>
        )}
      </button>
    </li>
  );
}
