import ReactMarkdown from "react-markdown";
import { Link } from "react-router-dom";
import { Badge } from "./ui/badge";
import { Skeleton } from "./ui/skeleton";
import { splitFrontmatter } from "../lib/corpus-types";

/**
 * Ein Dokument des Korpus, ausschließlich lesbar.
 *
 * Das Frontmatter ist Maschinenmetadatum und wird nie roh angezeigt. Sichtbar
 * werden daraus nur die fachlich aussagekräftigen Felder; Quellrevision und
 * Rendererversion bleiben in der Oberfläche unsichtbar.
 */
export function CorpusDocument({ source }: { source: string }) {
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
      <div className="space-y-4 text-body text-foreground [&_h1]:text-title [&_h2]:mt-8 [&_h2]:text-heading [&_h3]:mt-6 [&_h3]:text-subheading [&_li]:ml-5 [&_li]:list-disc [&_ol_li]:list-decimal [&_p]:my-3 [&_strong]:font-semibold [&_table]:w-full [&_td]:border [&_td]:border-border [&_td]:p-2 [&_th]:border [&_th]:border-border [&_th]:p-2 [&_th]:text-left">
        <ReactMarkdown skipHtml>{body}</ReactMarkdown>
      </div>
    </article>
  );
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
