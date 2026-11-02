# 0006 — Database migrations run only on production builds

- Date: 2026-11-02
- Status: accepted
- Decided by: founder

## Context
Preview, development and production Vercel environments all point at the same Neon database (no branching on the free plan).
A preview build running migrations could change production's schema from an unmerged branch.

## Decision
The Vercel build command runs `pnpm db:migrate` first, and the migrate CLI does nothing unless `VERCEL_ENV=production`. Scripts that delete or
overwrite data call `assertDestructiveAllowed()` from `@fakturky/db` (needs `ALLOW_DESTRUCTIVE_DB=1`). Migrations are generated locally and committed.

## Rejected
- **Migrate on every build:** a preview could break production.

## Consequences
Migrations must stay compatible with the previous production build during a deploy. A real preview database (Neon API key, branch per
preview) is the owner-side follow-up in `docs/SECURITY_AUDIT.md` (F1).
