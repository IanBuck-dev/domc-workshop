import { afterEach, describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { authRoutes } from "../apps/server/src/routes/auth";
import { requireSession } from "../apps/server/src/session";

const original = {
  username: process.env.APP_AUTH_USERNAME,
  hash: process.env.APP_AUTH_PASSWORD_HASH,
  secret: process.env.APP_SESSION_SECRET,
};
const originalDateNow = Date.now;
afterEach(() => {
  process.env.APP_AUTH_USERNAME = original.username;
  process.env.APP_AUTH_PASSWORD_HASH = original.hash;
  process.env.APP_SESSION_SECRET = original.secret;
  Date.now = originalDateNow;
});

describe("single-account authentication", () => {
  test("rejects anonymous requests and accepts a signed session cookie", async () => {
    process.env.APP_AUTH_USERNAME = "testing";
    process.env.APP_AUTH_PASSWORD_HASH = await Bun.password.hash(
      "fixture-password-123",
    );
    process.env.APP_SESSION_SECRET =
      "test-secret-that-is-definitely-longer-than-thirty-two-characters";
    const app = new Hono();
    app.route("/api/auth", authRoutes());
    app.use("/api/*", requireSession);
    app.get("/api/private", (c) => c.json({ ok: true }));
    expect((await app.request("/api/private")).status).toBe(401);
    const anonymousSession = await app.request("/api/auth/session");
    expect(anonymousSession.status).toBe(200);
    expect(await anonymousSession.json()).toEqual({ authenticated: false });
    const failed = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "testing", password: "wrong" }),
    });
    expect(failed.status).toBe(401);
    const login = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        username: "testing",
        password: "fixture-password-123",
      }),
    });
    expect(login.status).toBe(200);
    const cookie = login.headers.get("set-cookie")!;
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
    expect(
      (await app.request("/api/private", { headers: { cookie } })).status,
    ).toBe(200);

    const issuedAt = originalDateNow();
    Date.now = () => issuedAt + 8 * 60 * 60 * 1_000 + 1;
    expect(
      (await app.request("/api/private", { headers: { cookie } })).status,
    ).toBe(401);

    Date.now = originalDateNow;
    const logout = await app.request("/api/auth/logout", {
      method: "POST",
      headers: { cookie },
    });
    expect(logout.status).toBe(200);
    expect(logout.headers.get("set-cookie")).toContain("Max-Age=0");
  });
});
