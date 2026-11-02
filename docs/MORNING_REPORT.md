# Morning report

Overnight build, 2026-11-01 22:00 → 2026-11-02 08:00. ~135 PRs merged, CI green (unit + e2e + a11y + security scans).

## TL;DR

A complete, free Czech invoicing app: invoices, proformas, credit notes, VAT payers and non-payers, foreign currency
with ČNB rates, QR Platba, PDF + public link + ISDOC, recurring invoices, e-mail & reminders, bank-statement import
with automatic payment pairing, VAT reports (DPH/KH/SH XML for EPO), Fakturoid import — plus a ⌘J AI assistant,
a remote MCP server, REST API and CLI over the same operations.

## Live

- Production: https://fakturky.vercel.app (Vercel Hobby `ladislav-5721`, fra1; Neon Postgres in Frankfurt)
- Repo: https://github.com/hustyladislav/fakturky (public; Codex auto-review; branch protection with required CI + e2e)

## Needs you (in priority order)

1. **Production is behind `main`.** Vercel Hobby allows 100 deploys / 24 h and we used them up at ~03:30 (every PR
   built a preview — now fixed: only `main` deploys, docs-only commits skip). Production still runs the 03:16 build;
   bank import, VAT reports, QA round 2 fixes and the final polish deploy automatically when the quota frees
   (~22:00). **To ship now:** upgrade the team to Pro ($20/mo), then push any commit to `main`.
2. **Domain** — pick one (`docs/research/names.md`; `fakturky.app` is free, $9.99/yr) and buy it or tell me to.
   Unblocks: magic-link & invoice e-mails to everyone (Resend sandbox today delivers to nobody, since your Resend
   team "moravio" is owned by another address), publishing the Google consent screen (today only you can use
   Google sign-in), and a nicer URL. I'll wire DNS, Resend, Google and Vercel in ~15 min.
3. **Try it with your real data** — Nastavení → Import (Fakturoid), then upload one real **Raiffeisen** CSV statement
   in Banka (bank parsers were built from documentation + synthetic fixtures), and check the DPH page once you're a
   payer. VAT report questions for you: `docs/research/vat-reports.md` (goods vs services per line, KH A.1 code).
4. **npm** (to publish the `fakturky` CLI) — create an npm granular token, add repo secret `NPM_TOKEN`, then
   `git tag cli-v0.1.0 && git push origin cli-v0.1.0`.
5. **AI Gateway credits** — assistant ≈ $0.01/conversation; caps $100/month (key + team budget) and $2/org/month.
   Hobby has a small free credit; top up in Vercel → AI Gateway if you open it to everyone.
6. **Preview database** (only matters after a Pro upgrade brings previews back) — previews share the production Neon
   DB; migrations are gated to production. Proper fix needs a Neon API key (`NEON_API_KEY`) — steps in
   `docs/SECURITY_AUDIT.md`.
7. Small: delete the unused Clerk app `fakturky-auth` on Vercel (say the word); optional Vercel Firewall rules
   (paths/limits in `docs/SECURITY_AUDIT.md`); your X/Twitter handle if you want it in the feedback links.

Already set for you: `CRON_SECRET`, `ENCRYPTION_KEY` (Fio tokens), `AI_GATEWAY_API_KEY`, Google OAuth client, Resend
key, Better Auth dashboard (dash.better-auth.com), branch protection, auto-merge.

## Try it

- App: https://fakturky.vercel.app (Google sign-in works for you; email+password for anyone)
- AI assistant: ⌘J inside the app
- MCP: `https://fakturky.vercel.app/mcp` — connect Claude/ChatGPT/Cursor per https://fakturky.vercel.app/docs/mcp
  (OAuth sign-in or an API key from Nastavení → API klíče)
- REST: https://fakturky.vercel.app/docs/api · CLI: `packages/cli` (until published) · https://fakturky.vercel.app/llms.txt
- Import your Fakturoid history: Nastavení → Import

## Screenshots (current `main`, local seed data)

| Invoice detail | Invoice on phone | Bank pairing |
|---|---|---|
| ![](screenshots/inv-Posplatnosti-1440-light.png) | ![](screenshots/inv-Posplatnosti-375-light.png) | ![](screenshots/bank-pair-1440-light.png) |
| **Banka** | **DPH** | **Nastavení** |
| ![](screenshots/bank-banka-1440-light.png) | ![](screenshots/dph-dph-1440-light.png) | ![](screenshots/settings-nastaveni-1440-light.png) |

## Shipped overnight

- Final polish #132–#137: styled Czech selects/file pickers, one primary action per invoice status + "Více" menu,
  Nastavení with sub-navigation and deep links, bank dialogs (currency select, Fio token steps), aligned pairing
  dialog, error/loading states with "Zkusit znovu", mobile access to Banka/DPH/Šablony.
- **VAT reports for payers** (/dph) #123/#125/#126/#127/#129: přiznání k DPH (DPHDP3), kontrolní hlášení (DPHKH1),
  souhrnné hlášení (DPHSHV) XML validated against the official XSDs, drill-down, warnings, manual input-VAT rows,
  EPO upload guide + disclaimer. Also via REST/MCP/CLI. Input side (received invoices) stays manual for now.
  Open questions for you (goods vs services per line, KH A.1 code per line, rounding) in `docs/research/vat-reports.md`.
- **Bank import + automatic payment pairing** (/banka) #122/#124/#128/#130/#131: Fio/Revolut/Raiffeisen/ČSOB/KB
  CSV (+ manual column mapping), ABO/GPC, CAMT.053; Fio API daily sync (token AES-encrypted, `ENCRYPTION_KEY` set);
  exact VS+amount auto-match, fuzzy suggestions, partial/overpayments, undo. **Please test with a real Raiffeisen
  CSV export** (parsers were built from docs + synthetic fixtures). Goes live with the next production deploy.
- **QA round 2** (issues #103–#114) fixed: invoices to consumers without IČO/DIČ #105, proforma VAT preview + PDF
  label #107, payment/date validation #111, contact country + VIES + EU reverse-charge check #116, credit-note
  PDF/balance #117, split-rate receipts #118, unique variable symbols + CLI `pdf -o` #119, related-document links +
  real dialogs instead of `window.prompt` #120; e2e for credit note / related docs / cron #121.
- TypeScript 7 (native compiler) across the monorepo #104 — no code changes needed; 307 unit + 15 e2e tests green.
- PWA (installable on phone) #100; performance pass with lazy-loaded heavy UI #93; a11y checks (axe) in e2e #101/#102.
- **Late night batch**: proforma → tax receipt for received advance → final invoice #94/#96; ČNB rate follows DUZP,
  CZK VAT amounts, rounding line #92/#98; document appearance (accent colour, logo, signature) #95; JSON export +
  e2e #97; VAT treatments per line instead of "0 %" #89/#91; legal QA fixes (registry note, required customer data
  for tax invoices, payment block on public page, 2 536 500 Kč warning) #82; number series settings #81;
  Fakturoid/CSV/ISDOC import #77; design QA passes #83/#85/#87/#90; e2e now a required check.
- **In-app assistant (⌘J)** #38/#68/#74: DeepSeek V4.1 Flash via AI Gateway (US inference, prompt training
  disallowed), every app action as a tool, approval cards for destructive actions, navigation tools, ⌘K "Zeptat se
  asistenta". Hard caps: $100/month global, $2/month per organization, per-user rate limit + gateway key/team
  budgets. Measured ≈ $0.01 per typical conversation. Note: zero-data-retention requires a paid Vercel plan
  (opt-in via `AI_ZERO_DATA_RETENTION=1`).
- **QA**: Playwright e2e of the full MVP journey (payer + non-payer) in CI #43; bug bash → issues #52–#66, fixes
  #34 #45 #67 #79 #80 (e.g. Czech-formatted amounts, DUZP default, mobile actions, Prague-time dates).
- Security audit done (`docs/SECURITY_AUDIT.md`): tenant-isolation suite over every procedure, CSRF/origin checks,
  CodeQL + gitleaks + OSV + dependency review in CI, `SECURITY.md`, Dependabot alerts on. Set `CRON_SECRET`
  (prod+preview) so recurring invoices/reminders run; branch protection on `main` (required `check` + `gitleaks`).
- Agent surfaces: API keys + `/docs/api` #17, remote MCP server `/mcp` (OAuth 2.1 + CIMD, API keys) #35,
  `fakturky` CLI #39, `/llms.txt` #40. Landing page + dashboard at `/prehled` #41.
- Invoice e-mail sending #44, overdue reminders + CSV export #48, security: nonce CSP/HSTS #42, auth hardening #50,
  lookup proxy rate limits + revocable public links #51.
- Fixed: production was being deployed from session worktrees via CLI (stale branches); Vercel Git integration now
  connected — production deploys only from `main`.
- Invoices end-to-end: documents core (drafts, issue with atomic numbering, payments, cancel) #20, invoice UI
  (list, form, detail) #25, PDF rendering #26, public invoice page `/f/:token` + ISDOC #29, dashboard #28.
- Onboarding with ARES autofill #19; Google sign-in + magic link (Resend sandbox) #23/#24; DB joins #27.
- App shell with ⌘K + shortcuts #22; logo, favicon, OG image #21; router → agent-tools adapter #18.
- Better Auth dashboard connected (dash.better-auth.com → project "Fakturky", free Starter plan): users, orgs,
  events, security insights (PR #14).

- Domain package: VAT totals, numbering, IČO/DIČ, Czech account → IBAN, bank codes, SPAYD + EPC QR, ARES, ČNB
  rates, VIES, ISDOC 6.0.2 (PRs #1, #3–#7).
- Monorepo foundation: TanStack Start, Tailwind v4 + shadcn, Drizzle + Neon, Better Auth, oRPC + REST/OpenAPI,
  contacts, CI (PR #2).

## Next up (proposed)

- Expenses / received invoices (would complete the VAT return input side), price list (ceník), estimates (nabídky).
- Slovak market (SK VAT, Pay by square, Peppol for the 2027 SK mandate).
- Leftovers: #61 (form flash while defaults load), occasional flaky a11y e2e on the dark ⌘K check.

## Decisions made

- Design: council picked direction A (calm editorial) + B's shell + C's mobile flow → `docs/DESIGN.md`.
- Name: "Fakturky" kept as working name (council split; hotovo.* domains taken). Rename = one constant.
- Auth: Better Auth (Clerk tried, reverted on your request).
- Assistant model: DeepSeek V4.1 Flash (newer than the V4 you named), US inference, prompt training disallowed; no EU
  host serves it; zero-data-retention needs a paid Vercel plan.
- Deploys: only `main` via Git; PRs verified by CI + local e2e (Hobby deploy quota).
