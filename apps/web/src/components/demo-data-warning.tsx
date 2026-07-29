import { ShieldAlert, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "./ui/button";
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
    <aside
      className="border-b border-amber-700/20 bg-amber-50 text-amber-950"
      role="note"
    >
      <div className="mx-auto flex max-w-7xl items-start gap-3 px-4 py-3 text-sm leading-5 sm:px-6 lg:px-8">
        <ShieldAlert
          className="mt-0.5 size-5 shrink-0 text-amber-700"
          aria-hidden="true"
        />
        <div className="flex-1">
          <b>Nur Demo-Daten verwenden.</b> Keine echten Schaden-, Kunden-,
          Vertrags-, Gesundheits- oder Beschäftigtendaten eingeben. Inhalte
          werden lokal gespeichert und zur Analyse an den konfigurierten
          KI-Dienst übergeben.
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="-mr-1 -mt-1 text-amber-900 hover:bg-amber-100"
          aria-label="Hinweis für diese Sitzung ausblenden"
          onClick={() => {
            sessionStorage.setItem(`warning-dismissed-${instance}`, "1");
            setDismissed(true);
          }}
        >
          <X className="size-4" />
        </Button>
      </div>
    </aside>
  );
}
