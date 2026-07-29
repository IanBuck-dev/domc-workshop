import {
  AlertTriangle,
  ArrowLeft,
  LoaderCircle,
  RefreshCw,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ProcessBrief } from "../components/process-brief";
import { ProcessValidationComment } from "../components/process-validation-comment";
import {
  ProcessTopicCard,
  makeTopicAnswers,
  makeWorkCharacteristicAnswers,
} from "../components/process-topic-card";
import { ProcessUploadPicker } from "../components/process-upload-picker";
import { api } from "../lib/api-client";
import type {
  ProcessCaptureRecord,
  ProcessOperationStatus,
} from "../lib/process-types";
import { Button } from "../components/ui/button";
import { Kicker } from "../components/ui/kicker";
import { Card } from "../components/ui/card";
import { useAiOperations, useProcessChanged } from "../lib/process-events";

const stateIndex: Record<ProcessCaptureRecord["state"], number> = {
  capture_in_progress: 1,
  follow_up_required: 2,
  synthesis_ready: 2,
  review_required: 3,
  confirmed: 4,
};

export function ProcessCapturePage() {
  const { id = "" } = useParams();
  const [record, setRecord] = useState<ProcessCaptureRecord | null>(null);
  const operations = useAiOperations();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [workCharacteristicSelections, setWorkCharacteristicSelections] =
    useState<Record<string, string[]>>({});
  const [selectedUploadIds, setSelectedUploadIds] = useState<string[]>([]);
  const [invalidCharacteristicIds, setInvalidCharacteristicIds] = useState<
    Set<string>
  >(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const initializedId = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    const nextRecord = await api.process(id);
    setRecord(nextRecord);
    return nextRecord;
  }, [id]);

  useEffect(() => {
    let active = true;
    refresh().catch((reason: Error) => active && setError(reason.message));
    return () => {
      active = false;
    };
  }, [refresh]);

  // Der Server meldet, wenn eine KI-Aktion an diesem Prozess etwas geändert hat.
  useProcessChanged(id, () => {
    refresh().catch(() => undefined);
  });

  useEffect(() => {
    if (!record || initializedId.current === record.id) return;
    initializedId.current = record.id;
    setAnswers(
      Object.fromEntries(
        record.mainAnswers.map((answer) => [answer.topicId, answer.text]),
      ),
    );
    setWorkCharacteristicSelections(
      Object.fromEntries(
        record.workCharacteristicAnswers.map((answer) => [
          answer.characteristicId,
          answer.selectedOptionIds,
        ]),
      ),
    );
    setSelectedUploadIds(record.selectedUploadIds);
  }, [record]);

  const operation = operations.find((item) => item.processId === id);
  const locked =
    busy || operation?.state === "queued" || operation?.state === "running";
  const progress = record ? stateIndex[record.state] : 1;
  const workCharacteristicDefinitions =
    record && "workCharacteristics" in record.configSnapshot
      ? record.configSnapshot.workCharacteristics
      : [];
  const hasCompletedValidation =
    record !== null &&
    (record.validationRuns.length > 0 ||
      record.state !== "capture_in_progress");

  function inputIsValid() {
    if (!record) return;
    const invalidIds = workCharacteristicDefinitions
      .filter(
        (definition) =>
          !(workCharacteristicSelections[definition.id] ?? []).length,
      )
      .map((definition) => definition.id);
    if (invalidIds.length) {
      setInvalidCharacteristicIds(new Set(invalidIds));
      setError("Bitte beantworten Sie alle vier Arbeitsmerkmale.");
      requestAnimationFrame(() => {
        document
          .querySelector<HTMLElement>(
            `[data-work-characteristic-id="${invalidIds[0]}"]`,
          )
          ?.focus();
      });
      return false;
    }
    setInvalidCharacteristicIds(new Set());
    return true;
  }

  async function saveCurrentAnswers() {
    if (!record) throw new Error("Prozess nicht geladen.");
    return api.saveAnswers(
      record.id,
      makeTopicAnswers(record.configSnapshot, answers, record.mainAnswers),
      makeWorkCharacteristicAnswers(
        record.configSnapshot,
        workCharacteristicSelections,
        record.workCharacteristicAnswers,
      ),
      selectedUploadIds,
    );
  }

  async function submitMainAnswers(event: FormEvent) {
    event.preventDefault();
    if (!record || !inputIsValid()) return;
    setBusy(true);
    setError("");
    try {
      await saveCurrentAnswers();
      await api.analyze(record.id);
      await refresh();
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function synthesize() {
    if (!record || !inputIsValid()) return;
    setBusy(true);
    setError("");
    try {
      await saveCurrentAnswers();
      await api.synthesize(record.id);
      await refresh();
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function retry() {
    if (!record || !operation) return;
    if (!inputIsValid()) return;
    setBusy(true);
    setError("");
    try {
      await api.cancelOperation(operation.operationId);
      if (operation.operationName === "process-follow-ups") {
        await saveCurrentAnswers();
        await api.analyze(record.id);
      } else {
        await saveCurrentAnswers();
        await api.synthesize(record.id);
      }
      await refresh();
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!record)
    return (
      <section className="narrow-page">
        <p>{error || "Prozess wird geladen …"}</p>
      </section>
    );

  return (
    <section className="capture-page">
      <Link className="back-link" to={`/processes/${id}`}>
        <ArrowLeft /> Zum Prozess
      </Link>
      <div className="capture-heading">
        <Kicker>Seite 2 von 2 · {record.id}</Kicker>
        <div className="capture-title-row">
          <h1>{record.cover.processName}</h1>
          <CaptureProgress current={progress} />
        </div>
        <p>
          {record.cover.department} · eingereicht von{" "}
          {record.cover.participantName}
        </p>
      </div>

      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {operation && (
        <OperationPanel operation={operation} onRetry={retry} disabled={busy} />
      )}

      {[
        "capture_in_progress",
        "follow_up_required",
        "synthesis_ready",
      ].includes(record.state) && (
        <form onSubmit={submitMainAnswers} className="capture-form">
          <Card className="intro-panel">
            <Kicker>Angaben erfassen und prüfen</Kicker>
            <h2>
              {hasCompletedValidation
                ? "Prüfen und ergänzen Sie Ihre Angaben direkt im Formular."
                : "Teilen Sie Ihr Fachwissen in fünf Themenblöcken."}
            </h2>
            <p>
              {hasCompletedValidation
                ? "Die Rückmeldungen rechts sind Hinweise. Ändern Sie bei Bedarf den zugehörigen Text links und starten Sie die Prüfung ausdrücklich erneut – oder fahren Sie mit dem aktuellen Stand fort."
                : "Antworten Sie in Ihren eigenen Worten und gern in Stichpunkten. Auf Basis Ihrer Angaben werden höchstens fünf gezielte Rückfragen gestellt."}
            </p>
          </Card>
          <fieldset className="validation-inputs" disabled={locked}>
            <legend className="sr-only">Fachliche Prozessangaben</legend>
            <div className="topic-list">
              {[...record.configSnapshot.topics]
                .sort((a, b) => a.displayOrder - b.displayOrder)
                .map((topic) => {
                  const question = record.followUps.find(
                    (item) => item.topicId === topic.id,
                  );
                  return (
                    <div className="validation-row" key={topic.id}>
                      <ProcessTopicCard
                        topic={topic}
                        value={answers[topic.id] ?? ""}
                        disabled={locked}
                        validationCommentId={`validation-comment-${topic.id}`}
                        onChange={(value) =>
                          setAnswers((current) => ({
                            ...current,
                            [topic.id]: value,
                          }))
                        }
                        characteristics={workCharacteristicDefinitions.filter(
                          (definition) => definition.topicId === topic.id,
                        )}
                        selections={workCharacteristicSelections}
                        invalidCharacteristicIds={invalidCharacteristicIds}
                        onSelectionChange={(
                          characteristicId,
                          selectedOptionIds,
                        ) => {
                          setWorkCharacteristicSelections((current) => ({
                            ...current,
                            [characteristicId]: selectedOptionIds,
                          }));
                          if (selectedOptionIds.length)
                            setInvalidCharacteristicIds((current) => {
                              const next = new Set(current);
                              next.delete(characteristicId);
                              return next;
                            });
                        }}
                      />
                      <ProcessValidationComment
                        id={`validation-comment-${topic.id}`}
                        question={question}
                        hasValidation={hasCompletedValidation}
                      />
                    </div>
                  );
                })}
            </div>
          </fieldset>
          <ProcessUploadPicker
            processId={record.id}
            uploads={record.uploads}
            selectedIds={selectedUploadIds}
            disabled={locked}
            onUploadsChange={(uploads) => setRecord({ ...record, uploads })}
            onSelectionChange={setSelectedUploadIds}
            onError={setError}
          />
          <div className="submit-bar">
            <div>
              <b>
                {hasCompletedValidation
                  ? record.followUps.length
                    ? `${record.followUps.length} offene Rückfragen`
                    : "Alle Angaben geprüft"
                  : "Nächster Schritt"}
              </b>
              <span>
                {hasCompletedValidation
                  ? "Sie entscheiden, ob Sie erneut prüfen oder mit dem aktuellen Stand fortfahren."
                  : "Nur materielle Verständnislücken führen zu einer Rückfrage."}
              </span>
            </div>
            <div className="validation-actions">
              <Button
                type="submit"
                variant={hasCompletedValidation ? "secondary" : "primary"}
                disabled={
                  locked ||
                  record.configSnapshot.topics.some(
                    (topic) => !(answers[topic.id] ?? "").trim(),
                  ) ||
                  workCharacteristicDefinitions.some(
                    (definition) =>
                      !(workCharacteristicSelections[definition.id] ?? [])
                        .length,
                  )
                }
              >
                {busy
                  ? "Wird gestartet …"
                  : hasCompletedValidation
                    ? "Erneut prüfen"
                    : "Angaben prüfen lassen"}
              </Button>
              {hasCompletedValidation && (
                <Button
                  type="button"
                  variant="primary"
                  disabled={locked}
                  onClick={() => void synthesize()}
                >
                  {record.followUps.length
                    ? "Trotz offener Rückfragen fortfahren"
                    : "Mit Prozessbild fortfahren"}
                </Button>
              )}
            </div>
          </div>
        </form>
      )}

      {(record.state === "review_required" || record.state === "confirmed") &&
        record.understanding && (
          <ProcessBrief
            processId={record.id}
            understanding={record.understanding}
            uploads={record.uploads}
            confirmed={record.state === "confirmed"}
            saving={busy}
            onSave={async (understanding, note) => {
              setBusy(true);
              setError("");
              try {
                setRecord(
                  await api.correct(record.id, "flow", understanding, note),
                );
              } catch (reason) {
                setError((reason as Error).message);
                throw reason;
              } finally {
                setBusy(false);
              }
            }}
            onConfirm={async () => {
              setBusy(true);
              setError("");
              try {
                setRecord(await api.confirm(record.id));
              } catch (reason) {
                setError((reason as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          />
        )}
    </section>
  );
}

function CaptureProgress({ current }: { current: number }) {
  const labels = ["Beschreiben", "Ergänzen", "Prüfen", "Bestätigt"];
  return (
    <ol
      className="capture-progress"
      aria-label={`Fortschritt: Schritt ${current} von 4`}
    >
      {labels.map((label, index) => {
        const step = index + 1;
        const state =
          step === current ? "current" : step < current ? "completed" : "";
        return (
          <li
            className={state}
            key={label}
            aria-current={step === current ? "step" : undefined}
          >
            <span>{index + 1}</span>
            <small>{label}</small>
          </li>
        );
      })}
    </ol>
  );
}

function OperationPanel({
  operation,
  onRetry,
  disabled,
}: {
  operation: ProcessOperationStatus;
  onRetry: () => Promise<void>;
  disabled: boolean;
}) {
  if (operation.state === "failed")
    return (
      <Card as="section" className="operation-panel failed" role="alert">
        <AlertTriangle />
        <div>
          <b>Die Verarbeitung konnte nicht abgeschlossen werden.</b>
          <p>{operation.error}</p>
        </div>
        <Button
          variant="primary"
          disabled={disabled}
          onClick={() => void onRetry()}
        >
          <RefreshCw /> Erneut versuchen
        </Button>
      </Card>
    );
  const label =
    operation.operationName === "process-follow-ups"
      ? "Ihre Angaben werden auf Verständnislücken geprüft."
      : "Ihr Prozessbild wird erstellt.";
  return (
    <Card as="section" className="operation-panel" aria-live="polite">
      <LoaderCircle className="spin" />
      <div>
        <b>{label}</b>
        <p>
          {operation.state === "queued"
            ? `Die Aktion wartet${operation.position > 0 ? ` an Position ${operation.position}` : ""}. Sie können die Seite verlassen und später zurückkehren.`
            : "Die Verarbeitung läuft. Ihre Angaben bleiben auch bei einem Seitenwechsel gespeichert."}
        </p>
      </div>
    </Card>
  );
}
