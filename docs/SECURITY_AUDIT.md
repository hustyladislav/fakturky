# Security audit — 2026-11-02

Scope: the whole repository at `main` (web app, oRPC router and repositories, Better Auth configuration, public
invoice pages, PDF/ISDOC routes, ARES/ČNB lookups, REST `/api/v1`, MCP `/mcp`, cron, CI) plus the Vercel
project configuration reachable with the CLI. Method: code review against the rules in `AGENTS.md`, new
automated tests, live checks against a Vercel preview deployment, secret scanning of history and of the built
client bundle.

Severity is the impact if exploited on production data. "Owner" means it needs a dashboard setting or a
decision that code cannot make.

## Findings

| # | Finding | Severity | Status | Reference |
|---|---|---|---|---|
| F1 | Preview and Production deployments use the **same Neon database** (all `POSTGRES_*`/`DATABASE_URL*` variables are scoped to Production, Preview and Development). Any preview build, including ones from PR branches, reads and writes production data and runs migrations against it. | High | **Open — owner** | see Recommendations |
| F2 | No brute-force protection on auth: Better Auth rate limits were off outside production and memory-backed (useless on serverless). | High | Fixed | #50 |
| F3 | Dependencies with advisories: `ws` 8.18.3 (GHSA-96hv-2xvq-fx4p 7.5, GHSA-58qx-3vcg-4xpx), `minimatch` (GHSA-g3hv-75wg-m249), plus dev-only `esbuild` 0.18 and `deepmerge`. | High (`ws`), Low (rest) | Fixed / accepted with expiry in `osv-scanner.toml` | #36 |
| F4 | No security headers at all (CSP, framing, referrer, permissions; HSTS came only from Vercel's edge). | Medium | Fixed | #42 |
| F5 | `/docs/api` loaded the Scalar bundle from a CDN with no integrity check, **same origin as the app**: a compromised CDN or package would run with the visitor's session. | Medium | Fixed (SRI pin, hash-pinned inline script, dedicated CSP) | #42 |
| F6 | Adding a TanStack Start `start.ts` silently disables the framework's CSRF protection for server functions (found by the Codex review of #42). `/api/rpc` and `/api/v1` accepted cookie-authenticated mutations without an origin check. | Medium | Fixed (CSRF middleware re-added and widened to the cookie-authenticated API; API-key requests exempt) | #42 |
| F7 | ARES / ČNB proxies callable without limit by any signed-in user; `getRate` fans out up to 7 upstream requests per call. | Medium | Fixed (TTL cache + in-flight de-dup + 30/min per organization). SSRF: not possible, hosts are constants, IČO is checksum-validated, currency/date are length/regex-bound (test proves nothing is fetched for URL-smuggling input) | #51 |
| F8 | A leaked public invoice link (`/f/:token`) could not be revoked. | Medium | Fixed (`documents.rotateLink`: REST, MCP, UI button; old token dies immediately) | #51 |
| F9 | `CRON_SECRET` is **not set in Production**, so `/api/cron/recurring` always answers 401 (fails closed, but recurring invoices and reminders never run). | Medium (availability) | **Open — owner** | |
| F10 | Cron secret compared with `!==` (timing side channel). | Low | Fixed (SHA-256 + `timingSafeEqual`, secrets shorter than 16 chars never authorise) | #50 |
| F11 | `.gitignore` contained committed merge-conflict markers. | Low | Fixed | #32 |
| F12 | `documents.list` joined `contact` without the organization predicate (safe only because the FK is validated on write). | Info (defense in depth) | Fixed | #33 |
| F13 | Sign-up reveals whether an e-mail address is registered (`USER_ALREADY_EXISTS`). Closing it needs mandatory e-mail verification, which waits for an owned sending domain on Resend. Mitigated by the new sign-up rate limit. | Low | Open | |
| F14 | API keys are full-access for the organization; no read-only or per-resource scopes. Keys are hashed at rest, revocable, per-key rate limited (600/min) and bound to one organization (tested). | Medium (blast radius of a leaked key) | Open — recommendation | |
| F15 | API-key principals use the organization id as `userId`, so the audit log `actorId` of API actions is the organization, not a person or key id. | Info | Open | |
| F16 | BotID is not wired into sign-up / sign-in. | Info | Open — needs the Vercel dashboard (BotID) plus a client init | |
| F17 | `[magic-link] email: url` is logged when `RESEND_API_KEY` is missing and `NODE_ENV !== 'production'`. Vercel always sets production, so this is local-dev only, but a self-hosted staging without the flag would log live sign-in links. | Low | Open | |
| F18 | `@better-auth/infra` `dash()` is installed (#14, deliberate). With `BETTER_AUTH_API_KEY` set it reports auth events to the Better Auth dashboard (third party) and exposes `/api/auth/dash/*` guarded by that key (probed: 401). | Info | Accepted by owner; privacy policy should name the processor | |

### Checked and found sound

- **Tenant isolation.** Every repository function takes `orgId`; every foreign-key reference supplied by a
  caller (contact, bank account, document, template, rule) is re-checked inside the organization. New suite
  `packages/core/src/router/tenant-isolation.test.ts` replays org A's ids as org B against **every**
  procedure and fails when a procedure has no case, so new procedures (MCP, agent, other agents' work)
  cannot ship without coverage. No cross-tenant leak was found.
- **Public invoice page.** Token is 24 random bytes (192 bit, base64url), unique, only on issued documents,
  lookups reject drafts and soft-deleted rows. The payload is an explicit allow-list asserted key by key
  (no private note, no internal ids, no customer e-mail/phone). Pages are `noindex`, `no-store`, and send
  `Referrer-Policy: no-referrer`.
- **PDF / ISDOC routes.** Authenticated variants are organization-scoped procedures; public variants go
  through the token path. Unknown tokens render the not-found view and are covered by tests.
- **API keys.** Stored hashed (SHA-256 by the plugin), prefix `fk_`, an explicit key wins over ambient
  cookies, an invalid key never falls back to the session, deletion is immediate, another organization's
  member can neither mint nor delete keys for it.
- **OAuth proxy** is only registered when `VERCEL_ENV === 'preview'`.
- **Secrets.** `gitleaks detect` over all history: clean (also runs in CI). No env values, connection
  strings or key material in `apps/web/.output/public`. `.env*` ignored. No PII in server logs besides F17.
- **Cookies.** Secure on https, HttpOnly, SameSite=Lax (tested); sessions 14 days, refreshed daily, 15-minute
  freshness for sensitive changes; password reset revokes sessions.

### Verified live (Vercel preview, CLI)

- Headers on `/prihlaseni`, `/f/:token`, static assets and `/api/*`: HSTS, `nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy`, COOP, `Permissions-Policy`; nonce CSP on HTML; `/docs/api` serves its own CSP.
- 7 wrong sign-ins from one IP: 401 x5, then 429.
- Cross-site POST to `/api/rpc` → 403; invalid API key → 401; cron without secret → 401; `/mcp` GET → 405.

## What changed in CI

`.github/workflows/security.yml` (actions pinned by commit SHA, least-privilege tokens): CodeQL
(`security-extended`), gitleaks over full history, OSV-Scanner on the lockfile, dependency review on PRs,
weekly schedule. Dependabot groups version updates, keeps security updates in their own PRs and waits 7 days
before adopting a release. `SECURITY.md` points to private GitHub vulnerability reporting (enabled).

## Residual risks

- Rate limits for ARES/ČNB lookups are per serverless instance (best effort); the hard limit must come from
  the Vercel Firewall.
- Public endpoints (`/f/:token`, `/f/:token/pdf`) have no per-IP limit in code. A holder of a valid token can
  trigger PDF rendering repeatedly (CPU cost, not data exposure).
- CSP keeps `style-src 'unsafe-inline'` (React style attributes, sonner). Script execution is nonce-based with
  `strict-dynamic`.
- The OSV scan relies on OSV-Scanner reading pnpm 12's two-document lockfile. It currently does (759
  packages, findings reported); re-check the package count in the log after scanner upgrades.
- Merges raced once (a procedure added while the isolation suite was merging turned `main` red). Branch
  protection with "require branches to be up to date" would prevent it.

## Recommendations (owner)

1. **Separate the Preview database (F1).** Create a Neon branch/database for Preview and scope the
   `DATABASE_URL*`/`POSTGRES_*` variables to it (Vercel ↔ Neon integration supports preview branches).
   Until then treat every preview deployment as production.
2. **Set `CRON_SECRET` in Production (F9)**: a random value of at least 16 characters (`openssl rand -hex 32`).
   Vercel Cron then sends it as the bearer token automatically.
3. **Vercel Firewall rules** (Project → Firewall → Rules), all "Rate limit" unless noted:
   - `/api/auth/*`: 60 req/min per IP (the app already enforces tighter per-endpoint limits).
   - `/api/rpc/*` and `/api/v1/*`: 300 req/min per IP; `/mcp`: 120 req/min per IP.
   - `/f/*`: 60 req/min per IP; `/f/*/pdf` and `/api/documents/*/pdf`: 10 req/min per IP.
   - Turn on the managed **Bot Protection** ruleset in "log" first, then "challenge"; keep **Attack Challenge
     Mode** ready for incidents.
4. **BotID** on `POST /api/auth/sign-up/email` and `/api/auth/sign-in/*` once enabled in the project.
5. **Branch protection on `main`**: require the `check`, `CodeQL`, `OSV-Scanner`, `gitleaks` and
   `Dependency review` checks and up-to-date branches. Dependabot alerts and security updates were enabled
   during this audit.
6. When an owned domain exists: add it to HSTS preload (`preload` directive + submission), turn on mandatory
   e-mail verification (closes F13), and update `trustedOrigins`.
7. API key permissions (F14): use the api-key plugin's `permissions` to offer read-only keys and record the key
   id as the actor in the activity log (F15).
8. Name Better Auth (dashboard telemetry) and Resend in the privacy policy, or remove `dash()` (F18).
