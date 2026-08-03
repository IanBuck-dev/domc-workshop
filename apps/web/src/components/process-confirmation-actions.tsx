import { Button } from "./ui/button";

export function ProcessConfirmationActions({
  confirmationAllowed,
  busy,
  label,
  onConfirm,
}: {
  confirmationAllowed: boolean;
  busy: boolean;
  label: string;
  onConfirm: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <p className="text-caption text-muted-foreground">
        Bestätigen Sie erst, wenn der Hauptablauf stimmt.
      </p>
      <Button disabled={!confirmationAllowed || busy} onClick={onConfirm}>
        {label}
      </Button>
    </div>
  );
}
