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
      <section className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <p>{error || "Prozess wird geladen …"}</p>
      </section>
    );

  return (
    <section className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <Link
        className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
        to={`/processes/${id}`}
      >
        <ArrowLeft className="size-4" /> Zum Prozess
      </Link>
      <div className="space-y-3">
        <p className="text-sm font-bold uppercase tracking-[0.14em] text-primary">
          Seite 2 von 2 · {record.id}
        </p>
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
            {record.cover.processName}
          </h1>
          <CaptureProgress current={progress} />
        </div>
        <p className="text-muted-foreground">
          {record.cover.department} · eingereicht von{" "}
          {record.cover.participantName}
        </p>
      </div>

      {error && (
        <p
          className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm font-medium text-destructive"
          role="alert"
        >
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
        <form onSubmit={submitMainAnswers} className="space-y-5">
          <Card className="gap-3 p-5 sm:p-6">
            <p className="text-sm font-bold uppercase tracking-[0.14em] text-primary">
              Angaben erfassen und prüfen
            </p>
            <h2 className="text-xl font-semibold">
              {hasCompletedValidation
                ? "Prüfen und ergänzen Sie Ihre Angaben direkt im Formular."
                : "Teilen Sie Ihr Fachwissen in fünf Themenblöcken."}
            </h2>
            <p className="leading-6 text-muted-foreground">
              {hasCompletedValidation
                ? "Die Rückmeldungen rechts sind Hinweise. Ändern Sie bei Bedarf den zugehörigen Text links und starten Sie die Prüfung ausdrücklich erneut – oder fahren Sie mit dem aktuellen Stand fort."
                : "Antworten Sie in Ihren eigenen Worten und gern in Stichpunkten. Auf Basis Ihrer Angaben werden höchstens fünf gezielte Rückfragen gestellt."}
            </p>
          </Card>
          <fieldset
            className="min-w-0 border-0 p-0 disabled:opacity-70"
            disabled={locked}
          >
            <legend className="sr-only">Fachliche Prozessangaben</legend>
            <div className="grid gap-4">
              {[...record.configSnapshot.topics]
                .sort((a, b) => a.displayOrder - b.displayOrder)
                .map((topic) => {
                  const question = record.followUps.find(
                    (item) => item.topicId === topic.id,
                  );
                  return (
                    <div
                      className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]"
                      key={topic.id}
                    >
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
          <Card className="gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="space-y-1">
              <b>
                {hasCompletedValidation
                  ? record.followUps.length
                    ? `${record.followUps.length} offene Rückfragen`
                    : "Alle Angaben geprüft"
                  : "Nächster Schritt"}
              </b>
              <span className="block text-sm leading-5 text-muted-foreground">
                {hasCompletedValidation
                  ? "Sie entscheiden, ob Sie erneut prüfen oder mit dem aktuellen Stand fortfahren."
                  : "Nur materielle Verständnislücken führen zu einer Rückfrage."}
              </span>
            </div>
            <div className="flex flex-wrap gap-3">
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
          </Card>
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
      className="flex min-w-[22rem] list-none justify-between p-0 xl:w-[28rem]"
      aria-label={`Fortschritt: Schritt ${current} von 4`}
    >
      {labels.map((label, index) => {
        const step = index + 1;
        const state =
          step === current ? "current" : step < current ? "completed" : "";
        return (
          <li
            className={`relative flex flex-1 flex-col items-center gap-1 text-sm text-muted-foreground before:absolute before:right-1/2 before:top-4 before:-z-0 before:h-px before:w-full before:bg-border first:before:hidden ${state ? "text-primary" : ""}`}
            key={label}
            aria-current={step === current ? "step" : undefined}
          >
            <span
              className={`z-10 grid size-8 place-items-center rounded-full border-2 border-border bg-background text-xs font-bold ${state === "current" ? "border-primary bg-primary text-primary-foreground" : state === "completed" ? "border-primary text-primary" : ""}`}
            >
              {index + 1}
            </span>
            <small className="z-10 bg-background px-1 text-center">
              {label}
            </small>
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
      <Card
        as="section"
        className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 border-destructive/30 bg-destructive/5 p-4"
        role="alert"
      >
        <AlertTriangle className="size-5 text-destructive" />
        <div className="space-y-1">
          <b>Die Verarbeitung konnte nicht abgeschlossen werden.</b>
          <p className="text-sm text-muted-foreground">{operation.error}</p>
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
    <Card
      as="section"
      className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-4 p-4"
      aria-live="polite"
    >
      <LoaderCircle className="size-5 animate-spin text-primary" />
      <div className="space-y-1">
        <b>{label}</b>
        <p className="text-sm leading-5 text-muted-foreground">
          {operation.state === "queued"
            ? `Die Aktion wartet${operation.position > 0 ? ` an Position ${operation.position}` : ""}. Sie können die Seite verlassen und später zurückkehren.`
            : "Die Verarbeitung läuft. Ihre Angaben bleiben auch bei einem Seitenwechsel gespeichert."}
        </p>
      </div>
    </Card>
  );
}
