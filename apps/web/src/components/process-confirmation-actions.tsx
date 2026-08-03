import { Link } from "react-router-dom";
import { Button } from "./ui/button";

export function ProcessConfirmationActions({
  processId,
  confirmed,
  confirmationAllowed,
  busy,
  label,
  onConfirm,
}: {
  processId: string;
  confirmed: boolean;
  confirmationAllowed: boolean;
  busy: boolean;
  label: string;
  onConfirm: () => void;
}) {
  if (confirmed)
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">Der Prozess wurde fachlich bestätigt.</p>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to={`/processes/${processId}`}>Zum Prozess</Link>
          </Button>
          <Button asChild>
            <Link to={`/processes/${processId}/opportunities`}>
              KI-Potenziale ansehen
            </Link>
          </Button>
        </div>
      </div>
    );
  return (
    <div className="flex items-center justify-between gap-4">
      <p className="text-xs text-muted-foreground">
        Bestätigen Sie erst, wenn der Hauptablauf stimmt.
      </p>
      <Button disabled={!confirmationAllowed || busy} onClick={onConfirm}>
        {label}
      </Button>
    </div>
  );
}
