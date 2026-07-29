import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, ChevronDown, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api-client";
import { loadConfigOverride } from "../lib/local-config";
import type {
  ProcessCaptureConfig,
  ProcessCaptureRecord,
} from "../lib/process-types";
import { Button } from "../components/ui/button";
import { Kicker } from "../components/ui/kicker";
import { Card } from "../components/ui/card";

export function ProcessStartPage() {
  const navigate = useNavigate();
  const [config, setConfig] = useState<ProcessCaptureConfig | null>(null);
  const [cover, setCover] = useState<ProcessCaptureRecord["cover"]>({
    department: "",
    participantName: "",
    participantEmail: "",
    processName: "",
  });
  const [confirmed, setConfirmed] = useState(false);
  const [touched, setTouched] = useState({
    department: false,
    participantName: false,
    participantEmail: false,
    processName: false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fieldErrors = {
    department: cover.department.trim()
      ? ""
      : "Bitte wählen Sie einen Fachbereich aus.",
    processName: cover.processName.trim()
      ? ""
      : "Bitte geben Sie einen Prozessnamen ein.",
    participantName: cover.participantName.trim()
      ? ""
      : "Bitte geben Sie eine einreichende Person an.",
    participantEmail: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      cover.participantEmail.trim(),
    )
      ? ""
      : "Bitte geben Sie eine gültige E-Mail-Adresse ein.",
  };
  const coverIsValid = Object.values(fieldErrors).every((message) => !message);
  useEffect(() => {
    api
      .configDefaults()
      .then((defaults) => setConfig(loadConfigOverride() ?? defaults))
      .catch((e: Error) => setError(e.message));
  }, []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setTouched({
      department: true,
      participantName: true,
      participantEmail: true,
      processName: true,
    });
    if (!config || !confirmed || !coverIsValid) return;
    setBusy(true);
    setError("");
    try {
      const record = await api.createProcess({
        cover,
        config,
        demoDataConfirmed: true,
      });
      navigate(`/processes/${record.id}/capture`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <section className="narrow-page process-start-page">
      <div className="process-start-heading">
        <Kicker>Schritt 1 von 2</Kicker>
        <h1>Grunddaten zum Prozess</h1>
      </div>
      <Card as="form" className="setup-form" noValidate onSubmit={submit}>
        <div className="form-grid">
          <label>
            Fachbereich
            <span className="setup-select-wrap">
              <select
                name="department"
                value={cover.department}
                onChange={(e) =>
                  setCover({ ...cover, department: e.target.value })
                }
                onBlur={() =>
                  setTouched((current) => ({ ...current, department: true }))
                }
                aria-invalid={touched.department && !!fieldErrors.department}
                aria-describedby="department-message"
                required
              >
                <option value="">Fachbereich auswählen</option>
                {config?.departments.map((department) => (
                  <option key={department}>{department}</option>
                ))}
              </select>
              <ChevronDown aria-hidden="true" />
            </span>
            <span className="field-message" id="department-message">
              {touched.department ? fieldErrors.department : ""}
            </span>
          </label>
          <label>
            Prozessname
            <input
              name="processName"
              placeholder="z. B. Schaden-Erstaufnahme"
              value={cover.processName}
              onChange={(e) =>
                setCover({ ...cover, processName: e.target.value })
              }
              onBlur={() =>
                setTouched((current) => ({ ...current, processName: true }))
              }
              aria-invalid={touched.processName && !!fieldErrors.processName}
              aria-describedby="process-name-message"
              required
            />
            <span className="field-message" id="process-name-message">
              {touched.processName ? fieldErrors.processName : ""}
            </span>
          </label>
          <label>
            Einreichende Person
            <input
              name="participantName"
              placeholder="Vor- und Nachname"
              value={cover.participantName}
              onChange={(e) =>
                setCover({ ...cover, participantName: e.target.value })
              }
              onBlur={() =>
                setTouched((current) => ({
                  ...current,
                  participantName: true,
                }))
              }
              aria-invalid={
                touched.participantName && !!fieldErrors.participantName
              }
              aria-describedby="participant-name-message"
              required
            />
            <span className="field-message" id="participant-name-message">
              {touched.participantName ? fieldErrors.participantName : ""}
            </span>
          </label>
          <label>
            E-Mail-Adresse
            <input
              name="participantEmail"
              type="email"
              placeholder="name@unternehmen.de"
              value={cover.participantEmail}
              onChange={(e) =>
                setCover({ ...cover, participantEmail: e.target.value })
              }
              onBlur={() =>
                setTouched((current) => ({
                  ...current,
                  participantEmail: true,
                }))
              }
              aria-invalid={
                touched.participantEmail && !!fieldErrors.participantEmail
              }
              aria-describedby="participant-email-message"
              required
            />
            <span className="field-message" id="participant-email-message">
              {touched.participantEmail ? fieldErrors.participantEmail : ""}
            </span>
          </label>
        </div>
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
              Ich bestätige, dass ich nur anonymisierte oder freigegebene
              Testdaten verwende.
            </b>
            <small>Keine echten Kunden- oder Personendaten eingeben.</small>
          </span>
        </label>
        {error && <p className="notice error">{error}</p>}
        <Button
          type="submit"
          variant="primary"
          className="setup-submit"
          disabled={!config || !confirmed || !coverIsValid || busy}
        >
          {busy ? "Wird angelegt …" : "Weiter zu Schritt 2"}
          {!busy && <ArrowRight />}
        </Button>
      </Card>
    </section>
  );
}
