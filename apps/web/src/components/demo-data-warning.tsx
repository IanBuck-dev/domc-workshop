import { ShieldAlert, X } from "lucide-react";
import { useEffect, useState } from "react";
export function DemoDataWarning() {
  const [dismissed, setDismissed] = useState(false);
  const [instance, setInstance] = useState("");
  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((x) => {
        setInstance(x.instanceId);
        setDismissed(
          sessionStorage.getItem(`warning-dismissed-${x.instanceId}`) === "1",
        );
      });
  }, []);
  if (dismissed) return null;
  return (
    <aside className="data-warning" role="note">
      <ShieldAlert />
      <div>
        <b>Nur Demo-Daten verwenden.</b> Keine echten Schaden-, Kunden-,
        Vertrags-, Gesundheits- oder Beschäftigtendaten eingeben. Inhalte werden
        lokal gespeichert und zur Analyse an die konfigurierte Claude-CLI
        übergeben.
      </div>
      <button
        aria-label="Hinweis für diese Sitzung ausblenden"
        onClick={() => {
          sessionStorage.setItem(`warning-dismissed-${instance}`, "1");
          setDismissed(true);
        }}
      >
        <X />
      </button>
    </aside>
  );
}
