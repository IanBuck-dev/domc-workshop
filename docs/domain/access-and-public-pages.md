# Access, sessions, and public pages

## Purpose

The prototype runs on a public URL so a workshop participant can open it from anywhere.
Two things follow: the application itself must be behind a login, and the public surface
must carry the legal pages a German-hosted site needs.

## How it works

### Login

`POST /api/auth/login` compares against `APP_AUTH_USERNAME` and a **bcrypt hash** in
`APP_AUTH_PASSWORD_HASH` via `Bun.password.verify` — no plaintext password exists anywhere
in the repository or the environment. Missing configuration is a startup-level error, not
a silent open door.

Failed attempts are rate-limited per client (5 per minute, keyed on
`cf-connecting-ip` → `x-forwarded-for` → `local`), and a successful login clears the
counter. The German error strings are deliberately identical for wrong user and wrong
password.

Credentials live in the operator's password manager. They are never in the repository,
in environment files, or in commit messages.

### Session

An HMAC-SHA256-signed cookie, `claims_ai_session`, 8-hour lifetime
(`apps/server/src/session.ts`). The payload is `{ username, expiresAt }`; the signature is
compared with `timingSafeEqual`. Cookie flags: `httpOnly`, `sameSite: "Strict"`, and
`secure` whenever `x-forwarded-proto` is `https` or `NODE_ENV=production`. There is no
server-side session store — the cookie is self-contained and simply expires.

`requireSession` sits in front of every `/api/*` route and answers 401 with
*"Bitte melden Sie sich an."* `GET /api/auth/session` is what the browser calls on boot;
`POST /api/auth/logout` clears the cookie.

Single user, single tenant. There are no roles, no user management, no registration.

### Boot and gate in the browser

`App.tsx` calls `api.session()` once. While that runs, `AppBootScreen` shows a brand mark
that fades in only after 200 ms — the check is usually done in a few milliseconds, and
something that appears and vanishes reads as a fault rather than as loading. Unauthenticated
users get `LoginPage`; the login card is the one deliberate exception to the
shadow-free surface contract, because it is the only object on an empty canvas.

### The demo-data warning

Every authenticated page carries `DemoDataWarning`: *"Nur Demo-Daten verwenden."* — no
real claim, customer, contract, health, or employee data, and a note that content is
stored locally and passed to the configured AI service. It is dismissible per browser
(`claims-ai.demo-data-warning…`), never per account.

### Public pages

Three routes render **without** the session gate, resolved before the authenticated router
in `App.tsx`:

| Route | Page |
| --- | --- |
| `/impressum` | operator details, plus the Geist font attribution |
| `/datenschutz` | privacy notice |
| `/nutzungshinweise` | usage notice |

`PublicFooter` links all three from both the public and the authenticated shell.

Their content is **not** hardcoded. `apps/server/src/public-site-information.ts` loads
`.local/public-site-information.json` (override with `PUBLIC_SITE_INFORMATION_PATH`) and
validates it with Zod: operator name, three-line service address, contact e-mail, VAT id,
register, supervisory authority, the competent data-protection authority with address,
e-mail and website, the retention statement, and `lastUpdated` as an ISO date. Nullable
fields are explicitly nullable — an absent VAT id is a stated `null`, never an empty
string. A missing file is a hard error naming the path.

`.local/` is gitignored, so operator details — a real address and e-mail — never enter the
repository. `bun run scripts/check-public-site-information.ts` validates the file
out-of-band before a deployment.

The reader-facing German artefacts belong to this domain too:
[`../operations/PRIVACY_NOTICE.de.md`](../operations/PRIVACY_NOTICE.de.md) and
[`../operations/OPERATOR_GUIDE.de.md`](../operations/OPERATOR_GUIDE.de.md).

## Where it lives

| Layer | Path |
| --- | --- |
| Server | `apps/server/src/session.ts`, `routes/auth.ts`, `public-site-information.ts`, `index.ts` (mounting `requireSession`) |
| Web | `apps/web/src/App.tsx`, `pages/login-page.tsx`, `imprint-page.tsx`, `privacy-page.tsx`, `usage-notice-page.tsx`; `components/app-boot-screen.tsx`, `demo-data-warning.tsx`, `public-footer.tsx`, `public-page-layout.tsx` |
| Config | `.local/public-site-information.json` (gitignored), env `APP_AUTH_USERNAME`, `APP_AUTH_PASSWORD_HASH`, `APP_SESSION_SECRET` (≥32 chars) |
| Scripts | `scripts/check-public-site-information.ts`, `scripts/check-environment.ts` |
| Tests | `tests/auth.test.ts`, `login-ui.test.ts`, `public-pages-ui.test.ts`, `public-site-information.test.ts`, `demo-data-warning.test.ts` |

## Implementation status

**Implemented.** Hashed credentials with rate limiting, the signed 8-hour session cookie
with strict flags and constant-time comparison, the blanket API gate, the boot screen, the
dismissible demo-data warning, and all three public pages driven by validated,
repository-external operator data. Five test files cover it.

## Constraints

- Credentials live in the operator's password manager — never in the repository,
  environment files, or commit messages. Agents must not read, request, or type the
  password; ask the operator to sign in and continue from the authenticated session.
- Operator details stay in `.local/`, out of version control.
- Every `/api/*` route is behind the session gate.
- The demo-data warning is present on every authenticated page.
- Public pages must render without a session.

## Open items

See [`../BACKLOG.md`](../BACKLOG.md).
