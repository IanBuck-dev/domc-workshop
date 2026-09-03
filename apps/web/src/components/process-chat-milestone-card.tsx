import ReactMarkdown from "react-markdown";
import { Link } from "react-router-dom";
import type { ProcessUnderstanding, UploadRecord } from "../lib/process-types";
import { DocumentAttachmentList } from "./document-attachment-list";
import { Button } from "./ui/button";
import { InfoCallout } from "./ui/info-callout";

const captureGuideMarker = "**Wie erfassen Sie den Prozess richtig?**";

function Body({ text, className = "" }: { text: string; className?: string }) {
  return (
    <div className={className}>
      <ReactMarkdown
        allowedElements={["p", "strong", "em", "ul", "ol", "li", "br", "code"]}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

function splitInitialCaptureMessage(text: string) {
  const markerIndex = text.indexOf(captureGuideMarker);
  if (markerIndex < 0) return { introduction: text, guide: null };
  return {
    introduction: text.slice(0, markerIndex).trim(),
    guide: text.slice(markerIndex + captureGuideMarker.length).trim(),
  };
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
  const content = splitInitialCaptureMessage(text);
  return (
    <section
      className="rounded-xl border bg-card p-5"
      aria-labelledby="capture-milestone-title"
    >
      <p className="text-overline uppercase text-primary">Prozesserfassung</p>
      <div id="capture-milestone-title" className="mt-3 text-body">
        <Body text={content.introduction} className="[&_p+p]:mt-3" />
      </div>
      {content.guide && (
        <InfoCallout
          title="Wie erfassen Sie den Prozess richtig?"
          className="mt-5"
        >
          <Body
            text={content.guide}
            className="[&_li]:ml-5 [&_li]:pl-1 [&_li]:list-decimal [&_li+li]:mt-1.5"
          />
        </InfoCallout>
      )}
      {documentGate ??
        (hasAttachments && (
          <div className="mt-5 border-t pt-4">
            <p className="text-label">Verwendete Unterlagen</p>
            {missingSelectedCount > 0 && (
              <p role="alert" className="mt-2 text-ui text-destructive">
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
      className="rounded-xl border border-primary/25 bg-card p-5"
      aria-labelledby="confirmation-milestone-title"
    >
      <p className="text-overline uppercase text-primary">Prozess bestätigt</p>
      <div id="confirmation-milestone-title" className="mt-3 text-body">
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
