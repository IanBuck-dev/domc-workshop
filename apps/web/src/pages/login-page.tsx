import { FormEvent, useState } from "react";
import { api } from "../lib/api-client";
import { BrandLockup } from "../components/brand-mark";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Spinner } from "../components/ui/spinner";
import { PublicFooter } from "../components/public-footer";

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
    <main className="flex min-h-screen flex-col">
      <div className="grid flex-1 place-items-center px-4 py-10">
        <Card className="w-full max-w-sm gap-0 py-0 shadow-lg">
          <CardContent className="space-y-5 p-6 sm:p-7">
            <BrandLockup />
            <div className="space-y-2">
              <h1 className="text-title">Anmelden</h1>
              <p className="text-ui text-muted-foreground">
                Geschützter Testbereich für die Prozessaufnahme.
              </p>
            </div>
            <form onSubmit={submit} className="space-y-4">
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
                  className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-label text-destructive"
                  role="alert"
                >
                  {error}
                </p>
              )}
              <Button
                type="submit"
                className="w-full"
                disabled={busy}
                aria-busy={busy}
              >
                {busy && <Spinner />}
                {busy ? "Anmeldung läuft …" : "Anmelden"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
      <PublicFooter />
    </main>
  );
}
