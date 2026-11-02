# 0002 — Neon Postgres, Drizzle, PGlite for local and tests

- Date: 2026-11-01
- Status: accepted
- Decided by: founder

## Context
Invoices are legal records that need transactions (atomic numbering at issue), `numeric` money and relational integrity.
The app runs on Vercel functions near Czech users, and tests and agent worktrees must not touch production data.

## Decision
Postgres on Neon (Vercel Marketplace), `aws-eu-central-1` Frankfurt, next to the `fra1` functions and for EU data residency.
Drizzle ORM with committed drizzle-kit SQL migrations. The same schema runs on embedded PGlite for local dev (no `DATABASE_URL`),
unit tests and e2e, so no test or worktree needs a real database or secrets.

## Rejected (to confirm by the owner)
- **A shared dev/preview database on Neon:** the free plan has no branching, so any shared database is effectively production (see [0006](0006-migrations-only-on-production-builds.md)).
- **A different local database than production's engine:** tests would not exercise the real SQL, numbering transaction or `numeric` behaviour.

## Consequences
Postgres features are fine only if they also work on PGlite. Revisit when a paid plan allows per-PR Neon branches.
