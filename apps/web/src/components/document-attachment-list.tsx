import {
  AlertCircle,
  Check,
  ChevronDown,
  Eye,
  File,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileType,
  Presentation,
  X,
} from "lucide-react";
import { useState } from "react";
import type { ProcessUnderstanding, UploadRecord } from "../lib/process-types";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./ui/collapsible";
import { Spinner } from "./ui/spinner";

const visibleUploadCount = 3;

export function formatUploadSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatUploadType(mediaType: string, name = "") {
  const knownTypes: Record<string, string> = {
    "application/pdf": "PDF",
    "application/msword": "DOC",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      "DOCX",
    "application/vnd.ms-excel": "XLS",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLSX",
    "application/vnd.ms-powerpoint": "PPT",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation":
      "PPTX",
    "text/plain": "TXT",
    "text/markdown": "Markdown",
    "text/csv": "CSV",
  };
  if (knownTypes[mediaType]) return knownTypes[mediaType];
  if (mediaType.startsWith("image/"))
    return mediaType.slice("image/".length).toUpperCase();
  const extension = name.split(".").pop()?.trim().toUpperCase();
  return extension && extension !== name.toUpperCase() ? extension : "Datei";
}

export function truncateMiddle(value: string, maxLength = 48) {
  if (value.length <= maxLength) return value;
  if (maxLength <= 1) return "…";
  const visibleCharacters = maxLength - 1;
  const prefixLength = Math.ceil(visibleCharacters / 2);
  const suffixLength = Math.floor(visibleCharacters / 2);
  return `${value.slice(0, prefixLength)}…${value.slice(-suffixLength)}`;
}

export function uploadIconKind(mediaType: string) {
  if (mediaType.startsWith("image/")) return "image" as const;
  if (
    mediaType === "application/vnd.ms-excel" ||
    mediaType ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mediaType === "text/csv"
  )
    return "spreadsheet" as const;
  if (
    mediaType === "application/vnd.ms-powerpoint" ||
    mediaType ===
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  )
    return "presentation" as const;
  if (
    mediaType === "application/msword" ||
    mediaType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  )
    return "document" as const;
  if (mediaType === "application/pdf" || mediaType.startsWith("text/"))
    return "text" as const;
  return "file" as const;
}

function UploadIcon({ mediaType }: { mediaType: string }) {
  const className = "size-9 shrink-0 text-primary";
  const kind = uploadIconKind(mediaType);
  if (kind === "image")
    return <FileImage className={className} aria-hidden="true" />;
  if (kind === "spreadsheet")
    return <FileSpreadsheet className={className} aria-hidden="true" />;
  if (kind === "presentation")
    return <Presentation className={className} aria-hidden="true" />;
  if (kind === "document")
    return <FileType className={className} aria-hidden="true" />;
  if (kind === "text")
    return <FileText className={className} aria-hidden="true" />;
  return <File className={className} aria-hidden="true" />;
}

type SharedProps = {
  uploads: UploadRecord[];
  onPreview: (upload: UploadRecord) => void;
};
type DocumentCoverage = ProcessUnderstanding["documentCoverage"][number];
export type AttachmentCoveragePresentation = {
  label: string;
  tone: "complete" | "partial" | "failed" | "processing" | "pending";
  limitation: string | null;
};

export function getAttachmentCoveragePresentation(
  coverage: DocumentCoverage | undefined,
  processing: boolean,
): AttachmentCoveragePresentation {
  if (!coverage)
    return processing
      ? {
          label: "Wird ausgewertet …",
          tone: "processing",
          limitation: null,
        }
      : {
          label: "Noch nicht ausgewertet",
          tone: "pending",
          limitation: null,
        };
  if (coverage.status === "complete")
    return { label: "Ausgewertet", tone: "complete", limitation: null };
  if (coverage.status === "partial")
    return {
      label: "Teilweise ausgewertet",
      tone: "partial",
      limitation: coverage.limitation,
    };
  return {
    label: "Nicht auswertbar",
    tone: "failed",
    limitation: coverage.limitation,
  };
}

function CoverageStatus({
  presentation,
}: {
  presentation: AttachmentCoveragePresentation;
}) {
  const icon =
    presentation.tone === "complete" ? (
      <Check className="size-3.5" aria-hidden="true" />
    ) : presentation.tone === "processing" ? (
      <Spinner className="size-3.5" aria-hidden="true" />
    ) : presentation.tone === "partial" || presentation.tone === "failed" ? (
      <AlertCircle className="size-3.5" aria-hidden="true" />
    ) : null;
  const toneClassName =
    presentation.tone === "complete"
      ? "text-primary"
      : presentation.tone === "partial"
        ? "text-amber-700"
        : presentation.tone === "failed"
          ? "text-destructive"
          : "text-muted-foreground";

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 text-label ${toneClassName}`}
    >
      {icon}
      {presentation.label}
    </span>
  );
}

type SelectableProps = SharedProps & {
  mode: "selectable";
  selectedIds: string[];
  disabled: boolean;
  onSelected: (ids: string[]) => void;
  onRemove: (upload: UploadRecord) => void;
};
type ReadonlyProps = SharedProps & {
  mode: "readonly";
  coverageByUploadId?: Readonly<Record<string, DocumentCoverage | undefined>>;
  processing?: boolean;
};

export function DocumentAttachmentList(props: SelectableProps | ReadonlyProps) {
  const [open, setOpen] = useState(false);
  if (!props.uploads.length) return null;
  const visibleUploads = props.uploads.slice(0, visibleUploadCount);
  const additionalUploads = props.uploads.slice(visibleUploadCount);
  const additionalUploadLabel =
    additionalUploads.length === 1
      ? "1 weitere Unterlage anzeigen"
      : `${additionalUploads.length} weitere Unterlagen anzeigen`;

  const renderUpload = (upload: UploadRecord) => {
    const selected =
      props.mode === "selectable" && props.selectedIds.includes(upload.id);
    const coveragePresentation =
      props.mode === "readonly"
        ? getAttachmentCoveragePresentation(
            props.coverageByUploadId?.[upload.id],
            props.processing ?? false,
          )
        : null;
    return (
      <li key={upload.id} className="flex items-center gap-2 p-3">
        {props.mode === "selectable" && (
          <Checkbox
            checked={selected}
            disabled={props.disabled}
            aria-label={`${upload.name} auswählen`}
            onCheckedChange={(checked) =>
              props.onSelected(
                checked === true
                  ? [...props.selectedIds, upload.id]
                  : props.selectedIds.filter((id) => id !== upload.id),
              )
            }
          />
        )}
        <UploadIcon mediaType={upload.mediaType} />
        <div className="min-w-0 flex-1">
          <button
            type="button"
            className="block max-w-full truncate text-left text-label hover:text-primary hover:underline"
            title={upload.name}
            onClick={() => props.onPreview(upload)}
          >
            {truncateMiddle(upload.name)}
          </button>
          <p className="text-caption text-muted-foreground">
            {formatUploadType(upload.mediaType, upload.name)} ·{" "}
            {formatUploadSize(upload.size)}
          </p>
        </div>
        {coveragePresentation && (
          <CoverageStatus presentation={coveragePresentation} />
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`${upload.name} Vorschau öffnen`}
          onClick={() => props.onPreview(upload)}
        >
          <Eye className="size-4" />
        </Button>
        {props.mode === "selectable" && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={props.disabled}
            aria-label={`${upload.name} entfernen`}
            onClick={() => props.onRemove(upload)}
          >
            <X className="size-4" />
          </Button>
        )}
      </li>
    );
  };

  return (
    <div
      className="mt-3 overflow-hidden rounded-lg border"
      aria-label="Unterlagen"
    >
      <ul className="divide-y" aria-label="Unterlagen">
        {visibleUploads.map(renderUpload)}
      </ul>
      {additionalUploads.length > 0 && (
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between border-t px-3 py-2 text-label hover:bg-muted"
            >
              {open ? "Weniger anzeigen" : additionalUploadLabel}
              <ChevronDown className="size-4 text-muted-foreground transition-transform [[data-state=open]_&]:rotate-180" />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ul className="divide-y border-t" aria-label="Weitere Unterlagen">
              {additionalUploads.map(renderUpload)}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
