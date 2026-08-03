import { useState } from "react";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
const slides = [
  [
    "Unterlagen bereitstellen",
    "Arbeitsanweisungen, Präsentationen und Beispieldokumente geben den schnellsten Einstieg.",
  ],
  [
    "In Alltagssprache ergänzen",
    "Beschreiben Sie die Arbeit so, wie Sie sie einer neuen Kollegin oder einem neuen Kollegen erklären würden.",
  ],
  [
    "Prozessbild prüfen",
    "Verweisen Sie direkt auf Schritte oder Übergänge und bestätigen Sie das Bild erst, wenn der Hauptablauf stimmt.",
  ],
] as const;
export function ChatCaptureTutorial({
  open,
  onDone,
}: {
  open: boolean;
  onDone: () => void;
}) {
  const [step, setStep] = useState(0);
  const last = step === slides.length - 1;
  return (
    <Dialog open={open}>
      <DialogContent onPointerDownOutside={(event) => event.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{slides[step][0]}</DialogTitle>
          <DialogDescription>{slides[step][1]}</DialogDescription>
        </DialogHeader>
        <div className="flex justify-between">
          <Button variant="ghost" onClick={onDone}>
            Überspringen
          </Button>
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="ghost" onClick={() => setStep(step - 1)}>
                Zurück
              </Button>
            )}
            <Button onClick={() => (last ? onDone() : setStep(step + 1))}>
              {last ? "Chat starten" : "Weiter"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
