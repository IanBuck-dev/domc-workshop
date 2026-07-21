import { createHmac, timingSafeEqual } from "node:crypto";
import type { Context, MiddlewareHandler } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";

const cookieName = "claims_ai_session";
const lifetimeSeconds = 8 * 60 * 60;

function secret() {
  const value = process.env.APP_SESSION_SECRET;
  if (!value || value.length < 32)
    throw new Error("APP_SESSION_SECRET muss mindestens 32 Zeichen enthalten.");
  return value;
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function token(username: string) {
  const payload = Buffer.from(
    JSON.stringify({
      username,
      expiresAt: Date.now() + lifetimeSeconds * 1_000,
    }),
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function validToken(value: string | undefined) {
  if (!value) return null;
  const [payload, signature, extra] = value.split(".");
  if (!payload || !signature || extra) return null;
  const expected = sign(payload);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right))
    return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as { username?: unknown; expiresAt?: unknown };
    return typeof parsed.username === "string" &&
      typeof parsed.expiresAt === "number" &&
      parsed.expiresAt > Date.now()
      ? parsed.username
      : null;
  } catch {
    return null;
  }
}

export function authenticatedUser(c: Context) {
  return validToken(getCookie(c, cookieName));
}

export function createSession(c: Context, username: string) {
  const forwardedProto = c.req.header("x-forwarded-proto");
  setCookie(c, cookieName, token(username), {
    httpOnly: true,
    secure: forwardedProto === "https" || process.env.NODE_ENV === "production",
    sameSite: "Strict",
    path: "/",
    maxAge: lifetimeSeconds,
  });
}

export function clearSession(c: Context) {
  deleteCookie(c, cookieName, {
    path: "/",
    httpOnly: true,
    sameSite: "Strict",
  });
}

export const requireSession: MiddlewareHandler = async (c, next) => {
  if (!authenticatedUser(c))
    return c.json({ error: "Bitte melden Sie sich an." }, 401);
  await next();
};
