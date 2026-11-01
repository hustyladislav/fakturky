# AGENTS.md

Free, open-source Czech invoicing app (web + REST + MCP + CLI). Read before working:
`docs/ARCHITECTURE.md` (system design), `docs/DOMAIN.md` (Czech invoicing rules), `docs/PRODUCT.md` (scope),
`docs/DESIGN.md` (design system, once it exists).

## Ground rules

- **Code, comments, commits, docs: English. User-facing UI copy: Czech** (natural Czech, correct diacritics),
  kept in `apps/web/src/i18n/cs.ts`. Never hardcode the product name — import `BRAND` from `@fakturky/core/brand`.
- Every capability is an oRPC procedure in `packages/core/src/router`. If you add a feature, add/extend the
  procedure, then UI. REST, MCP and CLI pick it up from the router metadata — check they do.
- Money is `Decimal` (decimal.js-light) / `numeric` strings. Never `number` for amounts.
- Every query is scoped by `organizationId`. No exceptions; add a tenant-isolation test for new repositories.
- **Always use the latest stable versions — verify, never assume.** Before adding or upgrading a dependency run
  `npm view <pkg> version` (and read its changelog for breaking changes); before choosing an AI model, query
  `https://ai-gateway.vercel.sh/v1/models` live. Your training data is outdated by definition.
- Use exact versions from the root `package.json`/catalog. Do not add dependencies casually; prefer the platform.
- Small, focused PRs with tests. Conventional Commits (`feat:`, `fix:`, `chore:` …).
- Before pushing: `pnpm check` (biome + typecheck + tests) must pass.

## Commands

```bash
pnpm install
pnpm dev            # web app on http://localhost:3000
pnpm check          # lint + typecheck + unit tests
pnpm test           # vitest
pnpm e2e            # playwright
pnpm db:generate    # drizzle-kit generate (commit the SQL)
pnpm db:migrate     # apply migrations (DATABASE_URL_UNPOOLED)
```

## Code Review Rules

### Correctness

- Money math must use `Decimal`; VAT computed per rate on the recap, rounded to 2 decimals (see `docs/DOMAIN.md`).
- Document numbers are allocated only at issue, inside a transaction; never reused.
- Issued documents use snapshots; edits to contacts/profile must not alter issued documents.

### Security

- Every DB access is scoped by `organizationId` from the authenticated context — flag any query that is not.
- Inputs validated with Zod at the procedure boundary; outputs never leak other tenants' data or secrets.
- Public endpoints (`/f/:token`, ARES proxy) must not expose private notes, internal IDs of other entities, or allow enumeration.
- No secrets, tokens or PII in logs, error messages, or client bundles.

### Product

- UI strings in Czech and in `i18n/cs.ts`; no English leaking into the UI.
- New features must be reachable from UI, REST, MCP and CLI.
