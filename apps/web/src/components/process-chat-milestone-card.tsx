import ReactMarkdown from "react-markdown";
import { Link } from "react-router-dom";
import type { ProcessUnderstanding, UploadRecord } from "../lib/process-types";
import { DocumentAttachmentList } from "./document-attachment-list";
import { Button } from "./ui/button";

function Body({ text }: { text: string }) {
  return (
    <ReactMarkdown
      allowedElements={["p", "strong", "em", "ul", "ol", "li", "br", "code"]}
    >
      {text}
    </ReactMarkdown>
  );
}

export function InitialProcessChatMilestoneCard({
  text,
  selectedUploads,
  missingSelectedCount,
  onPreview,
  documentGate,
  coverageByUploadId,
  processing,
}: {
  text: string;
  selectedUploads: UploadRecord[];
  missingSelectedCount: number;
  onPreview: (upload: UploadRecord) => void;
  documentGate?: React.ReactNode;
  coverageByUploadId?: Readonly<
    Record<string, ProcessUnderstanding["documentCoverage"][number] | undefined>
  >;
  processing: boolean;
}) {
  const hasAttachments = selectedUploads.length > 0 || missingSelectedCount > 0;
  return (
    <section
      className="rounded-xl border bg-card p-5 shadow-sm"
      aria-labelledby="capture-milestone-title"
    >
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
        Prozesserfassung
      </p>
      <div id="capture-milestone-title" className="mt-3 text-base leading-7">
        <Body text={text} />
      </div>
      {documentGate ??
        (hasAttachments && (
          <div className="mt-5 border-t pt-4">
            <p className="text-sm font-semibold">Verwendete Unterlagen</p>
            {missingSelectedCount > 0 && (
              <p role="alert" className="mt-2 text-sm text-destructive">
                Eine zuvor verwendete Unterlage ist nicht mehr verfügbar.
              </p>
            )}
            <DocumentAttachmentList
              mode="readonly"
              uploads={selectedUploads}
              onPreview={onPreview}
              coverageByUploadId={coverageByUploadId}
              processing={processing}
            />
          </div>
        ))}
    </section>
  );
}

export function CompletionProcessChatMilestoneCard({
  text,
  processId,
}: {
  text: string;
  processId: string;
}) {
  return (
    <section
      className="rounded-xl border border-primary/25 bg-card p-5 shadow-sm"
      aria-labelledby="confirmation-milestone-title"
    >
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
        Prozess bestätigt
      </p>
      <div
        id="confirmation-milestone-title"
        className="mt-3 text-base leading-7"
      >
        <Body text={text} />
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <Button asChild variant="outline">
          <Link to={`/processes/${processId}`}>Zum Prozess</Link>
        </Button>
        <Button asChild>
          <Link to={`/processes/${processId}/opportunities`}>
            KI-Potenziale ansehen
          </Link>
        </Button>
      </div>
    </section>
  );
}
