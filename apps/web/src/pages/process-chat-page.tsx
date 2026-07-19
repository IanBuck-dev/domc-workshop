import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import Markdown from "react-markdown";
import {
  ArrowLeft,
  CheckCircle2,
  FileUp,
  LoaderCircle,
  Paperclip,
  Send,
  Square,
} from "lucide-react";
import type {
  DiscoveryTurn,
  ProcessRecord,
} from "../../../../packages/domain/src/schemas";
import { interviewQuestionCount } from "../../../../packages/domain/src/discovery";
import { api } from "../lib/api-client";

type DiscoveryMessage = UIMessage<unknown, { extraction: DiscoveryTurn }>;

function Interview({ initial }: { initial: ProcessRecord }) {
  const [record, setRecord] = useState(initial);
  const [input, setInput] = useState("");
  const [department, setDepartment] = useState(
    initial.extraction.department === "Noch offen"
      ? ""
      : initial.extraction.department,
  );
  const [departments, setDepartments] = useState<string[]>([]);
  const [maxQuestions, setMaxQuestions] = useState(8);
  const [departmentBusy, setDepartmentBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState("");
  const navigate = useNavigate();
  useEffect(() => {
    api.settings().then((settings) => {
      setDepartments(settings.discovery.departments);
      setMaxQuestions(settings.discovery.maxQuestions);
    });
  }, []);
  const initialMessages: DiscoveryMessage[] = initial.transcript.map(
    (turn, index) => ({
      id: `stored-${index}`,
      role: turn.role,
      parts: [{ type: "text", text: turn.text }],
    }),
  );
  const { messages, sendMessage, status, error, stop, regenerate } =
    useChat<DiscoveryMessage>({
      id: initial.metadata.id,
      messages: initialMessages,
      transport: new DefaultChatTransport({
        api: `/api/processes/${initial.metadata.id}/chat`,
      }),
      onData: (part) => {
        if (part.type === "data-extraction") {
          setRecord((current) => ({
            ...current,
            extraction: {
              ...current.extraction,
              ...part.data.extractionDelta,
              openQuestions: part.data.openPoints,
            },
            metadata: {
              ...current.metadata,
              interviewComplete: part.data.interviewComplete,
            },
          }));
        }
      },
      onFinish: async () => setRecord(await api.process(initial.metadata.id)),
    });
  const active = status === "submitted" || status === "streaming";
  const locked = record.metadata.state !== "Interview läuft";
  const interviewEnded = locked || record.metadata.interviewComplete;
  const questionsAsked = interviewQuestionCount(record.transcript);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text || active || interviewEnded) return;
    setInput("");
    setNotice("");
    await sendMessage({ text });
  }

  async function upload(file?: File) {
    if (!file) return;
    setUploading(true);
    setNotice("");
    try {
      const name = await api.uploadProcessFile(record.metadata.id, file);
      setRecord(await api.process(record.metadata.id));
      setNotice(
        `${name} wurde lokal gespeichert und wird jetzt berücksichtigt.`,
      );
      await sendMessage({
        text: `Der Nutzer hat Datei ${name} in uploads/ bereitgestellt.`,
      });
    } catch (value) {
      setNotice((value as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function finish() {
    const updated = await api.finishProcess(record.metadata.id);
    navigate(`/processes/${updated.metadata.id}`);
  }

  async function saveDepartment() {
    const value = department.trim();
    if (!value || value === record.extraction.department || departmentBusy)
      return;
    setDepartmentBusy(true);
    setNotice("");
    try {
      setRecord(await api.updateProcessDepartment(record.metadata.id, value));
      setDepartment(value);
      setNotice("Fachbereich gespeichert.");
    } catch (value) {
      setNotice((value as Error).message);
    } finally {
      setDepartmentBusy(false);
    }
  }

  return (
    <section className="interview-page">
      <button className="back" onClick={() => navigate("/processes")}>
        <ArrowLeft /> Zur Prozess-Übersicht
      </button>
      <div className="interview-head">
        <div>
          <span className="kicker">{record.metadata.id}</span>
          <h1>Prozess gemeinsam aufnehmen</h1>
          <p>
            Antworten Sie so, wie Sie die Arbeit einer Kollegin oder einem
            Kollegen erklären würden.
          </p>
        </div>
        <div className="interview-context">
          <label className="department-combobox" htmlFor="process-department">
            <span>Fachbereich</span>
            <input
              id="process-department"
              name="process-department"
              type="search"
              list="process-departments"
              value={department}
              placeholder="Suchen oder eingeben …"
              autoComplete="off"
              disabled={departmentBusy || active || locked}
              onChange={(event) => {
                setDepartment(event.target.value);
              }}
              onBlur={() => void saveDepartment()}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  event.currentTarget.blur();
                }
              }}
            />
            <datalist id="process-departments">
              {departments.map((value) => (
                <option value={value} key={value} />
              ))}
            </datalist>
          </label>
          <span className="state">{record.metadata.state}</span>
        </div>
      </div>
      <div className="interview-layout">
        <div className="chat-panel">
          <div className="chat-messages" aria-live="polite">
            {messages.map((message) => (
              <article
                className={`chat-message ${message.role}`}
                key={message.id}
              >
                <small>
                  {message.role === "user" ? "Sie" : "Prozessbegleitung"}
                </small>
                {message.parts.map((part, index) =>
                  part.type === "text" ? (
                    message.role === "assistant" ? (
                      <Markdown key={index}>{part.text}</Markdown>
                    ) : (
                      <p key={index}>{part.text}</p>
                    )
                  ) : null,
                )}
              </article>
            ))}
            {active && (
              <div className="chat-working">
                <LoaderCircle /> Die Antwort wird vorbereitet …
              </div>
            )}
          </div>
          {error && (
            <div className="chat-error">
              <p>{error.message}</p>
              <button onClick={() => regenerate()}>Erneut versuchen</button>
            </div>
          )}
          {notice && <p className="notice">{notice}</p>}
          <form className="chat-compose" onSubmit={submit}>
            <textarea
              id="discovery-answer"
              name="discovery-answer"
              aria-label="Ihre Antwort"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              rows={3}
              placeholder={
                record.metadata.interviewComplete
                  ? "Die Erstaufnahme ist abgeschlossen."
                  : "Beschreiben Sie den nächsten Punkt …"
              }
              disabled={active || interviewEnded}
            />
            <div>
              <label className="attach-button">
                <Paperclip />{" "}
                {uploading ? "Wird gespeichert …" : "Datei anhängen"}
                <input
                  id="discovery-upload"
                  name="discovery-upload"
                  type="file"
                  accept=".pdf,.xlsx,.csv,.docx,.txt,.md,.png,.jpg,.jpeg"
                  disabled={active || uploading || interviewEnded}
                  onChange={(event) => void upload(event.target.files?.[0])}
                />
              </label>
              {active ? (
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => stop()}
                >
                  <Square /> Stoppen
                </button>
              ) : (
                <button
                  className="button"
                  type="submit"
                  disabled={!input.trim() || interviewEnded}
                >
                  <Send /> Senden
                </button>
              )}
            </div>
          </form>
        </div>
        <aside className="understood-panel">
          <span className="kicker">LIVE-ZUSAMMENFASSUNG</span>
          <h2>Was wir bereits verstanden haben</h2>
          <dl>
            <div>
              <dt>Prozess</dt>
              <dd>{record.extraction.processName}</dd>
            </div>
            <div>
              <dt>Fachbereich</dt>
              <dd>{record.extraction.department}</dd>
            </div>
            <div>
              <dt>Auslöser</dt>
              <dd>{record.extraction.trigger}</dd>
            </div>
            <div>
              <dt>Häufigkeit</dt>
              <dd>{record.extraction.frequency}</dd>
            </div>
          </dl>
          <section>
            <h3>Schmerzpunkte</h3>
            {record.extraction.painPoints.length ? (
              <ul>
                {record.extraction.painPoints.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <p>Noch nicht beschrieben</p>
            )}
          </section>
          <section>
            <h3>Erfasste Schritte</h3>
            <b className="big-number">{record.extraction.steps.length}</b>
          </section>
          {record.uploads.length > 0 && (
            <section>
              <h3>
                <FileUp /> Dateien
              </h3>
              <ul>
                {record.uploads.map((file) => (
                  <li key={file.name}>{file.name}</li>
                ))}
              </ul>
            </section>
          )}
          <div
            className={`completion-note ${record.metadata.interviewComplete ? "complete" : ""}`}
          >
            {record.metadata.interviewComplete ? (
              <CheckCircle2 />
            ) : (
              <LoaderCircle />
            )}
            <span>
              <b>
                {record.metadata.interviewComplete
                  ? "Aufnahme vollständig"
                  : "Wir klären noch Details"}
              </b>
              <small>
                {record.metadata.interviewComplete
                  ? "Sie können das Interview abschließen."
                  : `${questionsAsked} von ${maxQuestions} Fragen · ${record.extraction.openQuestions.length} offene Punkte`}
              </small>
            </span>
          </div>
          <button
            className="button full"
            disabled={!record.metadata.interviewComplete || active || locked}
            onClick={finish}
          >
            {locked ? "Interview abgeschlossen" : "Interview abschließen"}
          </button>
        </aside>
      </div>
    </section>
  );
}

export function ProcessChatPage() {
  const { id } = useParams();
  const [record, setRecord] = useState<ProcessRecord | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (id)
      api
        .process(id)
        .then(setRecord)
        .catch((value: Error) => setError(value.message));
  }, [id]);
  if (error) return <p className="notice error">{error}</p>;
  return record ? <Interview initial={record} /> : <p>Lädt …</p>;
}
