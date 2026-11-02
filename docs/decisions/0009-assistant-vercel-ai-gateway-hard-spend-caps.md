# 0009 — In-app assistant via Vercel AI Gateway with hard spend caps

- Date: 2026-11-01
- Status: accepted
- Decided by: founder

## Context
The app is free and funded by donations, yet offers an LLM assistant that can act on users' invoicing data. Uncapped model spend or a
leaky prompt would cost money or expose data.

## Decision
The assistant runs through Vercel AI Gateway (`AI_GATEWAY_API_KEY`); the model is a server-side constant with fallbacks, never client-chosen.
Before every request the server enforces, in order: global month-to-date budget (`AI_MONTHLY_BUDGET_USD`, 100), per-organization monthly cap
(`AI_ORG_MONTHLY_USD`, 2), per-user rate limits, `maxSteps` and `maxOutputTokens`, using costs recorded in `ai_usage`. A Gateway team budget is a second,
independent backstop. Tools come from the oRPC router and run as the signed-in user; destructive tools need UI approval; prompt training is disallowed.

## Rejected
- **Soft limits or alerts only:** a loop or abuse could spend the budget before anyone looks.

## Consequences
When a cap is hit the assistant switches off with a Czech message while the rest of the app works. Zero data retention is opt-in
(`AI_ZERO_DATA_RETENTION=1`) because it needs a paid Vercel plan. Model choice details: `docs/ARCHITECTURE.md`.
