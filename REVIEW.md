# Review

Review like the senior who owns this code next year. Few comments, each one worth a fix. [AGENTS.md](AGENTS.md) still applies; this file adds only what changes a review.

## Block (P0/P1)

- **Money**: amounts are `Decimal`; VAT computed per rate on the recap, rounded to 2 decimals ([DOMAIN.md](docs/DOMAIN.md)).
- **Numbering**: allocated only at issue, inside the transaction, never reused.
- **Snapshots**: edits to contacts or profile leave issued documents unchanged.
- **Tenancy**: every DB access is scoped by `organizationId` from the authenticated context, joins included.
- **Boundary**: inputs validated with Zod at the procedure; outputs carry no other tenant's data or secrets.
- **Public endpoints** (`/f/:token`, ARES proxy): no private notes, no internal ids of other entities, no enumeration.
- **Secrets**: none in logs, errors or client bundles.
- **False success**: a result says saved, sent or paid when nothing changed.
- **Regression**: say whether `main` already behaves this way. Pre-existing → note it, don't block.

## Product

- UI strings Czech, in `i18n/cs.ts`.
- A new feature is reachable from UI, REST, MCP and CLI: one oRPC procedure with `meta.mcp` ([api.md](docs/agents/api.md)).

## Shape

- **Deep modules**: small interface, lots of behaviour behind it. Flag a new pass-through with the deletion test: delete it, does complexity vanish or spread to callers?
- **Real seams**: one adapter is a hypothetical seam. Ask for it to be inlined.
- **Test the interface**: tests cross the same seam callers do. A test that reaches past it means the module is the wrong shape.
- **Fix once**: the same bug at N call sites wants one deeper module, not N patches.
- **Lesson as structure**: a mistake that can recur gets a test or lint that goes red on it, not a comment.
- **Domain words**: names come from the glossary in [domain.md](docs/agents/domain.md).

## Skip

- An unlikely race or edge case: one comment with failure mode, likelihood and cost; not blocking.
- Anything `pnpm check` catches.
- `pnpm-lock.yaml`, archive `.md` files.

## Comment

One finding per comment: the concrete input, what breaks, the fix. No praise, no diff summary.
