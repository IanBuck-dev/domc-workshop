import {
  AlertTriangle,
  ArrowLeft,
  Check,
  LoaderCircle,
  RefreshCw,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ProcessBrief } from "../components/process-brief";
import { ProcessFollowUpCard } from "../components/process-follow-up-card";
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
  const [operations, setOperations] = useState<ProcessOperationStatus[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [workCharacteristicSelections, setWorkCharacteristicSelections] =
    useState<Record<string, string[]>>({});
  const [followUpAnswers, setFollowUpAnswers] = useState<
    Record<string, string>
  >({});
  const [selectedUploadIds, setSelectedUploadIds] = useState<string[]>([]);
  const [invalidCharacteristicIds, setInvalidCharacteristicIds] = useState<
    Set<string>
  >(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const initializedId = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    const [nextRecord, nextOperations] = await Promise.all([
      api.process(id),
      api.operations(),
    ]);
    setRecord(nextRecord);
    setOperations(nextOperations);
    return nextRecord;
  }, [id]);

  useEffect(() => {
    let active = true;
    refresh().catch((reason: Error) => active && setError(reason.message));
    const interval = window.setInterval(() => {
      refresh().catch(() => undefined);
    }, 1500);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [refresh]);

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
    setFollowUpAnswers(
      Object.fromEntries(
        record.followUpAnswers.map((answer) => [
          answer.questionId,
          answer.text,
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

  async function submitMainAnswers(event: FormEvent) {
    event.preventDefault();
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
      return;
    }
    setInvalidCharacteristicIds(new Set());
    setBusy(true);
    setError("");
    try {
      await api.saveAnswers(
        record.id,
        makeTopicAnswers(record.configSnapshot, answers),
        makeWorkCharacteristicAnswers(
          record.configSnapshot,
          workCharacteristicSelections,
        ),
        selectedUploadIds,
      );
      await api.analyze(record.id);
      await refresh();
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function submitFollowUps(event: FormEvent) {
    event.preventDefault();
    if (!record) return;
    setBusy(true);
    setError("");
    try {
      const answeredAt = new Date().toISOString();
      await api.saveFollowUps(
        record.id,
        record.followUps.map((question) => ({
          questionId: question.id,
          topicId: question.topicId,
          text: followUpAnswers[question.id] ?? "",
          answeredAt,
        })),
      );
      await api.synthesize(record.id);
      await refresh();
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function synthesize() {
    if (!record) return;
    setBusy(true);
    setError("");
    try {
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
    setBusy(true);
    setError("");
    try {
      await api.cancelOperation(operation.operationId);
      if (operation.operationName === "process-follow-ups")
        await api.analyze(record.id);
      else await api.synthesize(record.id);
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
        <div>
          <Kicker>Seite 2 von 2 · {record.id}</Kicker>
          <h1>{record.cover.processName}</h1>
          <p>
            {record.cover.department} · eingereicht von{" "}
            {record.cover.participantName}
          </p>
        </div>
        <CaptureProgress current={progress} />
      </div>

      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {operation && (
        <OperationPanel operation={operation} onRetry={retry} disabled={busy} />
      )}

      {record.state === "capture_in_progress" && !operation && (
        <form onSubmit={submitMainAnswers} className="capture-form">
          <Card className="intro-panel">
            <Kicker>Heutigen Normalfall beschreiben</Kicker>
            <h2>Teilen Sie Ihr Fachwissen in fünf Themenblöcken.</h2>
            <p>
              Antworten Sie in Ihren eigenen Worten und gern in Stichpunkten.
              Technische Details sind nicht erforderlich. Auf Basis Ihrer
              Angaben werden höchstens fünf gezielte Rückfragen gestellt.
            </p>
          </Card>
          <div className="topic-list">
            {[...record.configSnapshot.topics]
              .sort((a, b) => a.displayOrder - b.displayOrder)
              .map((topic) => (
                <ProcessTopicCard
                  key={topic.id}
                  topic={topic}
                  value={answers[topic.id] ?? ""}
                  onChange={(value) =>
                    setAnswers((current) => ({ ...current, [topic.id]: value }))
                  }
                  characteristics={workCharacteristicDefinitions.filter(
                    (definition) => definition.topicId === topic.id,
                  )}
                  selections={workCharacteristicSelections}
                  invalidCharacteristicIds={invalidCharacteristicIds}
                  onSelectionChange={(characteristicId, selectedOptionIds) => {
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
              ))}
          </div>
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
              <b>Nächster Schritt</b>
              <span>
                Ihre Angaben werden geordnet; nur materielle Lücken führen zu
                einer Rückfrage.
              </span>
            </div>
            <Button
              variant="primary"
              disabled={
                locked ||
                record.configSnapshot.topics.some(
                  (topic) => !(answers[topic.id] ?? "").trim(),
                ) ||
                workCharacteristicDefinitions.some(
                  (definition) =>
                    !(workCharacteristicSelections[definition.id] ?? []).length,
                )
              }
            >
              {busy ? "Wird gestartet …" : "Angaben prüfen lassen"}
            </Button>
          </div>
        </form>
      )}

      {record.state === "follow_up_required" && !operation && (
        <form className="follow-up-stage" onSubmit={submitFollowUps}>
          <Card className="intro-panel">
            <Kicker>Gezielte Ergänzung</Kicker>
            <h2>
              {record.followUps.length === 1
                ? "Eine Rückfrage ist offen."
                : `${record.followUps.length} Rückfragen sind offen.`}
            </h2>
            <p>
              Diese Angaben helfen, den Prozess vollständig und ohne unnötige
              technische Fragen abzubilden. Danach gibt es keine weitere
              Rückfragerunde.
            </p>
          </Card>
          <div className="follow-up-list">
            {record.followUps.map((question) => (
              <ProcessFollowUpCard
                key={question.id}
                question={question}
                topicName={
                  record.configSnapshot.topics.find(
                    (topic) => topic.id === question.topicId,
                  )?.name ?? "Themenbereich"
                }
                value={followUpAnswers[question.id] ?? ""}
                onChange={(value) =>
                  setFollowUpAnswers((current) => ({
                    ...current,
                    [question.id]: value,
                  }))
                }
              />
            ))}
          </div>
          <div className="submit-bar">
            <div>
              <b>Danach entsteht Ihr Prozessbild.</b>
              <span>
                Der Steckbrief und die Prozesskarte werden gemeinsam erstellt.
              </span>
            </div>
            <Button
              variant="primary"
              disabled={
                locked ||
                record.followUps.some(
                  (question) => !(followUpAnswers[question.id] ?? "").trim(),
                )
              }
            >
              {busy
                ? "Wird gestartet …"
                : "Antworten senden und Prozessbild erstellen"}
            </Button>
          </div>
        </form>
      )}

      {record.state === "synthesis_ready" && !operation && (
        <Card as="section" className="center-stage">
          <Check />
          <Kicker>Angaben vollständig</Kicker>
          <h2>Das Prozessbild kann erstellt werden.</h2>
          <p>
            Aus Ihren Antworten und den ausgewählten Unterlagen entstehen ein
            kompakter Steckbrief und eine Prozesskarte mit fünf bis acht
            Hauptschritten.
          </p>
          <Button
            variant="primary"
            disabled={busy}
            onClick={() => void synthesize()}
          >
            {busy ? "Wird gestartet …" : "Prozessbild erstellen"}
          </Button>
        </Card>
      )}

      {(record.state === "review_required" || record.state === "confirmed") &&
        record.understanding && (
          <ProcessBrief
            processId={record.id}
            understanding={record.understanding}
            config={record.configSnapshot}
            workCharacteristicAnswers={record.workCharacteristicAnswers}
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
              } finally {
                setBusy(false);
              }
            }}
            onSaveWorkCharacteristics={async (answers, reason) => {
              setBusy(true);
              setError("");
              try {
                setRecord(
                  await api.correctWorkCharacteristics(
                    record.id,
                    answers,
                    reason,
                  ),
                );
              } catch (reason) {
                setError((reason as Error).message);
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
      {labels.map((label, index) => (
        <li className={index + 1 <= current ? "active" : ""} key={label}>
          <span>{index + 1}</span>
          <small>{label}</small>
        </li>
      ))}
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
