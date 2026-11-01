# Morning report

Running log of the overnight build (2026-11-01 → 11-02). Newest at the top of each section.

## Live

- Production: https://fakturky.vercel.app (Vercel Hobby `ladislav-5721`, region fra1, Neon Postgres in Frankfurt)
- Repo: https://github.com/hustyladislav/fakturky (public; Vercel GitHub app installed; Codex auto-review on)

## Needs you

1. **Domain** — pick a name/domain from `docs/research/names.md` (shortlist) and buy it; then I wire it to Vercel
   and provision Resend (`mail.<domain>`, EU region) for invoice emails and magic links.
2. **AI Gateway credits** — the assistant uses DeepSeek V4.1 Flash via Vercel AI Gateway. Caps are set ($100/month
   on the key + $100/month team budget). Hobby includes a small free monthly credit; beyond that, top up credits
   in the Vercel dashboard (AI Gateway → Credits) if you want it running for everyone.
3. **Clerk app** — an unused, empty Clerk app `fakturky-auth` exists on your Vercel team (we went back to Better
   Auth). Say the word and I'll delete it.
4. **Google sign-in** (optional) — needs a Google Cloud OAuth client; until then email+password and passkeys.

## Shipped overnight

- Domain package: VAT totals, numbering, IČO/DIČ, Czech account → IBAN, bank codes, SPAYD + EPC QR, ARES, ČNB
  rates, VIES, ISDOC 6.0.2 (PRs #1, #3–#7).
- Monorepo foundation: TanStack Start, Tailwind v4 + shadcn, Drizzle + Neon, Better Auth, oRPC + REST/OpenAPI,
  contacts, CI (PR #2).

## In progress

- `invoices` — bank accounts, invoice create/issue/PDF/paid, public link, dashboard
- `agents` — API keys, MCP server, CLI, llms.txt
- `shell` — design system, navigation, ⌘K, landing page
- `pdf` — invoice PDF rendering
- `scaffold` — onboarding + Better Auth dashboard plugin

## Decisions made

- Design: council picked direction A (calm editorial) + B's shell + C's mobile flow → `docs/DESIGN.md`.
- Name: "Fakturky" kept as working name (council split; hotovo.* domains taken). Rename = one constant.
- Auth: Better Auth (Clerk tried, reverted on your request).
- Assistant model: DeepSeek V4.1 Flash (newer than V4), US-hosted, zero data retention; no EU host exists for it.
