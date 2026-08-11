import { Fragment, isValidElement, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import { Link } from "react-router-dom";
import { Badge } from "./ui/badge";
import { Skeleton } from "./ui/skeleton";
import { splitOnMatches } from "../lib/corpus-search";
import { splitFrontmatter } from "../lib/corpus-types";

/**
 * Ein Dokument des Korpus, ausschließlich lesbar.
 *
 * Das Frontmatter ist Maschinenmetadatum und wird nie roh angezeigt. Sichtbar
 * werden daraus nur die fachlich aussagekräftigen Felder; Quellrevision und
 * Rendererversion bleiben in der Oberfläche unsichtbar.
 */
export function CorpusDocument({
  source,
  query = "",
  contentRef,
}: {
  source: string;
  /** Suchbegriff der Seitenspalte; Fundstellen werden im Text hervorgehoben. */
  query?: string;
  /** Zugriff auf den gerenderten Text — Grundlage für Kopieren und Druck. */
  contentRef?: React.Ref<HTMLDivElement>;
}) {
  const { frontmatter, body } = splitFrontmatter(source);
  const gaps = Number(frontmatter.offene_punkte ?? "0");

  return (
    <article className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {frontmatter.fachbereich && (
          <Badge variant="secondary">{frontmatter.fachbereich}</Badge>
        )}
        {frontmatter.qualitaet && (
          <Badge
            variant={
              frontmatter.qualitaet === "complete" ? "secondary" : "warning"
            }
          >
            {frontmatter.qualitaet === "complete"
              ? "Vollständig bestätigt"
              : "Bestätigt mit offenen Punkten"}
          </Badge>
        )}
        {Number.isFinite(gaps) && gaps > 0 && (
          <span className="text-ui text-muted-foreground">
            {gaps === 1 ? "1 offener Punkt" : `${gaps} offene Punkte`}
          </span>
        )}
        {frontmatter.id && (
          <Link
            to={`/processes/${frontmatter.id}`}
            className="text-ui text-primary underline underline-offset-4"
          >
            Zur Prozessaufnahme
          </Link>
        )}
      </div>
      <div
        ref={contentRef}
        className="space-y-4 text-body text-foreground [&_h1]:text-title [&_h2]:mt-8 [&_h2]:text-heading [&_h3]:mt-6 [&_h3]:text-subheading [&_li]:ml-5 [&_li]:list-disc [&_mark]:rounded-sm [&_mark]:bg-accent [&_mark]:px-0.5 [&_mark]:text-foreground [&_ol_li]:list-decimal [&_p]:my-3 [&_strong]:font-semibold [&_table]:w-full [&_td]:border [&_td]:border-border [&_td]:p-2 [&_th]:border [&_th]:border-border [&_th]:p-2 [&_th]:text-left"
      >
        <ReactMarkdown skipHtml components={highlightComponents(query)}>
          {body}
        </ReactMarkdown>
      </div>
    </article>
  );
}

/** Elemente, deren Text Fundstellen enthalten kann. */
const highlightable = [
  "p",
  "li",
  "td",
  "th",
  "h1",
  "h2",
  "h3",
  "h4",
  "strong",
  "em",
] as const;

/**
 * Hebt die Fundstellen der Suche im gerenderten Text hervor.
 *
 * Ohne Suchbegriff bleibt der Renderpfad unangetastet — react-markdown erhält
 * dann gar keine Ersetzungen und rendert wie zuvor.
 */
function highlightComponents(query: string): Components | undefined {
  if (!query.trim()) return undefined;
  const components: Record<
    string,
    (props: { children?: ReactNode; node?: unknown }) => ReactNode
  > = {};
  for (const tag of highlightable)
    components[tag] = (props) => {
      // `node` ist der Baumknoten von react-markdown und darf nicht als
      // Attribut im Markup landen — sonst steht er auch in der Zwischenablage.
      const { children, node, ...rest } = props;
      void node;
      const Tag = tag;
      return <Tag {...rest}>{markMatches(children, query)}</Tag>;
    };
  return components as Components;
}

/** Wandelt Textkinder in eine Folge aus Text und `<mark>` um. */
function markMatches(children: ReactNode, query: string): ReactNode {
  if (typeof children === "string") {
    const parts = splitOnMatches(children, query);
    if (parts.length === 1) return children;
    return parts.map((part, index) =>
      index % 2 === 1 ? (
        <mark key={index}>{part}</mark>
      ) : (
        <Fragment key={index}>{part}</Fragment>
      ),
    );
  }
  if (Array.isArray(children))
    return children.map((child, index) => (
      <Fragment key={index}>{markMatches(child, query)}</Fragment>
    ));
  if (isValidElement(children)) return children;
  return children;
}

export function CorpusDocumentSkeleton() {
  return (
    <div
      className="space-y-4"
      role="status"
      aria-busy="true"
      aria-label="Dokument wird geladen"
    >
      <span className="sr-only">Dokument wird geladen</span>
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/5" />
    </div>
  );
}
