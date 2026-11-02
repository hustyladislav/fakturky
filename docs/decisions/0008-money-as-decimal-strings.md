# 0008 — Money is `numeric` in the database and `Decimal` in code

- Date: 2026-11-01
- Status: accepted
- Decided by: founder

## Context
Czech VAT rules require amounts rounded per rate on the recap, in CZK even for foreign-currency documents. Binary floats produce
off-by-a-haléř totals on legal documents.

## Decision
Amounts are Postgres `numeric` and decimal strings across every boundary (API, MCP, CLI), computed with `Decimal` (decimal.js-light) in
`packages/domain`. VAT is computed per rate on the recap and rounded to 2 decimals. JS `number` is never used for money.

## Rejected
- **JS floats:** wrong totals on legal documents.

## Consequences
Every new money field needs a string schema and `Decimal` math; reviewers flag `number` amounts (`AGENTS.md` Code Review Rules).
