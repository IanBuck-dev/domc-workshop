import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, ShieldAlert } from "lucide-react";
import { api } from "../lib/api-client";
export function IntakePage() {
  const nav = useNavigate(),
    [title, setTitle] = useState(""),
    [raw, setRaw] = useState(""),
    [confirmed, setConfirmed] = useState(
      () => sessionStorage.getItem("data-confirmed") === "1",
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      sessionStorage.setItem("data-confirmed", "1");
      const i = await api.create({ title, raw });
      nav(`/ideas/${i.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <section className="form-page">
      <span className="kicker">NEUE PROJEKTIDEE</span>
      <h1>Was möchten Sie verbessern?</h1>
      <p className="lead">
        Beschreiben Sie die Idee so, wie sie Ihnen in den Sinn kommt. Struktur
        und perfekte Formulierungen sind nicht nötig.
      </p>
      <div className="inline-warning">
        <ShieldAlert />
        <span>
          <b>Nur Demo-Daten.</b> Keine echten Schaden-, Kunden-, Vertrags-,
          Gesundheits- oder Beschäftigtendaten eingeben.
        </span>
      </div>
      <form onSubmit={submit} className="intake-form">
        <label>
          Titel der Idee
          <input
            id="idea-title"
            name="idea-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            minLength={2}
            required
            placeholder="z. B. Eingangspost schneller zuordnen"
          />
        </label>
        <label>
          Ihre Idee
          <textarea
            id="idea-text"
            name="idea-text"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            minLength={5}
            required
            rows={10}
            placeholder="Beschreiben Sie Ausgangslage, gewünschte Verbesserung und bekannte Rahmenbedingungen …"
          />
        </label>
        <label className="check">
          <input
            name="demo-data-confirmation"
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          <span>
            Ich verwende ausschließlich freigegebene Demo- oder anonymisierte
            Daten.
          </span>
        </label>
        {error && <p className="error">{error}</p>}
        <button className="button" disabled={!confirmed || busy}>
          {busy ? "Wird gespeichert …" : "Idee aufnehmen"}
          <ArrowRight />
        </button>
      </form>
    </section>
  );
}
