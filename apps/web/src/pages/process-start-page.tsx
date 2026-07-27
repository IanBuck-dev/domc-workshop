import { FormEvent, useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
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
    <section className="narrow-page">
      <div className="page-title">
        <Kicker>Seite 1 von 2 · Setup</Kicker>
        <h1>Prozessaufnahme vorbereiten</h1>
        <p>
          Hier werden nur die Rahmendaten erfasst. Die Beschreibung des Ablaufs
          beginnt auf der nächsten Seite.
        </p>
      </div>
      <Card as="form" className="setup-form" onSubmit={submit}>
        <div className="form-grid">
          <label>
            Fachbereich
            <select
              name="department"
              value={cover.department}
              onChange={(e) =>
                setCover({ ...cover, department: e.target.value })
              }
              required
            >
              <option value="">Bitte wählen</option>
              {config?.departments.map((department) => (
                <option key={department}>{department}</option>
              ))}
            </select>
          </label>
          <label>
            Name der einreichenden Person
            <input
              name="participantName"
              value={cover.participantName}
              onChange={(e) =>
                setCover({ ...cover, participantName: e.target.value })
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
                setCover({ ...cover, participantEmail: e.target.value })
              }
              required
            />
          </label>
          <label>
            Name des Geschäftsprozesses
            <input
              name="processName"
              placeholder="z. B. Retargeting Cold Leads"
              value={cover.processName}
              onChange={(e) =>
                setCover({ ...cover, processName: e.target.value })
              }
              required
            />
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
              Ich verwende ausschließlich anonymisierte oder freigegebene
              Testdaten.
            </b>
            <small>
              Keine realen Versicherungs-, Kunden- oder Personendaten eingeben.
            </small>
          </span>
        </label>
        {error && <p className="notice error">{error}</p>}
        <Button
          type="submit"
          variant="primary"
          disabled={!config || !confirmed || busy}
        >
          {busy ? "Wird angelegt …" : "Weiter zur Prozessbeschreibung"}
        </Button>
      </Card>
    </section>
  );
}
