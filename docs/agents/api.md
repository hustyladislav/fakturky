# API: one oRPC router, every surface

Every capability is an oRPC procedure in `packages/core/src/<feature>/router.ts`, defined once with Zod input/output. The web UI
(`/api/rpc` + SSR loaders), REST (`/api/v1`, OpenAPI), MCP (`/mcp`), the `fakturky` CLI and the in-app assistant's
tools are adapters over that router. Why: [0004](../decisions/0004-one-orpc-router-single-operation-layer.md).
Open this file before adding or changing a procedure, an endpoint, an MCP tool or a CLI command.

## Adding a capability
1. Add or extend the procedure with `procedure({ mcp, openapi })` from `packages/core/src/orpc.ts`; types in `packages/core/src/meta.ts`. A feature is one folder in `packages/core/src` (`router.ts`, `repo.ts`, `schema.ts`, tests); a new one is registered in `router/index.ts`. Never write a UI-only server function for something a user or agent can do.
2. **`meta.mcp` is mandatory** for anything an agent can usefully call: `name` (snake_case, unique), `title`, optional `description` for the model, and `readOnly` / `destructive` / `idempotent`. Mark delete, cancel, send-email and issue as `destructive` — MCP clients and the assistant then ask for approval.
3. Add `meta.openapi` (`method`, `path`, `summary`, `tags`) for REST; the CLI talks to `/api/v1`, so add the command in `packages/cli` when it makes sense.
4. **Czech label:** add `cs.assistant.tools.<mcp.name>` in `apps/web/src/i18n/cs.ts` (what the assistant panel shows while the tool runs, e.g. "Hledám kontakty"); `tool-labels.test.ts` fails without it.
5. **Tenant-isolation case:** add one in `packages/core/src/router/tenant-isolation.test.ts` — the suite fails until you do ([security.md](security.md)).
6. Validate every input with Zod at the boundary; output schemas strip internal fields. Money in and out is a decimal string. A business rule that says no throws `DomainError` (`packages/core/src/errors.ts`) from the repo; `procedure` turns it into the oRPC error, so handlers call the repo bare.
7. Add unit tests next to the procedure; for new user flows extend `apps/web/e2e`.
8. Then the UI. Check that REST, MCP, CLI and the assistant picked the procedure up from the metadata.

## Surfaces
- **UI/REST/CLI:** `/api/rpc`, `/api/v1` (API key or session), `/docs/api` (OpenAPI/Scalar).
- **MCP:** `mcp-handler` at `/mcp`; one tool per procedure that has `meta.mcp`; OAuth 2.1 (CIMD) or API key.
- **Assistant:** `/api/agent`; tools are built from the same metadata and run with the signed-in user's context. Model, caps and budget: [0009](../decisions/0009-assistant-vercel-ai-gateway-hard-spend-caps.md).
- **Cron:** `/api/cron/*` authorises and runs one job from `packages/core/src/jobs.ts` — scheduled work across organizations lives there, never in the route.
- **Public:** `/f/:token` goes through the `publicRouter` (`packages/core/src/public/router.ts`) only; no authenticated surface may leak into it.
