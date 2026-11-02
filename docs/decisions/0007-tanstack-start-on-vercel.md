# 0007 — TanStack Start (React, Vite, Nitro) on Vercel

- Date: 2026-11-01
- Status: accepted
- Decided by: founder

## Context
The app is an SSR, keyboard-first product with typed routes that also hosts API routes (`/api/rpc`, `/api/v1`, `/mcp`, `/f/:token`, cron)
and must stay fast on mobile. Hosting is Vercel with Git deploys.

## Decision
TanStack Start (React 19, Vite, Nitro → Vercel output) with TanStack Router/Query, in a pnpm workspace monorepo (`apps/web`, `packages/*`) on Node 24.
One deployable hosts UI and API routes in `fra1`.

## Rejected
- **A separate API service:** a second deployment (and deploy quota) for no benefit at this size; the oRPC router is hosted by the same app ([0004](0004-one-orpc-router-single-operation-layer.md)).

## Consequences
A custom `start.ts` replaces TanStack Start's own CSRF protection, so the origin-check middleware there must stay (`docs/agents/security.md`).
The framework moves quickly: pin exact versions and read changelogs before upgrading.
