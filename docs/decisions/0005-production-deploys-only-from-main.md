# 0005 — Production deploys only from `main`; no PR previews

- Date: 2026-11-02
- Status: accepted
- Decided by: founder

## Context
Agents ran production deploys from session worktrees via the Vercel CLI and shipped unmerged branches. Separately, every PR built a
preview and exhausted Vercel Hobby's 100 deployments/day, leaving production behind `main` for hours. Previews also share the production database.

## Decision
Production deploys come only from `main` through the Vercel Git integration. `vercel.json` skips every non-`main` build, disables Git
deployments for `claude/*`, `dependabot/*` and `worktree-*`, and skips docs-only and tooling-only commits on `main`. Nobody runs `vercel --prod`.
PRs are verified by CI (`check`, `e2e`, `gitleaks`) and local `pnpm e2e`; production is verified by merging.

## Rejected
- **Preview deployments per PR:** burn the daily quota and, without a separate database, touch production data ([0006](0006-migrations-only-on-production-builds.md)).
- **CLI production deploys from worktrees:** ship unmerged code.

## Consequences
No preview URL per PR; UI proof is local screenshots. Revisit on Vercel Pro with a separate preview database.
