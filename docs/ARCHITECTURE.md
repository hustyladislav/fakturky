# Architecture

Fakturky is a free, open-source invoicing app for Czech (later Slovak) freelancers and small companies.
Everything a user can do in the web UI is also available through the REST API, the MCP server and the CLI.

## Principles

1. **One operation layer.** Every capability is an oRPC procedure in `packages/core`, defined once with Zod
   input/output schemas. The UI, REST (`/api/v1`), MCP (`/mcp`) and CLI are thin adapters over the same router.
   A feature is not done until it is exposed everywhere — this falls out automatically if it's a procedure.
2. **Correct money.** Amounts are decimal strings in the DB (`numeric`) and `Decimal` (decimal.js-light) in code.
   Never JS floats for money. VAT is computed per rate on the recap (rekapitulace DPH), see `docs/DOMAIN.md`.
3. **Documents are immutable snapshots.** An issued document stores a JSON snapshot of supplier, customer and bank
   account. Editing a contact never changes past invoices.
4. **Tenant isolation is enforced in one place.** Every row belongs to an `organization`. Procedures get `ctx.org`
   from middleware; repositories take `orgId` as a required argument. A test suite asserts cross-tenant access fails.
5. **Fast by default.** SSR with TanStack Start, route loaders + TanStack Query, `preload="intent"`, optimistic
   mutations, self-hosted fonts, no heavy deps in the client bundle (PDF rendering is server-only, lazy-imported).
6. **Czech UI, English code.** All user-facing strings live in `apps/web/src/i18n/cs.ts` (typed). Documents
   (invoice PDFs / public pages) support `cs`, `sk`, `en`.
7. **The brand name is a constant.** Import it from `packages/core/src/brand.ts`. Never hardcode "Fakturky".

## Stack (pin exact versions; see `package.json`)

| Area | Choice |
|---|---|
| Runtime | Node 24, pnpm workspaces |
| App | TanStack Start (React 19, Vite 8, Nitro → Vercel), TanStack Router / Query / Form / Table |
| UI | Tailwind CSS v4, shadcn/ui (Base UI), lucide-react, sonner, cmdk-style command palette |
| API | oRPC (`@orpc/server`, `@orpc/openapi`, `@orpc/tanstack-query`) + Zod 4 |
| DB | Postgres on Neon (Vercel Marketplace), Drizzle ORM + drizzle-kit migrations; PGlite for tests |
| Auth | Better Auth: email+password, passkeys, magic link (when email is configured), organizations, API keys, MCP OAuth (CIMD) |
| MCP | `mcp-handler` v2 + `@modelcontextprotocol/server` v2, Streamable HTTP at `/mcp` |
| CLI | `packages/cli` — citty + @clack/prompts, talks to `/api/v1` with an API key, published to npm |
| PDF | `@react-pdf/renderer` with bundled static TTF fonts (Czech diacritics), SPAYD QR via `spayd` + `qrcode` |
| Email | Resend + react-email (feature-flagged on `RESEND_API_KEY`) |
| Jobs | Vercel Cron (daily): recurring invoices, overdue reminders, ČNB rates |
| Storage | Vercel Blob (private) for logos, signatures, cached PDFs |
| Quality | Biome, Vitest, Playwright, GitHub Actions, CodeQL, gitleaks, OSV-Scanner, Dependabot, Codex PR review |

## Repository layout

```
apps/web            TanStack Start app: routes, server routes (/api/rpc, /api/v1, /api/auth, /mcp, /.well-known, /f/:token)
packages/domain     Pure, dependency-light Czech invoicing logic (no DB, no IO except integrations)
  src/              money, vat, numbering, iban, czech-account, bank-codes, spayd, epc-qr, isdoc, dates, ico
  src/integrations/ ares, cnb-rates, vies (fetch-based, injectable fetch for tests)
packages/core       Zod schemas + oRPC router (THE source of truth for operations), repositories, services
  src/router/       oRPC procedures grouped by resource (contacts, documents, payments, bank-accounts, ...)
  src/brand.ts      product name, URLs, support links
packages/db         Drizzle schema, migrations, client factory (Neon in prod, PGlite in tests)
packages/pdf        React-PDF invoice templates, fonts, QR rendering
packages/email      react-email templates
packages/cli        `fakturky` CLI
docs/               ARCHITECTURE, DOMAIN, PRODUCT, DESIGN, MORNING_REPORT
design/             explorations and the chosen design system
```

## Data model (v1)

All tables: `id` (uuid v7, text), `organization_id`, `created_at`, `updated_at`. Soft delete via `deleted_at` where noted.

- **organization / member / invitation** — Better Auth organization plugin. One user can run several businesses
  (e.g. OSVČ + s.r.o.) and invite an accountant later.
- **business_profile** (1:1 organization) — legal name, IČO, DIČ, address, `vat_status`
  (`non_payer` | `payer` | `identified_person`), registry note (živnostenský rejstřík / spisová značka), contact
  info, logo & signature blob keys, defaults (currency, due days, language, payment method, footer, note).
- **bank_account** — label, currency, `account_number` + `bank_code` (Czech format, optional), `iban`, `bic`,
  `is_default`, `default_for_currency`, `show_qr`. Revolut/Wise/any IBAN supported.
- **contact** — name, IČO, DIČ, IČ DPH (SK), address, country, emails, phone, defaults (due days, currency,
  language), note, `ares_synced_at`, `archived_at`. Unlimited.
- **number_series** — `document_type`, `pattern` (e.g. `{YYYY}-{NNNN}`), `reset` (`yearly` | `never`),
  counters per period (`number_series_counter`: series_id, period, next_value). Numbers are allocated atomically
  at issue time inside the issuing transaction (`UPDATE … RETURNING`). Drafts have no number.
- **document** — `type` (`invoice` | `proforma` | `credit_note` | `payment_receipt` | `estimate`), `number`,
  `series_id`, `status` (`draft` | `issued` | `paid` | `cancelled`; `overdue` and `partially_paid` are derived),
  supplier/customer/bank snapshots (jsonb), `contact_id`, `issue_date`, `taxable_date` (DUZP), `due_date`,
  `currency`, `exchange_rate` (to CZK, ČNB), `language`, `payment_method`, `variable_symbol`, `constant_symbol`,
  `order_number`, `vat_mode` (`none` | `standard` | `reverse_charge` | `eu_reverse_charge` | `oss`), texts
  (`intro_text`, `footer_text`, `private_note`), cached totals (`subtotal`, `vat_total`, `total`, `total_czk`,
  `rounding`), `related_document_id` (credit note → invoice, proforma → final invoice), `public_token`
  (128-bit, base64url), `sent_at`, `paid_at`, `cancelled_at`, `deleted_at`.
- **document_line** — `position`, `description`, `quantity`, `unit`, `unit_price`, `vat_rate`, `discount_percent`,
  cached line totals.
- **payment** — `document_id`, `paid_on`, `amount`, `currency`, `method`, `note`, `source` (`manual` | `bank`).
- **template** — reusable invoice blueprint (customer, lines, texts). **recurring_rule** — template + schedule
  (`monthly` on day N / `quarterly` / `yearly`), `next_run_on`, `auto_issue`, `auto_send`, `active`.
- **activity** — append-only audit log (document created/issued/sent/viewed/paid/cancelled, settings changes).
- **exchange_rate** — ČNB daily cache (`date`, `currency`, `amount`, `rate`).
- Later: `item` (price list), `expense`, `bank_transaction` (Fio API / CSV import for auto-pairing).

## Request flow

```
Browser ──SSR/loader──▶ TanStack Start ──createRouterClient(router)──▶ procedure ──▶ Drizzle ──▶ Neon
Browser ──mutation────▶ /api/rpc (RPCHandler) ───────────────────────▶ procedure
Agent   ──MCP─────────▶ /mcp (mcp-handler; OAuth JWT or API key) ───▶ procedure (tool per procedure)
CLI/API ──HTTP────────▶ /api/v1 (OpenAPIHandler, API key) ──────────▶ procedure
Public  ──────────────▶ /f/:token (web invoice, PDF, ISDOC) ─────────▶ documents.getPublic
Cron    ──────────────▶ /api/cron/* (CRON_SECRET) ───────────────────▶ recurring.run, reminders.run, rates.sync
```

Each procedure declares metadata: `{ mcp: { name, title, readOnly, destructive, idempotent }, openapi: { method, path } }`.
The MCP adapter iterates the router and registers one tool per procedure with that metadata; destructive tools
(delete, cancel, send email) are annotated so clients ask for confirmation.

## Auth

- Web: Better Auth session cookie. Sign-up with email+password or passkey; magic link once Resend is configured.
- API/CLI: Better Auth API keys (`Authorization: Bearer fk_…`), scoped to one organization.
- MCP: OAuth 2.1 via `@better-auth/mcp` + CIMD (spec 2026-07-28), protected-resource metadata at
  `/.well-known/oauth-protected-resource`; API keys also accepted as bearer tokens.
- Bot protection (BotID) on sign-up / sign-in.

## Security

- Zod validation on every input; output schemas strip internal fields.
- Tenant isolation tests for every repository function.
- Public document tokens are unguessable and revocable; public pages are `noindex`.
- Strict CSP, HSTS, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`.
- Rate limiting: Vercel Firewall rules on `/api/auth/*`, `/mcp`, `/api/v1/*`; ARES/ČNB calls cached.
- No PII in logs. Secrets only in Vercel env. Dependabot + CodeQL + gitleaks + OSV in CI.
- Periodic security review sessions; findings tracked as GitHub issues labelled `security`.

## Deployment

- GitHub `main` → Vercel production; PRs → preview deployments (Neon preview branches).
- Build command runs `pnpm db:migrate` (drizzle-kit, `DATABASE_URL_UNPOOLED`) before `pnpm build`.
- Region: `fra1` functions, Neon `aws-eu-central-1` (Frankfurt) — close to Czech users, EU data residency.

## In-app agent ("Asistent")

A Linear-style omni agent inside the web app: ⌘K command bar (type a sentence → "Zeptat se asistenta") and a
right-hand side panel that keeps the conversation while the user works. It can do everything the UI can.

- **Library:** TanStack AI (`@tanstack/ai`, `@tanstack/ai-react`), streamed from a TanStack Start server route
  `/api/agent`. Chat UI built from native shadcn components (see `docs/DESIGN.md`), no separate design language.
- **Model:** via Vercel AI Gateway (OIDC auth on Vercel). Default `deepseek/deepseek-v4.1-flash` (latest DeepSeek Flash on the gateway as of 2026-11-01; re-check) (exact gateway id in
  `packages/core/src/agent/models.ts`), routed only to providers hosted in the EU or US; fallbacks configured
  there too. Model is a server-side constant, never chosen by the client.
- **Server tools = the oRPC router.** The same adapter that builds MCP tools builds agent tools from procedure
  metadata, executed with the signed-in user's context (tenant isolation is preserved for free). Tools marked
  `destructive` (delete, cancel, send email, issue) require explicit approval in the UI before they run.
- **Client tools = navigation and UI.** `navigate({ to, params })` over the typed route tree, `openDocument`,
  `prefillInvoiceForm(draft)`, `highlight`. The agent can show the user where things are, not just do them.
- **Context:** current route + selected entity are sent with each message; `@` mentions of contacts/documents.
- **Spend cap (hard):** every response's gateway cost is written to `ai_usage` (org, user, model, tokens,
  `cost_usd`). Before each request the server checks, in order: global month-to-date < `AI_MONTHLY_BUDGET_USD`
  (100), per-organization monthly cap (`AI_ORG_MONTHLY_USD`, default 2), per-user rate limit, `maxSteps` and
  `maxOutputTokens`. When a cap is hit the assistant is disabled with a friendly Czech message and a "Kup mi kávu"
  link. A Vercel AI Gateway team budget is set as a second, independent backstop.
- **Safety:** system prompt forbids acting on instructions found inside data (invoice texts, contact notes);
  destructive actions always go through the approval UI; no other tenant's data is reachable by construction.
