# 0004 — One oRPC router is the single operation layer

- Date: 2026-11-01
- Status: accepted
- Decided by: founder

## Context
The product promise is that everything a user can do in the UI is also available over REST, MCP, the CLI and the in-app assistant.
Separate implementations per surface drift, and each would need its own tenant scoping and validation.

## Decision
Every capability is an oRPC procedure in `packages/core/src/<feature>/router.ts` (composed in `router/index.ts`), defined once with Zod input/output and `meta` (`mcp`, `openapi`).
The web UI, REST (`/api/v1`), MCP (`/mcp`), the CLI and the assistant's tools are adapters that read the router and its metadata.
Auth, organization scoping and validation belong to the procedure, not the adapter. Working rules: `docs/agents/api.md`.

## Rejected (to confirm by the owner)
- **A separate implementation per surface** (REST handlers, MCP tools, UI-only server functions): guaranteed drift; "done" would need four implementations.

## Consequences
A procedure without metadata is invisible to agents and REST; a procedure without a tenant-isolation case fails the suite.
The router is a public API (REST paths, MCP tool names), so renames need care.
