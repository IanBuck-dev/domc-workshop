import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { GatewayEvidenceForm } from "../components/gateway-evidence-form";
import { api } from "../lib/api-client";
import type {
  AssessmentRecord,
  GatewayUserAnswer,
} from "../lib/assessment-types";

export function GatewayPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [assessment, setAssessment] = useState<AssessmentRecord | null>(null);
  const [followUp, setFollowUp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    api
      .assessment(id)
      .then((record) => {
        if (record.mode === "chat") {
          navigate(`/assessments/${id}/chat`, { replace: true });
          return;
        }
        setAssessment(record);
        if (
          record.gateway?.final &&
          record.state !== "submitted_without_clear_ai_signal"
        )
          navigate(
            `/assessments/${id}/${record.mode === "form" ? "form" : "chat"}`,
            { replace: true },
          );
      })
      .catch((e: Error) => setError(e.message));
  }, [id, navigate]);
  function continueFor(record: AssessmentRecord) {
    setAssessment(record);
    if (record.state === "submitted_without_clear_ai_signal") return;
    if (record.gateway?.followUpQuestion && !record.gateway.final) return;
    if (record.state !== "gateway_in_progress")
      navigate(
        `/assessments/${id}/${record.mode === "form" ? "form" : "chat"}`,
      );
  }
  async function submit(answers: GatewayUserAnswer[]) {
    setBusy(true);
    setError("");
    try {
      continueFor(await api.evaluateGateway(id, answers));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function sendFollowUp(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      continueFor(await api.gatewayFollowUp(id, followUp));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!assessment) return <p>{error || "Bewertung wird geladen …"}</p>;
  if (assessment.state === "submitted_without_clear_ai_signal")
    return (
      <section className="neutral-thanks panel">
        <CheckCircle2 />
        <h1>Vielen Dank.</h1>
        <p>Der Prozess wurde zur Bewertung eingereicht.</p>
      </section>
    );
  if (assessment.gateway?.followUpQuestion && !assessment.gateway.final)
    return (
      <section className="gateway-page">
        <div className="page-title">
          <div>
            <span className="kicker">SEITE 2 VON 3</span>
            <h1>Eine kurze Rückfrage</h1>
            <p>Diese Ergänzung hilft, Ihre Angaben besser einzuordnen.</p>
          </div>
        </div>
        <form className="panel follow-up" onSubmit={sendFollowUp}>
          <h2>{assessment.gateway.followUpQuestion}</h2>
          <textarea
            name="gateway-follow-up"
            rows={5}
            value={followUp}
            onChange={(e) => setFollowUp(e.target.value)}
            required
          />
          {error && <p className="notice error">{error}</p>}
          <button className="button" disabled={busy}>
            {busy ? "Wird geprüft …" : "Antwort senden"}
            <ArrowRight />
          </button>
        </form>
      </section>
    );
  return (
    <section className="gateway-page">
      <div className="page-title">
        <div>
          <span className="kicker">SEITE 2 VON 3</span>
          <h1>Vier Fragen zum Prozess</h1>
          <p>Bitte beantworten Sie alle Fragen aus Ihrer fachlichen Sicht.</p>
        </div>
      </div>
      <GatewayEvidenceForm
        assessment={assessment}
        busy={busy}
        mode="form"
        onSubmit={submit}
      />
      {error && <p className="notice error">{error}</p>}
    </section>
  );
}
