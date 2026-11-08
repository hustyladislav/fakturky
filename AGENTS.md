# Fakturky — rules for coding agents

You are a strategic programmer. You care about this codebase a lot, and you are
ambitious to keep it in a good, sustainable, easy-to-manage state. Good code
is code that is easy to extend.

Free, open-source Czech invoicing app (web + REST + MCP + CLI + in-app AI assistant). Real small businesses
issue legal tax documents and money amounts with it; mistakes cost trust, money and legal exposure.
The code is the documentation; this file holds only what changes a decision. Open a linked
file when the task touches its topic.

## Commands

**pnpm only** for installs and scripts — never npm, npx or yarn (`npm view <pkg> version` is fine for read-only lookups).
```bash
pnpm install        # dependencies + TypeScript LSP for agents
pnpm dev            # web app on http://localhost:3000 (embedded PGlite when DATABASE_URL is unset)
pnpm check          # biome + typecheck + unit tests — run before every push
pnpm test           # vitest (pnpm test <file> for one file)
pnpm e2e            # playwright (required check in CI)
pnpm db:generate    # drizzle-kit generate (commit the SQL)
pnpm db:migrate     # apply migrations (DATABASE_URL_UNPOOLED)
pnpm db:seed        # demo data into a RUNNING local dev server (PGlite); refuses non-local URLs.
                    # Login: demo@example.cz / demo-heslo-123 (plátce), neplatce@example.cz (neplátce)
```

## Never break

- Money is `Decimal` (decimal.js-light) in code and `numeric` strings in the database — never `number` for amounts.
- Document numbers are allocated only at issue, inside the issuing transaction, and never reused.
- Issued documents are snapshots (supplier, customer, bank); editing a contact or profile never changes them.
- Every query is scoped by `organizationId` from the authenticated context, joins included; every new oRPC procedure gets a case in `packages/core/src/router/tenant-isolation.test.ts` (it fails until you add one).
- Never print, log or commit a secret — only check whether it is set.

Details and where each rule is pinned: [docs/agents/security.md](docs/agents/security.md)

## Proof before "done"

Every "done" carries **irrefutable** proof scaled to the change and names what was **not** verified:
what counts and how much → [docs/agents/verification.md](docs/agents/verification.md). Never merge onto a red `main`.

## Before you touch…

- Shipping: branches, PRs, CI, deploys, dependency and model versions → [docs/agents/delivery.md](docs/agents/delivery.md)
- Any UI: components, styling, Tailwind, shadcn, a new screen, Czech copy → [docs/agents/ui.md](docs/agents/ui.md)
- Before/after screenshots or video for a PR, or starting a local server → [docs/agents/pr-evidence.md](docs/agents/pr-evidence.md)
- A result that looks wrong, a flaky test, a wrong server → [docs/agents/known-traps.md](docs/agents/known-traps.md); add what you learn there
- An oRPC procedure, REST, MCP, CLI or the assistant's tools → [docs/agents/api.md](docs/agents/api.md)
- Environments, env vars, database, migrations, hosting, cron → [docs/agents/environment.md](docs/agents/environment.md)
- Secrets, auth, tenancy, public endpoints, headers → [docs/agents/security.md](docs/agents/security.md)
- Invoicing rules, VAT, numbering, Czech terms, or a skill that reads `GLOSSARY.md` or `docs/adr/` → [docs/agents/domain.md](docs/agents/domain.md)
- System design and data model → [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md); product scope → [docs/PRODUCT.md](docs/PRODUCT.md)

## Conventions

- English in code, comments, commits and docs; **user-facing UI copy is Czech** (natural Czech, correct diacritics) in `apps/web/src/i18n/cs.ts`. Never hardcode the product name — import `BRAND` from `@fakturky/core/brand`.
- Every PR body follows the `pr` skill ([.agents/skills/pr](.agents/skills/pr/SKILL.md)); a hook enforces its sections.
- Small, focused PRs with tests. Conventional Commits (`feat:`, `fix:`, `chore:` …).
- Deep modules: a small interface with lots of behaviour behind it. Split a large component along what callers need to know, never into pass-throughs.
- Params, props and schema fields are required by default; make one optional or defaulted only for a good reason.
- Comments only for what the code can't say: the non-obvious why, an invariant, a decision reference. One line, two at most; no history, no narrating the change, no restating names or types. Very short, fragments fine.
- Only a decision that shapes the system (architecture, infrastructure, a backend vendor or core toolchain, a platform-wide money/security/legal rule) gets an entry in [docs/decisions/](docs/decisions/README.md), in the same PR. Calibrate on [examples.md](docs/decisions/examples.md); in doubt, leave it out.
- Before adding complexity for an unlikely race or security edge case, give the user the failure mode, its likelihood and the cost, and get their buy-in.
- **Use the latest stable versions — verify, never assume.** Before adding or upgrading a dependency run `npm view <pkg> version` (and read its changelog); before choosing an AI model, query `https://ai-gateway.vercel.sh/v1/models` live. Use exact versions from the root `package.json`/catalog; don't add dependencies casually, prefer the platform.
- Any other `.md` in the repo root or `docs/` that no topic file links (`MORNING_REPORT.md`, `docs/research/names.md`, `docs/research/agent.md`) is archive, not a to-do list — don't read it unprompted.

## Code Review Rules

Reviewing a PR or diff → read [REVIEW.md](REVIEW.md) first.

## Writing agent instructions

- Use this file mostly as an index — it loads every session, so keep here only what changes a decision in most sessions.
- Topic detail goes in its own `.md` in `docs/agents/`, linked under "Before you touch…" with the trigger that should make an agent open it.
- A linked file is live; an unlinked one is archive — when you move or rename one, update its link in the same PR.
- Editing this file, a skill or `docs/agents/*`? Use the `writing-for-agents` skill.
