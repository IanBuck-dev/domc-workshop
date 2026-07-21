import { FormEvent, useEffect, useState } from "react";
import { MessagesSquare, Rows3, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api-client";
import { loadConfigOverride } from "../lib/local-config";
import type {
  AssessmentConfig,
  CoverData,
  InteractionMode,
} from "../lib/assessment-types";

export function AssessmentStartPage() {
  const navigate = useNavigate();
  const [config, setConfig] = useState<AssessmentConfig | null>(null);
  const [cover, setCover] = useState<CoverData>({
    department: "",
    participantName: "",
    participantEmail: "",
    processName: "",
    currentProcessDescription: null,
  });
  const [mode, setMode] = useState<InteractionMode>("form");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    api
      .configDefaults()
      .then((defaults) => setConfig(loadConfigOverride() ?? defaults))
      .catch((e: Error) => setError(e.message));
  }, []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!config) return;
    setBusy(true);
    setError("");
    try {
      const created = await api.createAssessment({
        cover,
        mode,
        config,
        demoDataConfirmed: confirmed,
      });
      navigate(
        `/assessments/${created.id}/${mode === "form" ? "gateway" : "chat"}`,
      );
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <section className="assessment-start">
      <div className="page-title">
        <div>
          <span className="kicker">NEUE BEWERTUNG</span>
          <h1>Geschäftsprozess einreichen</h1>
          <p>
            Beschreiben Sie den Prozess einmal – anschließend wählen Sie die
            passende Unterstützung.
          </p>
        </div>
      </div>
      <form className="panel start-form" onSubmit={submit}>
        <div className="form-grid">
          <label>
            Fachbereich
            <select
              name="department"
              value={cover.department}
              onChange={(e) =>
                setCover((current) => ({
                  ...current,
                  department: e.target.value,
                }))
              }
              required
            >
              <option value="">Bitte wählen</option>
              {config?.departments.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </label>
          <label>
            Name der einreichenden Person
            <input
              name="participantName"
              value={cover.participantName}
              onChange={(e) =>
                setCover((current) => ({
                  ...current,
                  participantName: e.target.value,
                }))
              }
              required
            />
          </label>
          <label>
            E-Mail-Adresse
            <input
              name="participantEmail"
              type="email"
              value={cover.participantEmail}
              onChange={(e) =>
                setCover((current) => ({
                  ...current,
                  participantEmail: e.target.value,
                }))
              }
              required
            />
          </label>
          <label>
            Name des Geschäftsprozesses
            <input
              name="processName"
              value={cover.processName}
              onChange={(e) =>
                setCover((current) => ({
                  ...current,
                  processName: e.target.value,
                }))
              }
              placeholder="z. B. Schadenbearbeitung"
              required
            />
          </label>
          <label className="full-width-field">
            Beschreibung des heutigen Ablaufs <small>(freiwillig)</small>
            <textarea
              name="currentProcessDescription"
              rows={6}
              value={cover.currentProcessDescription ?? ""}
              onChange={(e) =>
                setCover((current) => ({
                  ...current,
                  currentProcessDescription: e.target.value || null,
                }))
              }
              placeholder="Beschreiben Sie den Prozess vom Auslöser bis zum Ergebnis …"
            />
            <small>
              Nennen Sie gern beteiligte Personen, Anwendungen, Dokumente,
              Entscheidungen, Übergaben und besonders schwierige Fälle. Eine
              technische Beschreibung ist nicht erforderlich.
            </small>
          </label>
        </div>
        <fieldset className="mode-choice">
          <legend>Wie möchten Sie den Prozess beschreiben?</legend>
          <label className={mode === "form" ? "selected" : ""}>
            <input
              type="radio"
              name="mode"
              checked={mode === "form"}
              onChange={() => setMode("form")}
            />
            <Rows3 />
            <span>
              <b>Formular</b>
              <small>
                Vier Einstiegsfragen und eine strukturierte Kriterientabelle.
              </small>
            </span>
          </label>
          <label className={mode === "chat" ? "selected" : ""}>
            <input
              type="radio"
              name="mode"
              checked={mode === "chat"}
              onChange={() => setMode("chat")}
            />
            <MessagesSquare />
            <span>
              <b>Geführtes KI-Gespräch</b>
              <small>
                Adaptive Prozessfragen und fünf Themen im Dialog, mit
                Vorschlägen und sichtbarem Fortschritt.
              </small>
            </span>
          </label>
        </fieldset>
        <label className="confirmation-box">
          <input
            name="demoDataConfirmed"
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            required
          />
          <ShieldCheck />
          <span>
            <b>
              Ich verwende ausschließlich anonymisierte oder freigegebene
              Testdaten.
            </b>
            <small>
              Keine realen Versicherungs-, Schaden- oder Personendaten eingeben.
            </small>
          </span>
        </label>
        {error && <p className="notice error">{error}</p>}
        <button className="button" disabled={!config || !confirmed || busy}>
          {busy ? "Bewertung wird angelegt …" : "Bewertung starten"}
        </button>
      </form>
    </section>
  );
}
