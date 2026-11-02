# 0003 — Better Auth for authentication and tenancy

- Date: 2026-11-01
- Status: accepted
- Decided by: founder

## Context
The app needs email+password, passkeys, Google, organizations as tenants (one user, several businesses, an accountant later),
API keys for REST/CLI and an OAuth server for MCP clients.

## Decision
Better Auth with the organization, passkey, API-key, OAuth-provider and CIMD plugins. Auth tables live in our own Postgres, so an
organization is a plain row we join and scope by (`organization_id`). Web uses session cookies, REST/CLI use `fk_…` API keys, MCP uses OAuth 2.1 or API keys.

## Rejected
- **Clerk (Vercel Marketplace):** adopted in the docs, then reverted the same day on the founder's request. Its Organizations would have
  held tenants and members outside our database. A Clerk app (`fakturky-auth`) still exists on Vercel, unused.

## Consequences
We own the user and organization tables and their migrations. Better Auth packages are pinned together in the pnpm catalog.
Mandatory e-mail verification waits for an owned sending domain (`docs/SECURITY_AUDIT.md` F13).
