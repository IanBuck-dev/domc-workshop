import { useEffect, useState } from "react";
import { Copy, Sparkles } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { CriterionTable } from "../components/criterion-table";
import { CalculatedResultsPanel } from "../components/calculated-results-panel";
import { AssessmentUploadPicker } from "../components/assessment-upload-picker";
import { ReviewPanel } from "../components/review-panel";
import { api } from "../lib/api-client";
import type { AssessmentRecord } from "../lib/assessment-types";

export function FormAssessmentPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [a, setA] = useState<AssessmentRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selectedUploadIds, setSelectedUploadIds] = useState<string[]>([]);
  useEffect(() => {
    api
      .assessment(id)
      .then((assessment) => {
        if (assessment.mode === "chat") {
          navigate(`/assessments/${id}/chat`, { replace: true });
          return;
        }
        if (assessment.state === "gateway_in_progress") {
          navigate(`/assessments/${id}/gateway`, { replace: true });
          return;
        }
        setA(assessment);
      })
      .catch((e: Error) => setError(e.message));
  }, [id, navigate]);
  async function run(action: () => Promise<AssessmentRecord>) {
    setBusy(true);
    setError("");
    try {
      setA(await action());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function duplicate() {
    setBusy(true);
    setError("");
    try {
      const copy = await api.duplicateAssessment(id);
      navigate(
        `/assessments/${copy.id}/${copy.mode === "form" ? "gateway" : "chat"}`,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!a) return <p>{error || "Bewertung wird geladen …"}</p>;
  const complete =
    a.criteria.length === a.configSnapshot.criteria.length &&
    a.criteria.every((v) => v.confirmation === "confirmed");
  return (
    <section>
      <div className="assessment-heading">
        <div>
          <span className="kicker">SEITE 3 VON 3 · FORMULAR</span>
          <h1>{a.cover.processName}</h1>
          <p>
            {a.cover.department} · Eingereicht von {a.cover.participantName}
          </p>
        </div>
        <button className="text-button" onClick={duplicate}>
          <Copy />
          Im anderen Modus vergleichen
        </button>
      </div>
      <div className="notice info">
        <Sparkles />
        <span>
          <b>KI-Vorschläge sind gekennzeichnet.</b> Bitte bestätigen oder ändern
          Sie jeden Vorschlag einzeln.
        </span>
        <button
          className="small-button"
          disabled={busy}
          onClick={() => run(() => api.prefillForm(id))}
        >
          Vorschläge erstellen
        </button>
      </div>
      <CriterionTable
        config={a.configSnapshot}
        values={a.criteria}
        busy={busy}
        onChange={(criterionId, value) =>
          run(() => api.updateCriterion(id, criterionId, value))
        }
        onConfirm={(criterionId) =>
          run(() => api.confirmCriterion(id, criterionId))
        }
      />
      <section className="panel form-uploads">
        <h2>Unterlagen für die Prüfung</h2>
        <p>
          Hochgeladene Dateien werden nur verwendet, wenn Sie sie ausdrücklich
          markieren.
        </p>
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
                (upload) => !a.uploads.some((prior) => prior.id === upload.id),
              );
              if (added)
                setSelectedUploadIds((current) => [...current, added.id]);
              return updated;
            })
          }
        />
      </section>
      {!complete && (
        <p className="notice">
          Die Prüfung ist verfügbar, sobald alle{" "}
          {a.configSnapshot.criteria.length} Kriterien bestätigt sind.
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
