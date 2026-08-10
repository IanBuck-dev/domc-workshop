import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, Lightbulb } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiError } from "../lib/api-client";
import { loadConfigOverride } from "../lib/local-config";
import type { SimilarProcess } from "../lib/corpus-types";
import type {
  ProcessCaptureConfig,
  ProcessCaptureRecord,
} from "../lib/process-types";
import { DemoSidecar } from "../components/demo-sidecar";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Spinner } from "../components/ui/spinner";

export function ProcessStartPage() {
  const navigate = useNavigate();
  const [config, setConfig] = useState<ProcessCaptureConfig | null>(null);
  const [cover, setCover] = useState<ProcessCaptureRecord["cover"]>({
    department: "",
    participantName: "",
    participantEmail: "",
    processName: "",
  });
  const [touched, setTouched] = useState({
    department: false,
    participantName: false,
    participantEmail: false,
    processName: false,
  });
  const [busy, setBusy] = useState(false);
  const [interactionMode, setInteractionMode] = useState<"chat" | "form">(
    "chat",
  );
  const [error, setError] = useState("");
  const [duplicateError, setDuplicateError] = useState("");
  const [similar, setSimilar] = useState<SimilarProcess[]>([]);
  const fieldErrors = {
    department: cover.department.trim()
      ? ""
      : "Bitte wählen Sie einen Fachbereich aus.",
    processName: cover.processName.trim()
      ? ""
      : "Bitte geben Sie einen Prozessnamen ein.",
    participantName: cover.participantName.trim()
      ? ""
      : "Bitte geben Sie eine einreichende Person an.",
    participantEmail: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      cover.participantEmail.trim(),
    )
      ? ""
      : "Bitte geben Sie eine gültige E-Mail-Adresse ein.",
  };
  const coverIsValid = Object.values(fieldErrors).every((message) => !message);
  useEffect(() => {
    api
      .configDefaults()
      .then((defaults) => setConfig(loadConfigOverride() ?? defaults))
      .catch((e: Error) => setError(e.message));
  }, []);
  /*
   * Hinweis auf ähnliche Prozesse, während der Name getippt wird. Der
   * Prozessname ist die fachliche Identität eines Prozesses — ein Duplikat
   * würde die Dokumentation aufspalten. Der Abgleich läuft im Hintergrund und
   * bekommt deshalb keine Ladeanzeige; scheitert er, bleibt der Hinweis
   * einfach aus.
   */
  useEffect(() => {
    const name = cover.processName.trim();
    if (name.length < 3) {
      setSimilar([]);
      return;
    }
    let current = true;
    const timer = setTimeout(() => {
      api
        .similarProcesses(name)
        .then((treffer) => {
          if (current) setSimilar(treffer);
        })
        .catch(() => {
          if (current) setSimilar([]);
        });
    }, 300);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [cover.processName]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setTouched({
      department: true,
      participantName: true,
      participantEmail: true,
      processName: true,
    });
    if (!config || !coverIsValid) return;
    setBusy(true);
    setError("");
    setDuplicateError("");
    try {
      const record = await api.createProcess({
        cover,
        config,
        demoDataConfirmed: true,
        interactionMode,
      });
      navigate(
        `/processes/${record.id}/${interactionMode === "chat" ? "chat" : "capture"}`,
      );
    } catch (e) {
      // Ein vergebener Prozessname ist ein Feldfehler, kein Formularfehler —
      // er gehört unter das Namensfeld, nicht in den allgemeinen Fehlerkasten.
      if (e instanceof ApiError && e.code === "duplicate_process_name")
        setDuplicateError(e.message);
      else setError((e as Error).message);
      setBusy(false);
    }
  }
  function fillCover(demoCover: ProcessCaptureRecord["cover"]) {
    setCover(demoCover);
    setInteractionMode("chat");
    setTouched({
      department: true,
      participantName: true,
      participantEmail: true,
      processName: true,
    });
    setError("");
    setDuplicateError("");
  }
  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:py-16">
      <DemoSidecar processName={cover.processName} onFillCover={fillCover} />
      <div className="mb-8 space-y-2">
        <p className="text-eyebrow uppercase text-primary">Schritt 1 von 2</p>
        <h1 className="text-title text-foreground sm:text-display">
          Prozesserfassung
        </h1>
      </div>
      <Card className="border-border">
        <CardHeader className="border-b px-6 pb-5 sm:px-10">
          <CardTitle className="text-heading">Grunddaten</CardTitle>
        </CardHeader>
        <CardContent className="p-6 sm:p-10">
          <form noValidate onSubmit={submit} className="space-y-8">
            <div className="grid gap-x-7 gap-y-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="department">Fachbereich</Label>
                <Select
                  value={cover.department}
                  onValueChange={(department) =>
                    setCover({ ...cover, department })
                  }
                >
                  <SelectTrigger
                    id="department"
                    className="w-full"
                    onBlur={() =>
                      setTouched((current) => ({
                        ...current,
                        department: true,
                      }))
                    }
                    aria-invalid={
                      touched.department && !!fieldErrors.department
                    }
                    aria-describedby="department-message"
                  >
                    <SelectValue placeholder="Fachbereich auswählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {config?.departments.map((department) => (
                      <SelectItem key={department} value={department}>
                        {department}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p
                  id="department-message"
                  className="min-h-5 text-label text-destructive"
                >
                  {touched.department ? fieldErrors.department : ""}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="processName">Prozessname</Label>
                <Input
                  id="processName"
                  name="processName"
                  placeholder="z. B. Schaden-Erstaufnahme"
                  value={cover.processName}
                  onChange={(e) => {
                    setDuplicateError("");
                    setCover({ ...cover, processName: e.target.value });
                  }}
                  onBlur={() =>
                    setTouched((current) => ({ ...current, processName: true }))
                  }
                  aria-invalid={
                    !!duplicateError ||
                    (touched.processName && !!fieldErrors.processName)
                  }
                  aria-describedby="process-name-message"
                  required
                />
                <p
                  id="process-name-message"
                  className="min-h-5 text-label text-destructive"
                >
                  {duplicateError ||
                    (touched.processName ? fieldErrors.processName : "")}
                </p>
                {similar.length > 0 && !duplicateError && (
                  <div className="rounded-md border border-border bg-muted p-3 text-ui">
                    <p className="flex items-center gap-2 text-label text-foreground">
                      <Lightbulb className="size-4" aria-hidden="true" />
                      Ähnliche Prozesse gibt es bereits
                    </p>
                    <ul className="mt-2 space-y-1">
                      {similar.map((process) => (
                        <li key={process.id}>
                          <Link
                            to={`/processes/${process.id}`}
                            className="text-primary underline underline-offset-4"
                          >
                            {process.processName}
                          </Link>
                          {process.department && (
                            <span className="text-muted-foreground">
                              {" "}
                              · {process.department}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-muted-foreground">
                      Ergänzen Sie besser den bestehenden Prozess, statt einen
                      zweiten mit gleichem Inhalt anzulegen.
                    </p>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="participantName">Einreichende Person</Label>
                <Input
                  id="participantName"
                  name="participantName"
                  placeholder="Vor- und Nachname"
                  value={cover.participantName}
                  onChange={(e) =>
                    setCover({ ...cover, participantName: e.target.value })
                  }
                  onBlur={() =>
                    setTouched((current) => ({
                      ...current,
                      participantName: true,
                    }))
                  }
                  aria-invalid={
                    touched.participantName && !!fieldErrors.participantName
                  }
                  aria-describedby="participant-name-message"
                  required
                />
                <p
                  id="participant-name-message"
                  className="min-h-5 text-label text-destructive"
                >
                  {touched.participantName ? fieldErrors.participantName : ""}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="participantEmail">E-Mail-Adresse</Label>
                <Input
                  id="participantEmail"
                  name="participantEmail"
                  type="email"
                  placeholder="name@unternehmen.de"
                  value={cover.participantEmail}
                  onChange={(e) =>
                    setCover({ ...cover, participantEmail: e.target.value })
                  }
                  onBlur={() =>
                    setTouched((current) => ({
                      ...current,
                      participantEmail: true,
                    }))
                  }
                  aria-invalid={
                    touched.participantEmail && !!fieldErrors.participantEmail
                  }
                  aria-describedby="participant-email-message"
                  required
                />
                <p
                  id="participant-email-message"
                  className="min-h-5 text-label text-destructive"
                >
                  {touched.participantEmail ? fieldErrors.participantEmail : ""}
                </p>
              </div>
            </div>
            <fieldset className="space-y-3">
              <legend className="text-label">Art der Erfassung</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <label
                  className={`cursor-pointer rounded-lg border p-4 ${interactionMode === "chat" ? "border-primary bg-primary/5" : "border-border"}`}
                >
                  <input
                    className="sr-only"
                    type="radio"
                    name="interactionMode"
                    checked={interactionMode === "chat"}
                    onChange={() => setInteractionMode("chat")}
                  />
                  <span className="mb-2 inline-flex rounded bg-primary px-2 py-0.5 text-label text-primary-foreground">
                    Empfohlen
                  </span>
                  <span className="block font-semibold">Chat</span>
                  <span className="mt-1 block text-ui text-muted-foreground">
                    Unterlagen hochladen, Rückfragen beantworten und das
                    Prozessbild gemeinsam prüfen.
                  </span>
                </label>
                <label
                  className={`cursor-pointer rounded-lg border p-4 ${interactionMode === "form" ? "border-primary bg-primary/5" : "border-border"}`}
                >
                  <input
                    className="sr-only"
                    type="radio"
                    name="interactionMode"
                    checked={interactionMode === "form"}
                    onChange={() => setInteractionMode("form")}
                  />
                  <span className="block font-semibold">Formular</span>
                  <span className="mt-1 block text-ui text-muted-foreground">
                    Den Prozess in festen Themenblöcken beschreiben und
                    anschließend prüfen.
                  </span>
                </label>
              </div>
            </fieldset>
            {error && (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-label text-destructive">
                {error}
              </p>
            )}
            <div className="flex justify-end">
              <Button
                type="submit"
                size="lg"
                disabled={!config || !coverIsValid || busy}
                aria-busy={busy}
              >
                {busy ? "Wird angelegt …" : "Weiter zu Schritt 2"}
                {busy ? <Spinner /> : <ArrowRight aria-hidden="true" />}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
