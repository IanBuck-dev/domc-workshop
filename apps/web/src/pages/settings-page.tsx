import { useEffect, useRef, useState } from "react";
import { Download, RotateCcw, Save, Upload } from "lucide-react";
import { api } from "../lib/api-client";
import {
  exportConfig,
  importConfig,
  loadConfigOverride,
  resetConfigOverride,
  saveConfigOverride,
} from "../lib/local-config";
import type { AssessmentConfig } from "../lib/assessment-types";

export function SettingsPage() {
  const [defaults, setDefaults] = useState<AssessmentConfig | null>(null);
  const [config, setConfig] = useState<AssessmentConfig | null>(null);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => {
    api
      .configDefaults()
      .then((d) => {
        setDefaults(d);
        setConfig(loadConfigOverride() ?? d);
      })
      .catch((e: Error) => setError(e.message));
  }, []);
  if (!config) return <p>{error || "Einstellungen werden geladen …"}</p>;
  const current = config;
  function updateInstruction(
    key: keyof AssessmentConfig["instructions"],
    value: string,
  ) {
    setConfig({
      ...current,
      instructions: { ...current.instructions, [key]: value },
    });
  }
  function save() {
    try {
      saveConfigOverride(current);
      setError("");
      setMsg("Die Einstellungen wurden in diesem Browser gespeichert.");
    } catch {
      setMsg("");
      setError(
        "Die Einstellungen sind noch nicht gültig. Bitte prüfen Sie Grenzwerte, Pflichttexte und Reihenfolgen.",
      );
    }
  }
  function updateThreshold(
    key:
      "paybackMonthThresholds" | "yearOneNetReturnThresholds" | "roiThresholds",
    index: number,
    value: number,
  ) {
    const thresholds = [...current.scoring[key]] as [
      number,
      number,
      number,
      number,
    ];
    thresholds[index] = value;
    setConfig({
      ...current,
      scoring: { ...current.scoring, [key]: thresholds },
    });
  }
  return (
    <section className="settings assessment-settings">
      <div className="page-title">
        <div>
          <span className="kicker">TESTKONFIGURATION</span>
          <h1>Einstellungen</h1>
          <p>
            Änderungen gelten nur für neue Bewertungen und bleiben in diesem
            Browser.
          </p>
        </div>
        <div className="title-actions">
          <button className="text-button" onClick={() => exportConfig(config)}>
            <Download />
            Exportieren
          </button>
          <input
            ref={file}
            hidden
            type="file"
            name="config-import"
            accept="application/json,.json"
            onChange={async (e) => {
              try {
                const f = e.target.files?.[0];
                if (f) {
                  const imported = await importConfig(f);
                  setConfig(imported);
                  saveConfigOverride(imported);
                  setMsg("Konfiguration importiert.");
                }
              } catch (err) {
                setError((err as Error).message);
              }
            }}
          />
          <button className="text-button" onClick={() => file.current?.click()}>
            <Upload />
            Importieren
          </button>
          <button
            className="text-button"
            onClick={() => {
              if (defaults) {
                resetConfigOverride();
                setConfig(defaults);
                setMsg("Browser-Anpassungen wurden zurückgesetzt.");
              }
            }}
          >
            <RotateCcw />
            Zurücksetzen
          </button>
        </div>
      </div>
      <div className="settings-sections">
        <details className="panel" open>
          <summary>
            <h2>Hinweise für die KI-Unterstützung</h2>
          </summary>
          <p>
            Formulieren Sie in normaler Sprache, worauf bei jeder Aufgabe
            besonders geachtet werden soll.
          </p>
          {[
            ["gateway", "Einstiegsfragen auswerten"],
            ["formPrefill", "Formular vorausfüllen"],
            ["chat", "Gespräch führen"],
            ["reviewer", "Ergebnis prüfen"],
          ].map(([key, label]) => (
            <label key={key}>
              {label}
              <textarea
                name={`instruction-${key}`}
                rows={5}
                value={
                  config.instructions[key as keyof typeof config.instructions]
                }
                onChange={(e) =>
                  updateInstruction(
                    key as keyof typeof config.instructions,
                    e.target.value,
                  )
                }
              />
            </label>
          ))}
        </details>
        <details className="panel">
          <summary>
            <h2>Startnachricht im KI-Gespräch</h2>
          </summary>
          <label>
            Begrüßung und Ablauf
            <textarea
              name="opening-message"
              rows={7}
              value={config.openingMessage}
              onChange={(e) =>
                setConfig({ ...config, openingMessage: e.target.value })
              }
            />
          </label>
        </details>
        <details className="panel">
          <summary>
            <h2>Fachbereiche und Gesprächsrahmen</h2>
          </summary>
          <label>
            Fachbereiche (eine Zeile je Eintrag)
            <textarea
              name="departments"
              rows={7}
              value={config.departments.join("\n")}
              onChange={(e) =>
                setConfig({
                  ...config,
                  departments: e.target.value
                    .split("\n")
                    .map((value) => value.trim())
                    .filter(Boolean),
                })
              }
            />
          </label>
          <label>
            Höchstens Rückfragen je Themenbereich
            <input
              name="chat-follow-ups"
              type="number"
              min={0}
              max={2}
              value={config.chat.maxFollowUpsPerSection}
              onChange={(e) =>
                setConfig({
                  ...config,
                  chat: {
                    ...config.chat,
                    maxFollowUpsPerSection: Number(e.target.value),
                  },
                })
              }
            />
          </label>
          <label>
            Höchstens Rückfragen zu den Einstiegsfragen
            <input
              name="gateway-follow-ups"
              type="number"
              min={0}
              max={1}
              value={config.gateway.maxFollowUps}
              onChange={(e) =>
                setConfig({
                  ...config,
                  gateway: {
                    ...config.gateway,
                    maxFollowUps: Number(e.target.value),
                  },
                })
              }
            />
          </label>
        </details>
        <details className="panel">
          <summary>
            <h2>Vier Einstiegsfragen</h2>
          </summary>
          {[...config.gateway.questions]
            .sort((left, right) => left.displayOrder - right.displayOrder)
            .map((q, index) => (
              <div className="editable-row" key={q.id}>
                <b>{index + 1}</b>
                <label>
                  Kurzbezeichnung
                  <textarea
                    name={`gateway-question-${q.id}`}
                    rows={3}
                    value={q.name}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        gateway: {
                          ...config.gateway,
                          questions: config.gateway.questions.map((x) =>
                            x.id === q.id ? { ...x, name: e.target.value } : x,
                          ),
                        },
                      })
                    }
                  />
                </label>
                <label>
                  Interne Prüffrage für die KI
                  <textarea
                    name={`gateway-evaluation-${q.id}`}
                    rows={4}
                    value={q.evaluationQuestion ?? q.description ?? ""}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        gateway: {
                          ...config.gateway,
                          questions: config.gateway.questions.map((x) =>
                            x.id === q.id
                              ? {
                                  ...x,
                                  evaluationQuestion: e.target.value,
                                }
                              : x,
                          ),
                        },
                      })
                    }
                  />
                </label>
                <label>
                  Sichtbare offene Frage
                  <textarea
                    name={`gateway-user-question-${q.id}`}
                    rows={4}
                    value={q.userQuestion ?? q.description ?? ""}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        gateway: {
                          ...config.gateway,
                          questions: config.gateway.questions.map((x) =>
                            x.id === q.id
                              ? { ...x, userQuestion: e.target.value }
                              : x,
                          ),
                        },
                      })
                    }
                  />
                </label>
                <label>
                  Hilfstext und Beispiele
                  <textarea
                    name={`gateway-help-${q.id}`}
                    rows={4}
                    value={q.helpText ?? q.description ?? ""}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        gateway: {
                          ...config.gateway,
                          questions: config.gateway.questions.map((x) =>
                            x.id === q.id
                              ? { ...x, helpText: e.target.value }
                              : x,
                          ),
                        },
                      })
                    }
                  />
                </label>
                <label>
                  Reihenfolge
                  <input
                    name={`gateway-order-${q.id}`}
                    type="number"
                    min={0}
                    value={q.displayOrder}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        gateway: {
                          ...config.gateway,
                          questions: config.gateway.questions.map((x) =>
                            x.id === q.id
                              ? { ...x, displayOrder: Number(e.target.value) }
                              : x,
                          ),
                        },
                      })
                    }
                  />
                </label>
              </div>
            ))}
        </details>
        <details className="panel">
          <summary>
            <h2>Kriterien und Bereiche</h2>
          </summary>
          {[...config.chat.sections]
            .sort((a, b) => a.displayOrder - b.displayOrder)
            .map((section) => (
              <section className="settings-criteria" key={section.id}>
                <h3>{section.name}</h3>
                <div className="editable-criterion compact-settings-row">
                  <label>
                    Bereichsname
                    <input
                      name={`section-name-${section.id}`}
                      value={section.name}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          chat: {
                            ...config.chat,
                            sections: config.chat.sections.map((value) =>
                              value.id === section.id
                                ? { ...value, name: e.target.value }
                                : value,
                            ),
                          },
                        })
                      }
                    />
                  </label>
                  <label>
                    Reihenfolge
                    <input
                      name={`section-order-${section.id}`}
                      type="number"
                      min={1}
                      value={section.displayOrder}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          chat: {
                            ...config.chat,
                            sections: config.chat.sections.map((value) =>
                              value.id === section.id
                                ? {
                                    ...value,
                                    displayOrder: Number(e.target.value),
                                  }
                                : value,
                            ),
                          },
                        })
                      }
                    />
                  </label>
                </div>
                <label>
                  Beschreibung des Themenbereichs
                  <textarea
                    name={`section-description-${section.id}`}
                    rows={2}
                    value={section.description}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        chat: {
                          ...config.chat,
                          sections: config.chat.sections.map((value) =>
                            value.id === section.id
                              ? { ...value, description: e.target.value }
                              : value,
                          ),
                        },
                      })
                    }
                  />
                </label>
                <label>
                  Leitfrage für diesen Themenbereich
                  <textarea
                    name={`section-question-${section.id}`}
                    rows={3}
                    value={section.mainQuestion}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        chat: {
                          ...config.chat,
                          sections: config.chat.sections.map((value) =>
                            value.id === section.id
                              ? { ...value, mainQuestion: e.target.value }
                              : value,
                          ),
                        },
                      })
                    }
                  />
                </label>
                {config.criteria
                  .filter((c) => c.sectionId === section.id)
                  .map((c) => (
                    <div className="editable-criterion" key={c.id}>
                      <label>
                        Name
                        <input
                          name={`criterion-name-${c.id}`}
                          value={c.name}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              criteria: config.criteria.map((x) =>
                                x.id === c.id
                                  ? { ...x, name: e.target.value }
                                  : x,
                              ),
                            })
                          }
                        />
                      </label>
                      <label>
                        Beschreibung
                        <textarea
                          name={`criterion-description-${c.id}`}
                          rows={2}
                          value={c.description}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              criteria: config.criteria.map((x) =>
                                x.id === c.id
                                  ? { ...x, description: e.target.value }
                                  : x,
                              ),
                            })
                          }
                        />
                      </label>
                      <label>
                        Minimum
                        <input
                          name={`criterion-minimum-${c.id}`}
                          type="number"
                          value={c.minimum}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              criteria: config.criteria.map((x) =>
                                x.id === c.id
                                  ? { ...x, minimum: Number(e.target.value) }
                                  : x,
                              ),
                            })
                          }
                        />
                      </label>
                      <label>
                        Maximum
                        <input
                          name={`criterion-maximum-${c.id}`}
                          type="number"
                          value={c.maximum}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              criteria: config.criteria.map((x) =>
                                x.id === c.id
                                  ? { ...x, maximum: Number(e.target.value) }
                                  : x,
                              ),
                            })
                          }
                        />
                      </label>
                      <label>
                        Gewichtung
                        <input
                          name={`criterion-weight-${c.id}`}
                          type="number"
                          min={0}
                          value={c.weight}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              criteria: config.criteria.map((x) =>
                                x.id === c.id
                                  ? { ...x, weight: Number(e.target.value) }
                                  : x,
                              ),
                            })
                          }
                        />
                      </label>
                      <label>
                        Eingabeart
                        <select
                          name={`criterion-input-type-${c.id}`}
                          value={c.inputType}
                          onChange={(e) => {
                            const inputType = e.target.value as
                              "currency" | "integer" | "boolean";
                            setConfig({
                              ...config,
                              criteria: config.criteria.map((x) =>
                                x.id === c.id
                                  ? {
                                      ...x,
                                      inputType,
                                      ...(inputType === "boolean"
                                        ? { minimum: 0, maximum: 1 }
                                        : {}),
                                    }
                                  : x,
                              ),
                            });
                          }}
                        >
                          <option value="currency">Geldbetrag</option>
                          <option value="integer">Ganzzahl</option>
                          <option value="boolean">Ja/Nein</option>
                        </select>
                      </label>
                      <label>
                        Reihenfolge
                        <input
                          name={`criterion-order-${c.id}`}
                          type="number"
                          min={1}
                          value={c.displayOrder}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              criteria: config.criteria.map((x) =>
                                x.id === c.id
                                  ? {
                                      ...x,
                                      displayOrder: Number(e.target.value),
                                    }
                                  : x,
                              ),
                            })
                          }
                        />
                      </label>
                      <label>
                        Bewertungsrichtung
                        <select
                          name={`criterion-direction-${c.id}`}
                          value={c.scoringDirection}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              criteria: config.criteria.map((x) =>
                                x.id === c.id
                                  ? {
                                      ...x,
                                      scoringDirection: e.target.value as
                                        "higher_is_better" | "lower_is_better",
                                    }
                                  : x,
                              ),
                            })
                          }
                        >
                          <option value="higher_is_better">
                            Höher ist besser
                          </option>
                          <option value="lower_is_better">
                            Niedriger ist besser
                          </option>
                        </select>
                      </label>
                    </div>
                  ))}
              </section>
            ))}
        </details>
        <details className="panel">
          <summary>
            <h2>Bewertung und Plausibilität</h2>
          </summary>
          <label>
            Warnschwelle für einzelne Geldbeträge (Euro)
            <input
              name="plausibility-warning-amount"
              type="number"
              min={0}
              value={config.scoring.plausibilityWarningAmount}
              onChange={(e) =>
                setConfig({
                  ...config,
                  scoring: {
                    ...config.scoring,
                    plausibilityWarningAmount: Number(e.target.value),
                  },
                })
              }
            />
          </label>
          {(
            [
              ["paybackMonthThresholds", "Amortisationszeit (Monate)"],
              ["yearOneNetReturnThresholds", "Netto-Ertrag Jahr 1 (Euro)"],
              ["roiThresholds", "ROI als Faktor"],
            ] as const
          ).map(([key, label]) => (
            <fieldset className="threshold-settings" key={key}>
              <legend>{label}: Schwellen für 4 / 3 / 2 / 1 Punkte</legend>
              {config.scoring[key].map((value, index) => (
                <label key={index}>
                  {4 - index} Punkte
                  <input
                    name={`${key}-${index}`}
                    type="number"
                    step={key === "roiThresholds" ? 0.1 : 1}
                    min={0}
                    value={value}
                    onChange={(e) =>
                      updateThreshold(key, index, Number(e.target.value))
                    }
                  />
                </label>
              ))}
            </fieldset>
          ))}
          <div className="editable-criterion compact-settings-row">
            <label>
              Gewicht Wirtschaftlichkeit
              <input
                name="profitability-weight"
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={config.scoring.profitabilityWeight}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  setConfig({
                    ...config,
                    scoring: {
                      ...config.scoring,
                      profitabilityWeight: value,
                      strategicWeight: 1 - value,
                    },
                  });
                }}
              />
            </label>
            <label>
              Gewicht Strategie
              <input
                name="strategic-weight"
                type="number"
                value={config.scoring.strategicWeight}
                readOnly
              />
            </label>
            <label>
              Minimalwert
              <input
                name="configured-minimum"
                type="number"
                value={config.scoring.configuredMinimum}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    scoring: {
                      ...config.scoring,
                      configuredMinimum: Number(e.target.value),
                    },
                  })
                }
              />
            </label>
            <label>
              Maximalwert
              <input
                name="configured-maximum"
                type="number"
                value={config.scoring.configuredMaximum}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    scoring: {
                      ...config.scoring,
                      configuredMaximum: Number(e.target.value),
                    },
                  })
                }
              />
            </label>
          </div>
        </details>
        <details className="panel">
          <summary>
            <h2>Technische KI-Grenzen</h2>
          </summary>
          <p>
            Diese Grenzen gelten pro einzelner KI-Aktion und verhindern lange
            oder unbeabsichtigt teure Läufe.
          </p>
          <div className="editable-criterion compact-settings-row">
            <label>
              Modell
              <input
                name="ai-model"
                value={config.ai.model}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    ai: { ...config.ai, model: e.target.value },
                  })
                }
              />
            </label>
            <label>
              Denkaufwand
              <select
                name="ai-reasoning-effort"
                value={config.ai.reasoningEffort}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    ai: {
                      ...config.ai,
                      reasoningEffort: e.target.value as
                        "low" | "medium" | "high" | "xhigh" | "max",
                    },
                  })
                }
              >
                <option value="low">Niedrig</option>
                <option value="medium">Mittel</option>
                <option value="high">Hoch</option>
                <option value="xhigh">Sehr hoch</option>
                <option value="max">Maximal</option>
              </select>
            </label>
            {(
              [
                ["timeoutMs", "Zeitlimit (Millisekunden)", 10000, 300000],
                ["maxOutputTokens", "Maximale Ausgabetokens", 256, 32768],
                ["maxInputCharacters", "Maximale Eingabezeichen", 1, 2000000],
                ["maxBudgetUsd", "Kostenlimit (US-Dollar)", 0.01, 100],
                ["reviewerChatLimit", "Rückfragen nach Prüfung", 0, 3],
              ] as const
            ).map(([key, label, min, max]) => (
              <label key={key}>
                {label}
                <input
                  name={`ai-${key}`}
                  type="number"
                  min={min}
                  max={max}
                  step={key === "maxBudgetUsd" ? 0.01 : 1}
                  value={config.ai[key]}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      ai: { ...config.ai, [key]: Number(e.target.value) },
                    })
                  }
                />
              </label>
            ))}
          </div>
        </details>
      </div>
      {error && <p className="notice error">{error}</p>}
      {msg && <p className="notice success">{msg}</p>}
      <button className="button sticky-save" onClick={save}>
        <Save />
        Im Browser speichern
      </button>
    </section>
  );
}
