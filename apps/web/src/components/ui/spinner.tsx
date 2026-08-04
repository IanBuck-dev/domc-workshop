import { Loader2Icon } from "lucide-react";

import { cn } from "@/lib/utils";

// Einzige bewusste Abweichung vom shadcn-Stand in dieser Datei: der
// Vorgabewert des aria-label ist deutsch, weil die gesamte Oberfläche deutsch
// ist. Die Grenze um components/ui/ gilt der Gestaltung — Stock-Tailwind, keine
// Typo-Skala, keine eigenen Varianten —, nicht der Sprache einer Vorgabe. Die
// Alternative wäre, an jedem Aufrufer ein aria-label mitzugeben; das verteilt
// dieselbe Zeichenkette über ein Dutzend Dateien und wird beim nächsten
// Aufrufer vergessen. Bei einem `shadcn add` wieder setzen.
function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <Loader2Icon
      role="status"
      aria-label="Wird geladen"
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  );
}

export { Spinner };
