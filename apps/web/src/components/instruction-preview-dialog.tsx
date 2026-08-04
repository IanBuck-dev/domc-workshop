import ReactMarkdown from "react-markdown";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Skeleton } from "./ui/skeleton";

export interface InstructionPreview {
  base: string;
  followUps: string;
  synthesis: string;
}

export function InstructionPreviewDialog({
  open,
  loading,
  error,
  preview,
  onClose,
}: {
  open: boolean;
  loading: boolean;
  error: string;
  preview: InstructionPreview | null;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <p className="text-eyebrow uppercase text-primary">
            KI-Unterstützung
          </p>
          <DialogTitle>Vollständige Anweisungen</DialogTitle>
          <DialogDescription>
            Feste Leitplanken und Ihre aktuell eingetragenen Zusatzhinweise
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          {loading && (
            <div
              aria-live="polite"
              role="status"
              aria-busy="true"
              aria-label="Anweisungen werden geladen"
              className="space-y-5"
            >
              <span className="sr-only">Anweisungen werden geladen</span>
              {Array.from({ length: 3 }, (_, index) => (
                <div
                  key={index}
                  className="space-y-3 rounded-lg border border-border p-4"
                >
                  <Skeleton className="h-5 w-56" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              ))}
            </div>
          )}
          {error && (
            <p
              className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-label text-destructive"
              role="alert"
            >
              {error}
            </p>
          )}
          {preview && !loading && !error && (
            <>
              <InstructionMarkdown
                title="Gemeinsame globale Rolle"
                markdown={preview.base}
              />
              <InstructionMarkdown
                title="Materielle Rückfragen"
                markdown={preview.followUps}
              />
              <InstructionMarkdown
                title="Prozessbild erstellen"
                markdown={preview.synthesis}
              />
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InstructionMarkdown({
  title,
  markdown,
}: {
  title: string;
  markdown: string;
}) {
  return (
    <section
      className="space-y-3 rounded-lg border border-border p-4"
      aria-label={title}
    >
      <h3 className="font-semibold">{title}</h3>
      <div className="space-y-3 text-ui text-muted-foreground [&_h4]:font-semibold [&_h4]:text-foreground [&_h5]:font-semibold [&_h5]:text-foreground [&_li]:ml-5 [&_li]:list-disc [&_p]:my-2">
        <ReactMarkdown
          skipHtml
          components={{
            h1: ({ children }) => <h4>{children}</h4>,
            h2: ({ children }) => <h5>{children}</h5>,
            h3: ({ children }) => <h5>{children}</h5>,
          }}
        >
          {markdown}
        </ReactMarkdown>
      </div>
    </section>
  );
}
