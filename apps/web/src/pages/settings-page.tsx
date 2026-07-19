import { useEffect, useState } from "react";
import { Save, RotateCcw, Terminal, Sparkles, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import type { Workshop } from "../../../../packages/domain/src/schemas";
import { api } from "../lib/api-client";
export function SettingsPage() {
  const [s, setS] = useState<Workshop | null>(null),
    [env, setEnv] = useState<any>(null),
    [msg, setMsg] = useState(""),
    [loadError, setLoadError] = useState(""),
    [confirm, setConfirm] = useState("");
  useEffect(() => {
    api
      .settings()
      .then(setS)
      .catch((error: Error) => setLoadError(error.message));
    api
      .environment()
      .then(setEnv)
      .catch(() => setEnv({ available: false }));
  }, []);
  if (loadError)
    return (
      <p className="notice error">
        Einstellungen konnten nicht geladen werden: {loadError}
      </p>
    );
  if (!s) return <p>Lädt …</p>;
  const current = s;
  async function save() {
    await api.saveSettings(current);
    setMsg("Einstellungen gespeichert.");
  }
  async function reset() {
    try {
      const r = await api.reset(confirm);
      setMsg(`Standard wiederhergestellt. Sicherung: ${r.backup}`);
      setConfirm("");
    } catch (e) {
      setMsg((e as Error).message);
    }
  }
  return (
    <section className="settings">
      <div className="page-title">
        <span className="kicker">WORKSHOP KONFIGURIEREN</span>
        <h1>Einstellungen</h1>
        <p>
          Diese Auswahl steuert neue Claude-Bewertungen. Die fachlichen
          Leitplanken bleiben in der editierbaren Datei workspace/CLAUDE.md.
        </p>
      </div>
      <div className="settings-grid">
        <Link className="showcase-link" to="/settings/entstehung">
          <Sparkles />
          <div>
            <small>HINTER DEN KULISSEN</small>
            <b>Wie entstand diese Demo?</b>
            <span>
              Prompts, Agentenergebnisse, Zeit-, Token- und Kostenschätzung
              ansehen
            </span>
          </div>
          <ArrowRight />
        </Link>
        <section className="panel">
          <h2>Workshop</h2>
          <label>
            Titel
            <input
              id="workshop-title"
              name="workshop-title"
              value={s.workshopTitle}
              onChange={(e) => setS({ ...s, workshopTitle: e.target.value })}
            />
          </label>
          <label>
            Unterzeile
            <input
              id="workshop-subtitle"
              name="workshop-subtitle"
              value={s.workshopSubtitle}
              onChange={(e) => setS({ ...s, workshopSubtitle: e.target.value })}
            />
          </label>
          <label>
            Claude-Modell
            <select
              id="claude-model"
              name="claude-model"
              value={s.model}
              onChange={(e) => {
                const m = s.models.find((x) => x.value === e.target.value)!;
                setS({ ...s, model: m.value, modelDisplay: m.label });
              }}
            >
              {s.models.map((m) => (
                <option value={m.value} key={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Denkaufwand
            <select
              id="claude-effort"
              name="claude-effort"
              value={s.effort}
              onChange={(e) =>
                setS({ ...s, effort: e.target.value as Workshop["effort"] })
              }
            >
              {["low", "medium", "high", "xhigh", "max"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            Leitlinie für die Priorisierung
            <textarea
              name="scoring-guidance"
              rows={4}
              value={s.scoringGuidance}
              onChange={(e) => setS({ ...s, scoringGuidance: e.target.value })}
            />
          </label>
          <button className="button" onClick={save}>
            <Save />
            Speichern
          </button>
        </section>
        <section className="panel">
          <h2>
            <Terminal />
            Claude-Umgebung
          </h2>
          <div className="env-status">
            <span className={env?.available ? "dot ok" : "dot"} />
            <div>
              <b>
                {env?.available
                  ? "Claude Code gefunden"
                  : "Claude Code nicht gefunden"}
              </b>
              <small>{env?.version ?? "Wird geprüft …"}</small>
            </div>
          </div>
          <p>
            Claude Code muss separat installiert und angemeldet sein. Pro Klick
            wird genau eine begrenzte Analyse ohne Werkzeuge gestartet.
          </p>
          <div className="env-status">
            <span className={env?.pythonAvailable ? "dot ok" : "dot"} />
            <div>
              <b>
                {env?.pythonAvailable
                  ? "Dateikonvertierung verfügbar"
                  : "Dateikonvertierung eingeschränkt"}
              </b>
              <small>{env?.pythonVersion ?? "Python wird geprüft …"}</small>
            </div>
          </div>
        </section>
        <section className="panel danger-zone">
          <h2>
            <RotateCcw />
            Workshop zurücksetzen
          </h2>
          <p>
            Erstellt zuerst eine Sicherung und stellt danach Leitplanken,
            Einstellungen und alle zwölf Demo-Ideen wieder her. Exporte und
            Sicherungen bleiben erhalten.
          </p>
          <label>
            Zur Bestätigung ZURÜCKSETZEN eingeben
            <input
              id="reset-confirmation"
              name="reset-confirmation"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </label>
          <button
            className="danger-button"
            disabled={confirm !== "ZURÜCKSETZEN"}
            onClick={reset}
          >
            Standard wiederherstellen
          </button>
        </section>
      </div>
      {msg && <p className="notice">{msg}</p>}
    </section>
  );
}
