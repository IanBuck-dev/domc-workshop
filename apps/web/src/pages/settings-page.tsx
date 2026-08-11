import {
  ChevronDown,
  Download,
  Info,
  RotateCcw,
  Save,
  Upload,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CompanyKnowledgeSection } from "../components/company-knowledge-section";
import {
  InstructionPreviewDialog,
  type InstructionPreview,
} from "../components/instruction-preview-dialog";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../components/ui/collapsible";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Skeleton } from "../components/ui/skeleton";
import { Textarea } from "../components/ui/textarea";
import { api } from "../lib/api-client";
import {
  exportConfig,
  importConfig,
  loadConfigOverride,
  resetConfigOverride,
  saveConfigOverride,
} from "../lib/local-config";
import type { ProcessCaptureConfig } from "../lib/process-types";
import { resetChatTutorial } from "../lib/chat-tutorial-preference";

export function SettingsPage() {
  const [defaults, setDefaults] = useState<ProcessCaptureConfig | null>(null);
  const [config, setConfig] = useState<ProcessCaptureConfig | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [preview, setPreview] = useState<InstructionPreview | null>(null);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api
      .configDefaults()
      .then((value) => {
        setDefaults(value);
        setConfig(loadConfigOverride() ?? value);
      })
      .catch((reason: Error) => setError(reason.message));
  }, []);

  if (!config && error)
    return (
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <p
          className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-label text-destructive"
          role="alert"
        >
          {error}
        </p>
      </main>
    );

  if (!config) return <SettingsPageSkeleton />;

  function save() {
    try {
      saveConfigOverride(config!);
      setError("");
      setMessage(
        "Die Einstellungen wurden in diesem Browser gespeichert und gelten für neue Prozesse.",
      );
    } catch {
      setMessage("");
      setError(
        "Die Einstellungen sind ungültig. Bitte prüfen Sie Pflichttexte und die fünf Themenbereiche.",
      );
    }
  }

  async function openInstructionPreview() {
    setPreviewOpen(true);
    setPreviewLoading(true);
    setPreviewError("");
    setPreview(null);
    try {
      setPreview(await api.instructionPreview(config!.instructions));
    } catch (reason) {
      setPreviewError((reason as Error).message);
    } finally {
      setPreviewLoading(false);
    }
  }

  function updateWorkCharacteristic(
    id: string,
    field: "question" | "helpText",
    value: string,
  ) {
    if (!("workCharacteristics" in config!)) return;
    setConfig({
      ...config,
      workCharacteristics: config.workCharacteristics.map((item) =>
        item.id === id ? { ...item, [field]: value } : item,
      ),
    });
  }

  return (
    <section className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:py-12">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl space-y-2">
          <p className="text-eyebrow uppercase text-primary">
            Testkonfiguration
          </p>
          <h1 className="text-title sm:text-display">
            Prozessaufnahme einstellen
          </h1>
          <p className="leading-6 text-muted-foreground">
            Anpassungen werden nur in diesem Browser gespeichert. Jeder neue
            Prozess erhält beim Start eine unveränderliche Kopie.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={() => exportConfig(config)}>
            <Download /> Exportieren
          </Button>
          <input
            ref={file}
            name="config-import"
            hidden
            type="file"
            accept="application/json,.json"
            onChange={async (event) => {
              try {
                const selected = event.target.files?.[0];
                if (!selected) return;
                const imported = await importConfig(selected);
                setConfig(imported);
                saveConfigOverride(imported);
                setError("");
                setMessage("Konfiguration importiert.");
              } catch (reason) {
                setMessage("");
                setError((reason as Error).message);
              } finally {
                event.target.value = "";
              }
            }}
          />
          <Button variant="ghost" onClick={() => file.current?.click()}>
            <Upload /> Importieren
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              if (!defaults) return;
              resetConfigOverride();
              setConfig(defaults);
              setError("");
              setMessage("Browser-Anpassungen wurden zurückgesetzt.");
            }}
          >
            <RotateCcw /> Zurücksetzen
          </Button>
        </div>
      </div>
      <Button
        variant="secondary"
        onClick={() => {
          resetChatTutorial();
          setMessage(
            "Die Einführung wird beim nächsten Chat erneut angezeigt.",
          );
        }}
      >
        Einführung beim nächsten Chat erneut anzeigen
      </Button>
      {message && (
        <p
          className="rounded-md border border-primary/20 bg-secondary p-3 text-label text-secondary-foreground"
          role="status"
        >
          {message}
        </p>
      )}
      {error && (
        <p
          className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-label text-destructive"
          role="alert"
        >
          {error}
        </p>
      )}
      <div className="space-y-4">
        <SettingsSection title="Fachbereiche" defaultOpen>
          <p className="text-ui text-muted-foreground">
            Ein Eintrag pro Zeile. Leere Zeilen werden beim Speichern entfernt.
          </p>
          <FormField label="Auswahlliste" htmlFor="departments">
            <Textarea
              id="departments"
              name="departments"
              rows={8}
              value={config.departments.join("\n")}
              onChange={(event) =>
                setConfig({
                  ...config,
                  departments: event.target.value
                    .split("\n")
                    .map((item) => item.trim())
                    .filter(Boolean),
                })
              }
            />
          </FormField>
        </SettingsSection>
        <SettingsSection title="Fünf Themenbereiche" defaultOpen>
          <p className="text-ui text-muted-foreground">
            Die fachliche Struktur bleibt fest. Namen, offene Fragen und
            Hilfetexte können für neue Testläufe angepasst werden.
          </p>
          <div className="divide-y divide-border">
            {[...config.topics]
              .sort((a, b) => a.displayOrder - b.displayOrder)
              .map((topic) => (
                <fieldset
                  key={topic.id}
                  className="space-y-4 py-6 first:pt-0 last:pb-0"
                >
                  <legend className="sr-only">
                    {topic.displayOrder}. {topic.name}
                  </legend>
                  <div className="text-subheading">
                    {topic.displayOrder}. {topic.name}
                  </div>
                  <FormField
                    label="Kurzbezeichnung"
                    htmlFor={`topic-${topic.id}-name`}
                  >
                    <Input
                      id={`topic-${topic.id}-name`}
                      name={`topic-${topic.id}-name`}
                      value={topic.name}
                      onChange={(event) =>
                        setConfig({
                          ...config,
                          topics: config.topics.map((item) =>
                            item.id === topic.id
                              ? { ...item, name: event.target.value }
                              : item,
                          ),
                        })
                      }
                    />
                  </FormField>
                  <FormField
                    label="Offene Frage"
                    htmlFor={`topic-${topic.id}-question`}
                  >
                    <Textarea
                      id={`topic-${topic.id}-question`}
                      name={`topic-${topic.id}-question`}
                      rows={3}
                      value={topic.question}
                      onChange={(event) =>
                        setConfig({
                          ...config,
                          topics: config.topics.map((item) =>
                            item.id === topic.id
                              ? { ...item, question: event.target.value }
                              : item,
                          ),
                        })
                      }
                    />
                  </FormField>
                  <FormField
                    label="Hilfetext"
                    htmlFor={`topic-${topic.id}-help`}
                  >
                    <Textarea
                      id={`topic-${topic.id}-help`}
                      name={`topic-${topic.id}-help`}
                      rows={2}
                      value={topic.helpText}
                      onChange={(event) =>
                        setConfig({
                          ...config,
                          topics: config.topics.map((item) =>
                            item.id === topic.id
                              ? { ...item, helpText: event.target.value }
                              : item,
                          ),
                        })
                      }
                    />
                  </FormField>
                  {"workCharacteristics" in config &&
                    config.workCharacteristics
                      .filter((item) => item.topicId === topic.id)
                      .map((characteristic) => (
                        <fieldset
                          className="space-y-4 pt-2"
                          key={characteristic.id}
                        >
                          <legend className="sr-only">
                            Verpflichtendes Arbeitsmerkmal
                          </legend>
                          <div className="text-label">
                            Verpflichtendes Arbeitsmerkmal
                          </div>
                          <FormField
                            label="Frage"
                            htmlFor={`work-characteristic-${characteristic.id}-question`}
                          >
                            <Textarea
                              id={`work-characteristic-${characteristic.id}-question`}
                              name={`work-characteristic-${characteristic.id}-question`}
                              rows={3}
                              value={characteristic.question}
                              onChange={(event) =>
                                updateWorkCharacteristic(
                                  characteristic.id,
                                  "question",
                                  event.target.value,
                                )
                              }
                            />
                          </FormField>
                          <FormField
                            label="Hilfetext"
                            htmlFor={`work-characteristic-${characteristic.id}-help`}
                          >
                            <Textarea
                              id={`work-characteristic-${characteristic.id}-help`}
                              name={`work-characteristic-${characteristic.id}-help`}
                              rows={2}
                              value={characteristic.helpText}
                              onChange={(event) =>
                                updateWorkCharacteristic(
                                  characteristic.id,
                                  "helpText",
                                  event.target.value,
                                )
                              }
                            />
                          </FormField>
                          <div className="text-ui">
                            <b className="block">Feste Antwortmöglichkeiten</b>
                            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                              {characteristic.options.map((option) => (
                                <li key={option.id}>{option.label}</li>
                              ))}
                            </ul>
                          </div>
                        </fieldset>
                      ))}
                </fieldset>
              ))}
          </div>
        </SettingsSection>
        <SettingsSection title="Hinweise für die KI-Unterstützung">
          <p className="text-ui text-muted-foreground">
            Diese Hinweise ergänzen die fest versionierten Sicherheits- und
            Ausgabevorgaben. Technische Laufzeit- und Sicherheitsgrenzen bleiben
            im Profil fest.
          </p>
          <Button
            type="button"
            variant="secondary"
            onClick={() => void openInstructionPreview()}
          >
            <Info /> Vollständige Anweisungen ansehen
          </Button>
          <FormField
            label="Materielle Rückfragen"
            htmlFor="instructions-follow-ups"
          >
            <Textarea
              id="instructions-follow-ups"
              name="instructions-follow-ups"
              rows={6}
              value={config.instructions.followUps}
              onChange={(event) =>
                setConfig({
                  ...config,
                  instructions: {
                    ...config.instructions,
                    followUps: event.target.value,
                  },
                })
              }
            />
          </FormField>
          <FormField
            label="Prozessbild erstellen"
            htmlFor="instructions-synthesis"
          >
            <Textarea
              id="instructions-synthesis"
              name="instructions-synthesis"
              rows={6}
              value={config.instructions.synthesis}
              onChange={(event) =>
                setConfig({
                  ...config,
                  instructions: {
                    ...config.instructions,
                    synthesis: event.target.value,
                  },
                })
              }
            />
          </FormField>
        </SettingsSection>
        <SettingsSection title="Gelerntes Firmenwissen">
          <CompanyKnowledgeSection />
        </SettingsSection>
      </div>
      <div className="flex justify-end pt-2">
        <Button onClick={save}>
          <Save /> Im Browser speichern
        </Button>
      </div>
      <InstructionPreviewDialog
        open={previewOpen}
        loading={previewLoading}
        error={previewError}
        preview={preview}
        onClose={() => setPreviewOpen(false)}
      />
    </section>
  );
}

function SettingsPageSkeleton() {
  return (
    <section
      className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:py-12"
      role="status"
      aria-busy="true"
      aria-label="Einstellungen werden geladen"
    >
      <span className="sr-only">Einstellungen werden geladen</span>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-9 w-80 sm:h-11" />
          <Skeleton className="h-4 w-full max-w-xl" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-32" />
        </div>
      </div>
      <Skeleton className="h-9 w-72" />
      <div className="space-y-4">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    </section>
  );
}

function SettingsSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Collapsible defaultOpen={defaultOpen}>
      <Card className="gap-0 py-0">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-4 p-5 text-left hover:bg-muted sm:px-6"
          >
            <h2 className="text-heading">{title}</h2>
            <ChevronDown className="size-5 text-muted-foreground transition-transform [[data-state=open]_&]:rotate-180" />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-5 border-t px-5 py-5 sm:px-6">
            {children}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function FormField({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
