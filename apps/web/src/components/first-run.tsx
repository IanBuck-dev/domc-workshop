import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
export function FirstRun() {
  const [instance, setInstance] = useState("");
  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((x) => {
        if (sessionStorage.getItem("first-run-instance") !== x.instanceId)
          setInstance(x.instanceId);
      });
  }, []);
  if (!instance) return null;
  return (
    <div
      className="first-run"
      role="dialog"
      aria-modal="true"
      aria-labelledby="first-run-title"
    >
      <section>
        <ShieldCheck />
        <span className="kicker">SICHER IN DEN WORKSHOP STARTEN</span>
        <h2 id="first-run-title">Willkommen im Claims-Ideenportfolio</h2>
        <p>
          Nutzen Sie ausschließlich fiktive oder freigegebene anonymisierte
          Inhalte. Keine echten Schaden-, Kunden-, Vertrags-, Gesundheits- oder
          Beschäftigtendaten eingeben.
        </p>
        <p className="local-note">
          Ihre Ideen werden als lesbare Dateien lokal gespeichert. Nur bei einer
          ausdrücklichen Analyse wird die aktuelle Idee an die konfigurierte
          Claude-CLI übergeben.
        </p>
        <button
          className="button"
          onClick={() => {
            sessionStorage.setItem("first-run-instance", instance);
            setInstance("");
          }}
        >
          Verstanden – Portfolio öffnen
        </button>
      </section>
    </div>
  );
}
