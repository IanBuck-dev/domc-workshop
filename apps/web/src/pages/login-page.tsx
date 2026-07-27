import { FormEvent, useState } from "react";
import { LockKeyhole } from "lucide-react";
import { api } from "../lib/api-client";
import { BrandLockup } from "../components/ui/brand-mark";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";

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
    <main className="login-page">
      <Card
        as="form"
        elevation="floating"
        className="login-card"
        onSubmit={submit}
      >
        <BrandLockup />
        <span className="login-icon">
          <LockKeyhole />
        </span>
        <h1>Geschäftsprozesse weiterdenken</h1>
        <p>Bitte melden Sie sich für den geschützten Testbereich an.</p>
        <label>
          Benutzername
          <input
            name="username"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </label>
        <label>
          Passwort
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        <Button variant="primary" disabled={busy}>
          {busy ? "Anmeldung läuft …" : "Anmelden"}
        </Button>
        <small>Nur anonymisierte oder freigegebene Testdaten verwenden.</small>
      </Card>
    </main>
  );
}
