# Decision log

The few decisions that shape the system and that the code can't explain by
itself. It is not a changelog: keep it short enough to read in one sitting.

**Log it** only when it is one of:
- Architecture: how the system is split, where work runs, the data model, tenancy.
- Infrastructure and environments: hosting, database, CI, deploys, migrations, local dev.
- A backend vendor or a core toolchain piece (runtime, package manager, compiler, linter).
- A platform-wide rule on money, security or legal exposure.
- Frontend only when it is cross-cutting (security headers, i18n, auth), never one screen.

**Don't log** a feature default, a tuning number, UI layout or copy, prompt or
creative craft, one agent's configuration, or agent/editor tooling (skills,
plugins, settings). Put the why in a one-line comment at the code or in the
commit message. In doubt, leave it out. How to calibrate: [examples.md](examples.md).

- Name: `NNNN-short-slug.md`, numbered in order (`0001-…`). Numbers are never
  reused, so gaps are expected.
- Never rewrite an accepted entry. When a decision changes, add a new one and
  set the old one's status to `superseded by NNNN`.
- Code that embodies a decision points here (`// see docs/decisions/0007`)
  instead of explaining the history inline.

## Template

```markdown
# NNNN — Title in a few words

- Date: YYYY-MM-DD
- Status: accepted | superseded by NNNN
- Decided by: founder | team

## Context
What forced a choice. Two or three sentences.

## Decision
What we do.

## Rejected
The alternatives we considered, and why each one lost.

## Consequences
What this costs us or locks in; when to revisit.
```

## Index

- [0001 — Agent-first repository setup](0001-agent-first-repo.md)
- [0002 — Neon Postgres, Drizzle, PGlite for local and tests](0002-neon-postgres-drizzle-pglite.md)
- [0003 — Better Auth for authentication and tenancy](0003-better-auth.md)
- [0004 — One oRPC router is the single operation layer](0004-one-orpc-router-single-operation-layer.md)
- [0005 — Production deploys only from `main`; no PR previews](0005-production-deploys-only-from-main.md)
- [0006 — Database migrations run only on production builds](0006-migrations-only-on-production-builds.md)
- [0007 — TanStack Start (React, Vite, Nitro) on Vercel](0007-tanstack-start-on-vercel.md)
- [0008 — Money is `numeric` in the database and `Decimal` in code](0008-money-as-decimal-strings.md)
- [0009 — In-app assistant via Vercel AI Gateway with hard spend caps](0009-assistant-vercel-ai-gateway-hard-spend-caps.md)
