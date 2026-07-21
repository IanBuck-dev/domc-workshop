import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, CheckCircle2, Copy, Send } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { CriterionCard } from "../components/criterion-card";
import { CalculatedResultsPanel } from "../components/calculated-results-panel";
import { AssessmentUploadPicker } from "../components/assessment-upload-picker";
import { CriterionInput } from "../components/criterion-input";
import { CriteriaProgressSidebar } from "../components/criteria-progress-sidebar";
import { ReviewPanel } from "../components/review-panel";
import { GatewayEvidenceForm } from "../components/gateway-evidence-form";
import { api } from "../lib/api-client";
import type {
  AssessmentRecord,
  GatewayUserAnswer,
} from "../lib/assessment-types";

export function ChatAssessmentPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [a, setA] = useState<AssessmentRecord | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [discussing, setDiscussing] = useState<string | null>(null);
  const [followUp, setFollowUp] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [selectedUploadIds, setSelectedUploadIds] = useState<string[]>([]);
  useEffect(() => {
    Promise.all([api.assessment(id), api.assessmentChatHistory(id)])
      .then(([assessment, messages]) => {
        if (assessment.mode === "form") {
          navigate(
            `/assessments/${id}/${assessment.state === "gateway_in_progress" ? "gateway" : "form"}`,
            { replace: true },
          );
          return;
        }
        setA({ ...assessment, chat: { messages } });
        setSelectedUploadIds(assessment.gateway.selectedUploadIds);
        setFollowUp(
          [...messages]
            .reverse()
            .find(
              (message) =>
                message.role === "assistant" && !message.criterionDiscussion,
            )?.askFollowUp === true,
        );
      })
      .catch((e: Error) => setError(e.message));
  }, [id, navigate]);
  async function run(action: () => Promise<AssessmentRecord>) {
    setBusy(true);
    setError("");
    try {
      const result = await action();
      setA((current) => ({ ...result, chat: current?.chat ?? result.chat }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function submitGateway(answers: GatewayUserAnswer[]) {
    setBusy(true);
    setError("");
    try {
      const result = await api.evaluateGateway(id, answers, selectedUploadIds);
      setA((current) => ({ ...result, chat: current?.chat }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function prepareGateway() {
    setBusy(true);
    setError("");
    try {
      const result = await api.prepareGateway(id, selectedUploadIds);
      setA((current) => ({ ...result, chat: current?.chat }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function sendGatewayFollowUp(event: FormEvent) {
    event.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setError("");
    try {
      const result = await api.gatewayFollowUp(id, text);
      setA((current) => ({ ...result, chat: current?.chat }));
      setText("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function send(event: FormEvent) {
    event.preventDefault();
    if (!text.trim()) return;
    const message = text;
    setText("");
    setStreamingText("");
    setBusy(true);
    setError("");
    try {
      const result = await api.chat(
        id,
        message,
        discussing ?? undefined,
        selectedUploadIds,
        discussing ? false : followUp,
        (delta) => setStreamingText((current) => current + delta),
      );
      setA((current) => ({
        ...result,
        chat: {
          ...current?.chat,
          messages: [
            ...(current?.chat?.messages ?? []),
            {
              role: "user",
              content: message,
              sectionId: currentSectionId,
              criterionDiscussion: !!discussing,
            },
            ...(result.assistantMessage
              ? [
                  {
                    role: "assistant" as const,
                    content: result.assistantMessage,
                    sectionId: currentSectionId,
                    askFollowUp: result.askFollowUp,
                    criterionDiscussion: !!discussing,
                  },
                ]
              : []),
          ],
        },
      }));
      if (!discussing) setFollowUp(result.askFollowUp === true);
      setStreamingText("");
    } catch (e) {
      setError((e as Error).message);
      setStreamingText("");
    } finally {
      setBusy(false);
    }
    setDiscussing(null);
  }
  const proposed = useMemo(
    () =>
      a?.criteria.filter(
        (v) => v.source === "ai" && v.confirmation === "pending",
      ) ?? [],
    [a],
  );
  if (!a) return <p>{error || "Gespräch wird geladen …"}</p>;
  if (a.state === "submitted_without_clear_ai_signal")
    return (
      <section className="neutral-thanks panel">
        <CheckCircle2 />
        <h1>Vielen Dank.</h1>
        <p>Der Prozess wurde zur Bewertung eingereicht.</p>
      </section>
    );
  if (a.state === "gateway_in_progress")
    return (
      <section className="chat-page">
        <div className="assessment-heading">
          <div>
            <span className="kicker">GEFÜHRTES KI-GESPRÄCH</span>
            <h1>{a.cover.processName}</h1>
            <p>
              Zuerst entsteht ein gemeinsames fachliches Prozessverständnis.
            </p>
          </div>
        </div>
        <div className="chat-workspace gateway-chat-workspace">
          <aside className="chat-agenda panel">
            <h2>Fortschritt</h2>
            <ol>
              <li className="active">
                <span>1</span> Prozess verstehen
              </li>
              <li>
                <span>2</span> Bewertungsthemen
              </li>
              <li>
                <span>3</span> Ergebnis prüfen
              </li>
            </ol>
            <hr />
            <h3>Unterlagen</h3>
            <AssessmentUploadPicker
              uploads={a.uploads}
              selectedIds={selectedUploadIds}
              busy={busy}
              onToggle={(uploadId, selected) =>
                setSelectedUploadIds((current) =>
                  selected
                    ? [...new Set([...current, uploadId])]
                    : current.filter((value) => value !== uploadId),
                )
              }
              onUpload={(file) =>
                run(async () => {
                  const updated = await api.uploadAssessmentFile(id, file);
                  const added = updated.uploads.find(
                    (upload) =>
                      !a.uploads.some((prior) => prior.id === upload.id),
                  );
                  if (added)
                    setSelectedUploadIds((current) => [...current, added.id]);
                  return updated;
                })
              }
            />
          </aside>
          <div className="chat-center panel">
            <div className="chat-messages assessment-chat">
              {a.chat?.messages.map((message, index) => (
                <article
                  key={message.id ?? index}
                  className={`chat-message ${message.role}`}
                >
                  {message.content}
                </article>
              ))}
            </div>
            {!a.gateway.elicitation ? (
              <div className="gateway-chat-start">
                <h2>Gespräch vorbereiten</h2>
                <p>
                  Die Fragen werden auf „{a.cover.processName}“ und Ihre
                  freiwillige Beschreibung zugeschnitten. Ausgewählte Unterlagen
                  können dabei berücksichtigt werden.
                </p>
                <button
                  className="button"
                  disabled={busy}
                  onClick={prepareGateway}
                >
                  {busy ? "Fragen werden vorbereitet …" : "Gespräch beginnen"}
                  <ArrowRight />
                </button>
              </div>
            ) : a.gateway.followUpQuestion ? (
              <form
                className="gateway-chat-follow-up"
                onSubmit={sendGatewayFollowUp}
              >
                <article className="chat-message assistant">
                  {a.gateway.followUpQuestion}
                </article>
                <textarea
                  name="gateway-follow-up"
                  rows={5}
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  placeholder="Antworten Sie gern in Ihren eigenen Worten …"
                  required
                />
                <button className="button" disabled={busy || !text.trim()}>
                  {busy ? "Wird eingeordnet …" : "Antwort senden"}
                  <ArrowRight />
                </button>
              </form>
            ) : (
              <GatewayEvidenceForm
                assessment={a}
                busy={busy}
                mode="chat"
                onSubmit={submitGateway}
              />
            )}
            {error && <p className="notice error">{error}</p>}
          </div>
          <aside className="criteria-sidebar panel gateway-context-sidebar">
            <h2>Prozesskontext</h2>
            <dl>
              <dt>Fachbereich</dt>
              <dd>{a.cover.department}</dd>
              <dt>Prozess</dt>
              <dd>{a.cover.processName}</dd>
            </dl>
            {a.cover.currentProcessDescription && (
              <>
                <h3>Bisherige Beschreibung</h3>
                <p>{a.cover.currentProcessDescription}</p>
              </>
            )}
            <p className="notice">
              Vermutungen und Beispiele der KI zählen erst, wenn Sie diese
              ausdrücklich bestätigen.
            </p>
          </aside>
        </div>
      </section>
    );
  const byDefinition = new Map(a.configSnapshot.criteria.map((c) => [c.id, c]));
  const complete =
    a.criteria.length === a.configSnapshot.criteria.length &&
    a.criteria.every((v) => v.value !== null);
  const completedSectionIds = a.configSnapshot.chat.sections
    .filter((section) =>
      a.chat?.messages.some(
        (message) =>
          message.role === "assistant" &&
          message.sectionId === section.id &&
          message.askFollowUp === false &&
          !message.criterionDiscussion,
      ),
    )
    .map((section) => section.id);
  const currentSectionId = [...a.configSnapshot.chat.sections]
    .sort((left, right) => left.displayOrder - right.displayOrder)
    .find((section) => !completedSectionIds.includes(section.id))?.id;
  const currentSection = a.configSnapshot.chat.sections.find(
    (section) => section.id === currentSectionId,
  );
  return (
    <section className="chat-page">
      <div className="assessment-heading">
        <div>
          <span className="kicker">GEFÜHRTES KI-GESPRÄCH</span>
          <h1>{a.cover.processName}</h1>
          <p>{a.cover.department} · Änderungen bleiben jederzeit möglich.</p>
        </div>
        <button
          className="text-button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const copy = await api.duplicateAssessment(id);
              navigate(
                `/assessments/${copy.id}/${copy.mode === "form" ? "gateway" : "chat"}`,
              );
            } catch (e) {
              setError((e as Error).message);
              setBusy(false);
            }
          }}
        >
          <Copy /> Im anderen Modus vergleichen
        </button>
      </div>
      <div className="chat-workspace">
        <aside className="chat-agenda panel">
          <h2>Themen</h2>
          <ol>
            {[...a.configSnapshot.chat.sections]
              .sort((x, y) => x.displayOrder - y.displayOrder)
              .map((section, index) => (
                <li
                  className={
                    completedSectionIds.includes(section.id)
                      ? "done"
                      : currentSectionId === section.id
                        ? "active"
                        : ""
                  }
                  key={section.id}
                >
                  <span>
                    {completedSectionIds.includes(section.id) ? (
                      <Check />
                    ) : (
                      index + 1
                    )}
                  </span>
                  {section.name}
                </li>
              ))}
          </ol>
          <hr />
          <h3>Unterlagen</h3>
          <AssessmentUploadPicker
            uploads={a.uploads}
            selectedIds={selectedUploadIds}
            busy={busy}
            onToggle={(uploadId, selected) =>
              setSelectedUploadIds((current) =>
                selected
                  ? [...new Set([...current, uploadId])]
                  : current.filter((value) => value !== uploadId),
              )
            }
            onUpload={(file) =>
              run(async () => {
                const updated = await api.uploadAssessmentFile(id, file);
                const added = updated.uploads.find(
                  (upload) =>
                    !a.uploads.some((prior) => prior.id === upload.id),
                );
                if (added)
                  setSelectedUploadIds((current) => [...current, added.id]);
                return updated;
              })
            }
          />
        </aside>
        <div className="chat-center panel">
          {currentSection && !followUp && !discussing && (
            <div className="section-question" aria-live="polite">
              <span className="kicker">AKTUELLES THEMA</span>
              <b>{currentSection.name}</b>
              <p>{currentSection.mainQuestion}</p>
            </div>
          )}
          <div className="chat-messages assessment-chat">
            {a.chat?.messages.map((m, index) => (
              <article key={m.id ?? index} className={`chat-message ${m.role}`}>
                {m.content}
              </article>
            ))}
            {streamingText && (
              <article className="chat-message assistant" aria-live="polite">
                {streamingText}
              </article>
            )}
            {proposed.map((record) => {
              const definition = byDefinition.get(record.criterionId);
              return definition ? (
                <CriterionCard
                  key={record.criterionId}
                  definition={definition}
                  record={record}
                  onConfirm={() =>
                    run(() => api.confirmCriterion(id, record.criterionId))
                  }
                  onEdit={() => setEditing(record.criterionId)}
                  onDiscuss={() => setDiscussing(record.criterionId)}
                />
              ) : null;
            })}
          </div>
          {editing &&
            (() => {
              const d = byDefinition.get(editing),
                v = a.criteria.find((x) => x.criterionId === editing);
              return d && v ? (
                <div className="inline-editor">
                  <b>{d.name}</b>
                  <CriterionInput
                    definition={d}
                    record={v}
                    onChange={(value) =>
                      run(() => api.updateCriterion(id, editing, value)).then(
                        () => setEditing(null),
                      )
                    }
                  />
                  <button
                    className="text-button"
                    onClick={() => setEditing(null)}
                  >
                    Abbrechen
                  </button>
                </div>
              ) : null;
            })()}
          {discussing && (
            <p className="discussion-context">
              Sie besprechen: <b>{byDefinition.get(discussing)?.name}</b>{" "}
              <button onClick={() => setDiscussing(null)}>
                Auswahl aufheben
              </button>
            </p>
          )}
          <form className="chat-input" onSubmit={send}>
            <textarea
              name="chat-message"
              rows={3}
              disabled={!currentSectionId && !discussing}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={
                discussing
                  ? "Was möchten Sie zu diesem Kriterium klären?"
                  : "Beschreiben Sie den Prozess aus Ihrer fachlichen Sicht …"
              }
            />
            <button
              className="button"
              disabled={
                busy || !text.trim() || (!currentSectionId && !discussing)
              }
            >
              <Send />
              {busy ? "Wird verarbeitet …" : "Senden"}
            </button>
          </form>
        </div>
        <CriteriaProgressSidebar
          config={a.configSnapshot}
          values={a.criteria}
          onEdit={setEditing}
          onDiscuss={setDiscussing}
        />
      </div>
      {!complete &&
        completedSectionIds.length ===
          a.configSnapshot.chat.sections.length && (
          <p className="notice warning">
            Einige Kriterien sind noch offen. Tragen Sie diese rechts direkt ein
            oder wählen Sie „Mit KI besprechen“.
          </p>
        )}
      {complete && (
        <>
          <CalculatedResultsPanel assessment={a} />
          <ReviewPanel
            assessment={a}
            busy={busy}
            onReview={() =>
              run(() => api.reviewAssessment(id, selectedUploadIds))
            }
            onAcknowledge={(findingId) =>
              run(() => api.acknowledgeFinding(id, findingId))
            }
            onApplyCorrection={(criterionId, value) =>
              run(() => api.updateCriterion(id, criterionId, value))
            }
            onReviewMessage={async (message) =>
              (await api.reviewChat(id, message, selectedUploadIds)).message
            }
            onConfirm={() => run(() => api.confirmAssessment(id))}
          />
        </>
      )}{" "}
      {error && <p className="notice error">{error}</p>}
    </section>
  );
}
