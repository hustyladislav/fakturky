# Delivery: branches, PRs, CI, deploys, versions

How work gets from a branch to production. Open this before you push, open a PR, add a dependency or pick a model.

## Ship small, continuously
- One focused change per PR with tests; ship a rough working slice and iterate rather than a big-bang branch. Conventional Commits (`feat:`, `fix:`, `chore:` …).
- Branch from the latest `main`. Never commit to `main` directly except trivial docs fixes.
- Before pushing: `pnpm check` (biome + typecheck + unit tests) must pass. Run `pnpm e2e` for risky paths and whenever you touch CI or scripts.
- Write the PR body with the `pr` skill and pass it via `--body-file`; after every push to a branch with an open PR, rewrite the body so it describes the PR as it stands.
- Arm auto-merge (`gh pr merge <n> --auto --squash`) once the PR is ready; it merges when the required checks pass and the branch is up to date.
- If the branch is behind, `gh pr update-branch <n>`. With several PRs queued, land them **one at a time** — parallel updates restart each other's CI and nothing merges.
- Resolve conflicts by rebasing onto `main`, then rerun `pnpm check` and `pnpm e2e` before pushing again.

## CI and branch protection
- CI runs on PRs and `main` only. Required checks on `main`: `check` (lint · typecheck · unit · build), `e2e` (Playwright on the embedded PGlite DB and a mock ARES, no secrets), `gitleaks` (job in `security.yml`). Branches must be up to date. Branch protection and auto-merge are already configured on the repo.
- Docs-only changes (Markdown, `.claude/**`, `.agents/**`) report `check` and `e2e` as a pass with nothing run.
- `security.yml` also runs CodeQL, OSV-Scanner and dependency review; Dependabot groups updates and waits 7 days before adopting a release.
- A red `main` blocks everyone: whoever merged last fixes it first. Never merge with `--admin` to skip checks.
- Automated review (Codex) comments on every PR; fix valid P0/P1 findings before merging, reply with evidence when a finding doesn't hold.

## Deploys
- Production deploys **only** from `main` via the Vercel Git integration. Never run `vercel deploy --prod` (or `vercel --prod`) from a local checkout or worktree — it ships an unmerged branch.
- Vercel Hobby allows 100 deployments/day. `vercel.json` therefore builds nothing but `main` (`ignoreCommand`), skips docs-only and tooling-only commits on `main`, and disables Git deployments for `claude/*`, `dependabot/*` and `worktree-*`. There are no PR previews: verify PRs with CI + `pnpm e2e`, and verify on production by merging and waiting for the Git deployment of `main`.
- Database migrations run only for production builds — see [environment.md](environment.md).
- Why: [0005](../decisions/0005-production-deploys-only-from-main.md), [0006](../decisions/0006-migrations-only-on-production-builds.md).

## Versions and models
- Before adding or upgrading a dependency: `npm view <pkg> version`, read the changelog for breaking changes, use exact versions from the root `package.json` / pnpm catalog. Don't add dependencies casually; prefer the platform.
- Before choosing an AI model: query `https://ai-gateway.vercel.sh/v1/models` live. Training data is outdated by definition — a newer model than the one requested usually exists; say so.

## Working with sub-agents
- The orchestrating session plans, reviews and merges; implementation goes to cheaper models (e.g. Sonnet at medium effort), mechanical chores (branch updates, screenshots, renames) to the cheapest (e.g. Haiku).
- Give each sub-agent explicit file ownership so parallel agents never edit the same files; one agent owns the app shell/layout.
- Every sub-agent's report is a claim, not proof: check the PR, the CI run and a screenshot before telling the user it's done.
