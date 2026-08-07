import { Check, ChevronLeft, FileText, PlayCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { api, type DemoSzenario } from "../lib/api-client";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Spinner } from "./ui/spinner";

const openKey = "claims-ai.demo-sidecar.open.v1";
const slugKey = "claims-ai.demo-sidecar.slug.v1";

export function DemoSidecar({
  processName,
  stage,
  suppressed = false,
  uploadedFileNames,
  onInsertText,
  onUploadFile,
  onFillForm,
  onFillCover,
}: {
  processName?: string;
  /**
   * Schritt der Chat-Erfassung. „documents“ ist die Unterlagen-Schleuse: hier
   * hilft nur die Dateiliste. „chat“ ist das Gespräch danach. Ohne Angabe
   * (Startseite, Formular) bleibt der Sidecar vollständig.
   */
  stage?: "documents" | "chat";
  /**
   * Blendet den Sidecar samt Griff vorübergehend aus — etwa im erweiterten
   * Prozessbild, wo der Griff sonst über der schmalen Chatspalte liegt. Der
   * gewählte Zustand bleibt erhalten: Die Komponente bleibt eingehängt und
   * rendert nur nichts.
   */
  suppressed?: boolean;
  /** Bereits hochgeladene Dateien — sie verschwinden aus der Liste. */
  uploadedFileNames?: string[];
  onInsertText?: (text: string) => void;
  onUploadFile?: (file: File) => Promise<void>;
  onFillForm?: (formular: NonNullable<DemoSzenario["formular"]>) => void;
  onFillCover?: (cover: DemoSzenario["cover"]) => void;
}) {
  const [szenarien, setSzenarien] = useState<DemoSzenario[] | null>(null);
  const [open, setOpen] = useState(() => localStorage.getItem(openKey) === "1");
  const [slug, setSlug] = useState<string | null>(() =>
    localStorage.getItem(slugKey),
  );
  const [erledigt, setErledigt] = useState<Set<number>>(new Set());
  const [ladeDatei, setLadeDatei] = useState<string | null>(null);
  const [dateiFehler, setDateiFehler] = useState("");

  useEffect(() => {
    let aktiv = true;
    api
      .demoSzenarien()
      .then((response) => {
        if (aktiv) setSzenarien(response.szenarien);
      })
      .catch(() => {
        if (aktiv) setSzenarien([]);
      });
    return () => {
      aktiv = false;
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(openKey, open ? "1" : "0");
  }, [open]);

  useEffect(() => {
    if (slug) localStorage.setItem(slugKey, slug);
  }, [slug]);

  if (suppressed || !szenarien || szenarien.length === 0) return null;

  const gewaehlt =
    szenarien.find((item) => item.slug === slug) ??
    szenarien.find((item) => item.cover.processName === processName) ??
    szenarien[0];

  // Der Server sanitisiert Uploadnamen ohne Zähler-Suffix, der Namensvergleich
  // mit `zielname` trägt also.
  const bereitsGeladen = new Set(uploadedFileNames ?? []);
  const offeneDokumente = (gewaehlt?.dokumente ?? []).filter(
    (dokument) => !bereitsGeladen.has(dokument.zielname),
  );
  // In der Schleusenphase sind Antwortvorschläge nutzlos: Es kann noch keine
  // Nachricht gesendet werden.
  const zeigeVorschlaege = stage !== "documents";

  function waehleSzenario(nextSlug: string) {
    setSlug(nextSlug);
    setErledigt(new Set());
    setDateiFehler("");
  }

  async function ladeDateiUndLade(dokument: DemoSzenario["dokumente"][number]) {
    if (!gewaehlt || !onUploadFile) return;
    setDateiFehler("");
    setLadeDatei(dokument.zielname);
    try {
      const blob = await api.demoSzenarioDatei(
        gewaehlt.slug,
        dokument.zielname,
      );
      const file = new File([blob], dokument.zielname, {
        type: blob.type || "application/octet-stream",
      });
      await onUploadFile(file);
    } catch (reason) {
      setDateiFehler(
        reason instanceof Error
          ? reason.message
          : "Die Datei konnte nicht hochgeladen werden.",
      );
    } finally {
      setLadeDatei(null);
    }
  }

  if (!open)
    return (
      <div className="fixed top-16 bottom-0 left-0 z-30 flex items-center">
        <button
          type="button"
          aria-expanded={false}
          aria-label="Demo-Sidecar öffnen"
          onClick={() => setOpen(true)}
          className="flex -translate-x-0 items-center gap-1.5 rounded-r-lg border border-l-0 border-border bg-card px-2 py-3 text-label text-muted-foreground shadow-md hover:bg-accent hover:text-accent-foreground"
        >
          <PlayCircle className="size-4" />
          <span className="[writing-mode:vertical-rl]">Demo</span>
        </button>
      </div>
    );

  return (
    <div className="fixed top-16 bottom-0 left-0 z-30 flex items-start">
      <div className="flex max-h-full w-[320px] flex-col overflow-hidden rounded-r-lg border border-l-0 border-border bg-card shadow-lg">
        <header className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
          <p className="text-label">Demo-Drehbuch</p>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-expanded={true}
            aria-label="Demo-Sidecar schließen"
            onClick={() => setOpen(false)}
          >
            <ChevronLeft className="size-4" />
          </Button>
        </header>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-3">
          <Select value={gewaehlt?.slug} onValueChange={waehleSzenario}>
            <SelectTrigger className="w-full" size="sm">
              <SelectValue placeholder="Szenario wählen" />
            </SelectTrigger>
            <SelectContent>
              {szenarien.map((item) => (
                <SelectItem key={item.slug} value={item.slug}>
                  {item.titel}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {stage === "documents" && (gewaehlt?.dokumente.length ?? 0) === 0 && (
            <p className="rounded-md border border-border bg-muted px-2.5 py-2 text-ui text-muted-foreground">
              Dieses Szenario nutzt keine Unterlagen. Wählen Sie im Chat „Ohne
              Unterlagen fortfahren“.
            </p>
          )}

          {zeigeVorschlaege &&
            gewaehlt?.interactionMode === "chat" &&
            onInsertText &&
            gewaehlt.zuege.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-caption uppercase text-muted-foreground">
                  Vorschläge
                </p>
                <ul className="space-y-1.5">
                  {gewaehlt.zuege.map((zug) => {
                    const erledigtStatus = erledigt.has(zug.nummer);
                    return (
                      <li key={zug.nummer}>
                        <button
                          type="button"
                          aria-label={`Vorschlag ${zug.nummer} in den Composer einfügen`}
                          onClick={() => {
                            onInsertText(zug.antwort);
                            setErledigt((current) =>
                              new Set(current).add(zug.nummer),
                            );
                          }}
                          className={`w-full rounded-md border px-2.5 py-2 text-left text-ui hover:bg-accent ${erledigtStatus ? "border-border bg-muted text-muted-foreground" : "border-border bg-background"}`}
                        >
                          <span className="flex items-start gap-1.5">
                            {erledigtStatus ? (
                              <Check className="mt-0.5 size-3.5 shrink-0 text-primary" />
                            ) : (
                              <span className="mt-0.5 shrink-0 text-label text-muted-foreground">
                                {zug.nummer}.
                              </span>
                            )}
                            <span className="line-clamp-3" title={zug.antwort}>
                              {zug.antwort}
                            </span>
                          </span>
                          {zug.hinweis && (
                            <span className="mt-1 block text-caption text-muted-foreground">
                              {zug.hinweis}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

          {gewaehlt && onFillCover && (
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={() => onFillCover(gewaehlt.cover)}
            >
              Grunddaten einfüllen
            </Button>
          )}

          {gewaehlt && onUploadFile && offeneDokumente.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-caption uppercase text-muted-foreground">
                Dokumente
              </p>
              <ul className="space-y-1.5">
                {offeneDokumente.map((dokument) => {
                  const laedt = ladeDatei === dokument.zielname;
                  return (
                    <li key={dokument.zielname}>
                      <button
                        type="button"
                        aria-label={`Datei ${dokument.zielname} hochladen`}
                        disabled={laedt}
                        onClick={() => void ladeDateiUndLade(dokument)}
                        className="flex w-full items-center gap-2 rounded-md border border-border bg-background px-2.5 py-2 text-left text-ui hover:bg-accent disabled:opacity-60"
                      >
                        {laedt ? (
                          <Spinner className="size-3.5 shrink-0" />
                        ) : (
                          <FileText className="size-3.5 shrink-0 text-primary" />
                        )}
                        <span className="min-w-0 flex-1 truncate">
                          {dokument.zielname}
                        </span>
                        <Badge variant="outline" className="uppercase">
                          {dokument.format}
                        </Badge>
                      </button>
                    </li>
                  );
                })}
              </ul>
              {dateiFehler && (
                <p role="alert" className="text-caption text-destructive">
                  {dateiFehler}
                </p>
              )}
            </div>
          )}

          {gewaehlt?.formular && onFillForm && (
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={() => onFillForm(gewaehlt.formular!)}
            >
              Antworten einfüllen
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
