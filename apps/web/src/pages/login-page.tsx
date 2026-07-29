import { FormEvent, useState } from "react";
import { LockKeyhole } from "lucide-react";
import { api } from "../lib/api-client";
import { BrandLockup } from "../components/ui/brand-mark";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

export function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState("testing");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.login(username, password);
      onLogin();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <Card className="w-full max-w-md shadow-lg">
        <CardContent className="space-y-6 p-7 sm:p-9">
          <BrandLockup />
          <span className="grid size-12 place-items-center rounded-lg bg-secondary text-primary">
            <LockKeyhole className="size-6" />
          </span>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">
              Geschäftsprozesse weiterdenken
            </h1>
            <p className="text-muted-foreground">
              Bitte melden Sie sich für den geschützten Testbereich an.
            </p>
          </div>
          <form onSubmit={submit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username">Benutzername</Label>
              <Input
                id="username"
                name="username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Passwort</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && (
              <p
                className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm font-medium text-destructive"
                role="alert"
              >
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Anmeldung läuft …" : "Anmelden"}
            </Button>
          </form>
          <small className="block text-center text-xs text-muted-foreground">
            Nur anonymisierte oder freigegebene Testdaten verwenden.
          </small>
        </CardContent>
      </Card>
    </main>
  );
}
