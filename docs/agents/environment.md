# Environment: hosting, env vars, database, migrations

- **Hosting:** Vercel Hobby, project `fakturky`, functions in `fra1` (TanStack Start → Nitro → Vercel). Production deploys only from `main` via Git; Hobby allows 100 deployments/day, so PR branches and docs-only commits never build (see [delivery.md](delivery.md)). Never run `vercel --prod`.
- **Database:** Neon Postgres (Vercel Marketplace), `aws-eu-central-1` Frankfurt, Drizzle ORM. **Previews would share the production database** (no Neon branching on the free plan) — treat any non-local `DATABASE_URL` as production. Local dev and tests use embedded **PGlite** (`apps/web/.data/pglite`) when `DATABASE_URL` is unset — never point local tooling at the Neon URL casually.
- **Migrations:** `pnpm db:generate` (drizzle-kit), commit the SQL. `pnpm db:migrate` runs in the Vercel build command and only does work for `VERCEL_ENV=production` builds. Any script that deletes or overwrites data must call `assertDestructiveAllowed()` from `@fakturky/db`, which needs `ALLOW_DESTRUCTIVE_DB=1`.
- **Env vars:** managed in Vercel (`vercel env pull` for local); `.env*` is git-ignored except `.env.example`. Never print values — check whether a variable is set. Names (see `.env.example` for defaults and comments):
  - Database: `DATABASE_URL`, `DATABASE_URL_UNPOOLED` (migrations), `PGLITE_DIR`
  - Auth: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
  - Email: `RESEND_API_KEY`, `EMAIL_FROM` (feature-flagged on the key)
  - Cron: `CRON_SECRET` (min 16 chars; Vercel Cron sends it as the bearer token)
  - Bank sync: `ENCRYPTION_KEY` (32 random bytes base64; encrypts stored Fio tokens; losing it means users re-paste tokens)
  - Assistant: `AI_GATEWAY_API_KEY`, `AI_MONTHLY_BUDGET_USD`, `AI_ORG_MONTHLY_USD`, `AI_USER_PER_MINUTE`, `AI_USER_PER_HOUR`, `AI_ZERO_DATA_RETENTION`
  - Tests/tools: `E2E_PORT`, `E2E_BASE_URL`, `ARES_BASE_URL`, `SEED_URL`
- **Cron:** Vercel Cron, daily: `/api/cron/recurring` (05:00), `/api/cron/reminders` (06:00), `/api/cron/bank-sync` (04:00), authenticated by `CRON_SECRET` (constant-time compare, fails closed).
- **Storage:** Vercel Blob (private) for logos, signatures and cached PDFs.
- **Why:** [0002](../decisions/0002-neon-postgres-drizzle-pglite.md), [0005](../decisions/0005-production-deploys-only-from-main.md), [0006](../decisions/0006-migrations-only-on-production-builds.md).
