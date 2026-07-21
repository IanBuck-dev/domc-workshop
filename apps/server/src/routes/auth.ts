import { Hono } from "hono";
import { z } from "zod";
import { authenticatedUser, clearSession, createSession } from "../session.ts";

const attempts = new Map<string, { count: number; resetAt: number }>();
const loginSchema = z.object({
  username: z.string().min(1).max(100),
  password: z.string().min(1).max(1_000),
});

function clientKey(request: Request) {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "local"
  );
}

export function authRoutes() {
  const app = new Hono();
  app.post("/login", async (c) => {
    const key = clientKey(c.req.raw);
    const now = Date.now();
    const current = attempts.get(key);
    if (current && current.resetAt > now && current.count >= 5)
      return c.json(
        { error: "Zu viele Anmeldeversuche. Bitte warten Sie kurz." },
        429,
      );
    const body = loginSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success)
      return c.json(
        { error: "Bitte geben Sie Benutzername und Passwort ein." },
        400,
      );
    const username = process.env.APP_AUTH_USERNAME;
    const passwordHash = process.env.APP_AUTH_PASSWORD_HASH;
    if (!username || !passwordHash)
      throw new Error(
        "Die Anwendungsauthentifizierung ist nicht konfiguriert.",
      );
    const passwordValid =
      body.data.username === username &&
      (await Bun.password
        .verify(body.data.password, passwordHash)
        .catch(() => false));
    if (!passwordValid) {
      attempts.set(key, {
        count: current && current.resetAt > now ? current.count + 1 : 1,
        resetAt: now + 60_000,
      });
      return c.json(
        { error: "Benutzername oder Passwort ist nicht korrekt." },
        401,
      );
    }
    attempts.delete(key);
    createSession(c, username);
    return c.json({ authenticated: true, username });
  });
  app.post("/logout", (c) => {
    clearSession(c);
    return c.json({ authenticated: false });
  });
  app.get("/session", (c) => {
    const username = authenticatedUser(c);
    return username
      ? c.json({ authenticated: true, username })
      : c.json({ authenticated: false });
  });
  return app;
}
