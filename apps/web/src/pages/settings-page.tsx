import {
  ChevronDown,
  Download,
  Info,
  RotateCcw,
  Save,
  Upload,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api-client";
import {
  exportConfig,
  importConfig,
  loadConfigOverride,
  resetConfigOverride,
  saveConfigOverride,
} from "../lib/local-config";
import type { ProcessCaptureConfig } from "../lib/process-types";
import {
  InstructionPreviewDialog,
  type InstructionPreview,
} from "../components/instruction-preview-dialog";
import { Button } from "../components/ui/button";
import { Kicker } from "../components/ui/kicker";
import { Card } from "../components/ui/card";

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
  if (!config) return <p>{error || "Einstellungen werden geladen …"}</p>;

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
      ...config!,
      workCharacteristics: config!.workCharacteristics.map((item) =>
        item.id === id ? { ...item, [field]: value } : item,
      ),
    });
  }

  return (
    <section className="settings">
      <div className="page-title">
        <div>
          <Kicker>Testkonfiguration</Kicker>
          <h1>Prozessaufnahme einstellen</h1>
          <p>
            Anpassungen werden nur in diesem Browser gespeichert. Jeder neue
            Prozess erhält beim Start eine unveränderliche Kopie.
          </p>
        </div>
        <div className="title-actions">
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
      {message && (
        <p className="notice success" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <div className="settings-sections">
        <Card as="details" open>
          <summary>
            <h2>Fachbereiche</h2>
            <ChevronDown className="settings-chevron" aria-hidden="true" />
          </summary>
          <p>
            Ein Eintrag pro Zeile. Leere Zeilen werden beim Speichern entfernt.
          </p>
          <label>
            Auswahlliste
            <textarea
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
          </label>
        </Card>
        <Card as="details" open>
          <summary>
            <h2>Fünf Themenbereiche</h2>
            <ChevronDown className="settings-chevron" aria-hidden="true" />
          </summary>
          <p>
            Die fachliche Struktur bleibt fest. Namen, offene Fragen und
            Hilfetexte können für neue Testläufe angepasst werden.
          </p>
          <div className="settings-topics">
            {[...config.topics]
              .sort((a, b) => a.displayOrder - b.displayOrder)
              .map((topic) => (
                <fieldset key={topic.id}>
                  <legend>
                    {topic.displayOrder}. {topic.name}
                  </legend>
                  <label>
                    Kurzbezeichnung
                    <input
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
                  </label>
                  <label>
                    Offene Frage
                    <textarea
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
                  </label>
                  <label>
                    Hilfetext
                    <textarea
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
                  </label>
                  {"workCharacteristics" in config &&
                    config.workCharacteristics
                      .filter((item) => item.topicId === topic.id)
                      .map((characteristic) => (
                        <fieldset
                          className="settings-work-characteristic"
                          key={characteristic.id}
                        >
                          <legend>Verpflichtendes Arbeitsmerkmal</legend>
                          <label>
                            Frage
                            <textarea
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
                          </label>
                          <label>
                            Hilfetext
                            <textarea
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
                          </label>
                          <div className="fixed-options-preview">
                            <b>Feste Antwortmöglichkeiten</b>
                            <ul>
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
        </Card>
        <Card as="details">
          <summary>
            <h2>Hinweise für die KI-Unterstützung</h2>
            <ChevronDown className="settings-chevron" aria-hidden="true" />
          </summary>
          <p>
            Diese Hinweise ergänzen die fest versionierten Sicherheits- und
            Ausgabevorgaben. Technische Laufzeit- und Sicherheitsgrenzen bleiben
            im Profil fest.
          </p>
          <Button
            type="button"
            variant="secondary"
            className="instruction-preview-trigger"
            onClick={() => void openInstructionPreview()}
          >
            <Info /> Vollständige Anweisungen ansehen
          </Button>
          <label>
            Materielle Rückfragen
            <textarea
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
          </label>
          <label>
            Prozessbild erstellen
            <textarea
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
          </label>
        </Card>
      </div>
      <div className="settings-save">
        <Button variant="primary" onClick={save}>
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
