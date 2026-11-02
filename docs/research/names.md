# Fakturky: domain shortlist

Date: 2026-11-01. Availability via RDAP (404 = free, 200 = registered). Nothing was purchased or registered.

Notes on the checks:
- `.eu` RDAP (`rdap.eurid.eu`) was unreachable for every name (curl exit 000, including the base URL), so all `.eu` results are `?`. `.eu` was not used to exclude any name.
- Several `.cz` checks returned HTTP 503 on the first pass. Re-checks returned 200 (registered) for kvitko, fakturko, fakturomat, fakturex, splneno, vyridime and 404 (free) for splatit. The 404 for splatit is a surprise and was re-checked once; it is still treated as free, but confirm at the registrar.
- `faktura.com` returned 000 on the first pass and 200 on re-check.
- Re-checked surprising 404s (vyfakt on all three TLDs, vystavto.com, ucetka.com, zaplatime.com, vyridime.com, fakturky.app): the 404s held.
- Vercel `domains price` returned the same figures for every `.app` (purchase $9.99, renewal $15, 1 year). These are quotes only; availability is confirmed at purchase.
- Vercel does not appear to sell `.cz`. Register `.cz` through a Czech registrar (e.g. Wedos or Forpsi), roughly 200-300 Kc/yr.

## Full candidate table

| name | meaning / connotation (CZ & SK) | .cz | .app | .eu | .com | price notes | conflicts |
|---|---|---|---|---|---|---|---|
| fakturky | diminutive of "faktura" (little invoices), playful | taken | free | ? | taken | $9.99 / $15 renewal (.app) | Current working name; .cz and .com are taken |
| fakturka | "little invoice" diminutive | taken | taken | ? | taken | n/a (no free .cz/.app) | not checked |
| hotovo | "done" / "it's paid" | taken | taken | ? | taken | n/a | not checked |
| splatno | "payable / due" (splatnost) | taken | free | ? | taken | $9.99 / $15 (.app) | not checked (generic term) |
| zaplaceno | "paid" (invoice status) | taken | free | ? | taken | $9.99 / $15 (.app) | No product found; generic invoice status word |
| vyfakturuj | imperative "invoice it" | taken | free | ? | taken | $9.99 / $15 (.app) | **Conflict: vyfakturuj.cz is an established Czech invoicing service** (reviews, Make/Base.com integrations). Avoid |
| faktix | invented, "faktura" + x | taken | taken | ? | taken | n/a | not checked |
| faktik | invented, "faktura" + -ik | taken | taken | ? | taken | n/a | not checked |
| fakturio | invented, "faktura" + io | taken | taken | ? | taken | n/a | not checked |
| uhrazeno | "settled / paid" (formal invoice term) | taken | free | ? | taken | $9.99 / $15 (.app) | No product found; formal, long |
| doklady | "documents" (accounting/tax docs) | taken | free | ? | taken | $9.99 / $15 (.app) | Generic; several Czech/SK apps use "doklad" |
| kvitko | diminutive of "kvitance" (receipt); also CZ "kvitko" can read as "little flower" | taken (on re-check) | free | ? | taken | $9.99 / $15 (.app) | Mild meaning clash (CZ "kvítko" = little flower) |
| penize | "money" | taken | taken | ? | taken | n/a | not checked |
| hotovka | "cash" (colloquial) | taken | free | ? | taken | $9.99 / $15 (.app) | Generic term for cash; implies cash-only |
| splatka | "installment" | taken | free | ? | taken | $9.99 / $15 (.app) | Connotes debt/installments, not a positive "done" |
| faktury | "invoices" (plural) | taken | taken | ? | taken | n/a | not checked |
| fakturace | "invoicing" (noun) | taken | taken | ? | taken | n/a | not checked |
| vystavto | from "vystav to" ("issue it"), playful | taken | free | ? | free | $9.99 / $15 (.app) | No product found; ambiguous to read |
| fakturnik | invented, "invoicer" (agent noun) | taken | free | ? | taken | $9.99 / $15 (.app) | No product found |
| ucetka | colloquial "accountant (f.)" | taken | free | ? | free | $9.99 / $15 (.app) | Reads as a person (accountant), not a tool |
| faktura | "invoice" (generic) | taken | taken | ? | taken | n/a | Generic word; many products use it |
| fakturo | invented, "faktura" + o | taken | taken | ? | taken | n/a | not checked |
| fakturko | diminutive | taken (on re-check) | taken | ? | taken | n/a | not checked |
| fakturomat | "invoice machine" (playful) | taken (on re-check) | taken | ? | taken | n/a | not checked |
| fakturator | invented, "invoicer" | taken | taken | ? | taken | n/a | Generic; "faktura" + -tor |
| fakturex | invented, "faktura" + "ex" | taken (on re-check) | free | ? | taken | $9.99 / $15 (.app) | Confusable with the Factur-X e-invoicing standard and a "Faktura" SaaS |
| zaplatime | "we'll pay" (CZ) | taken | free | ? | free | $9.99 / $15 (.app) | No product found |
| splneno | "fulfilled / done" | taken (on re-check) | free | ? | taken | $9.99 / $15 (.app) | Meaning ambiguous; not clearly "paid" |
| vyridime | "we'll handle it" (CZ) | taken (on re-check) | free | ? | free | $9.99 / $15 (.app) | No product found |
| uctenka | "receipt" (SK/CZ účtenka); not an invoice | taken | taken | ? | taken | n/a | not checked |
| pokladna | "cash register / cash desk" | taken | free | ? | taken | $9.99 / $15 (.app) | Generic term used by many accounting products |
| penezenka | "wallet" | taken | free | ? | taken | $9.99 / $15 (.app) | Generic; crypto/payment wallet associations |
| mince | "coins" | taken | taken | ? | taken | n/a | not checked |
| zisk | "profit" | taken | taken | ? | taken | n/a | not checked |
| platba | "payment" | taken | free | ? | taken | $9.99 / $15 (.app) | Generic; payment-processor associations |
| ucetnik | "accountant" (m.) | taken | free | ? | taken | $9.99 / $15 (.app) | Reads as a person, not a tool |
| vyfakt | short form of "vyfakturovat" (to invoice) | free | free | ? | free | $9.99 / $15 (.app); .cz via registrar ~200-300 Kc/yr | **Close to vyfakturuj.cz** (same root, same product area); brand-confusion risk |
| fakto | invented, "fakt" / "fact" | taken | taken | ? | taken | n/a | not checked |
| bilance | "balance" (accounting) | taken | taken | ? | taken | n/a | not checked |
| splatit | "to pay off / repay" (CZ) | free (on re-check) | free | ? | taken | $9.99 / $15 (.app); .cz via registrar ~200-300 Kc/yr | Verb, connotes repaying debt; no product found |

Names with no free `.cz` or `.app` were excluded from pricing, and conflicts were not searched for them (they are taken on both, and `.eu` could not be checked).

## Conflict searches (web search "<name> faktura")

- **vyfakturuj**: conflict. Vyfakturuj.cz is an active Czech invoicing service with reviews (testado.cz, arecenze.cz) and integrations (Make, Boost.space, Base.com, Freelo).
- **vyfakt**: same product area as vyfakturuj.cz. Search results repeatedly show vyfakturuj.cz, so the root is heavily associated with that brand. Not a trademark-level hit from the search, but a practical confusion risk.
- **fakturex**: no Czech product found; similar-sounding names: Factur-X (EU e-invoicing standard) and generic "Faktura" invoicing software.
- **kvitko**: no product found; Ivan Kvitka (unrelated person) appears in results.
- **splatit / splatka / splatno**: generic Czech/Slovak finance terms (splatnost); no product found.
- **zaplaceno / uhrazeno / zaplatime / vyridime / splneno / vystavto**: no product named after the word found; generic invoice status vocabulary.
- **doklady, pokladna, penezenka, platba, ucetnik, hotovka, ucetka**: generic words used across many products; no single product owns them in search results.
- **fakturnik / fakturky**: no product found under these exact names (search returned only generic "faktura" material).

Search results are not a trademark search. Check the EUIPO and the Czech industrial property register (UPV) before any final decision.

## Top 5

1. **vyfakt**: free on `.cz`, `.app` and `.com` (the only shortlisted name free on all three), short, easy to say in CZ and SK. Main risk is confusion with vyfakturuj.cz, which is an established competitor in the same space.
2. **zaplatime**: free on `.app` and `.com`, positive "we'll pay" tone that fits a payment-focused invoicing app. `.cz` is taken, so a Czech-market plan would need an alternative `.cz` or the `.com`.
3. **vyridime**: free on `.app` and `.com`, positive "we'll handle it" tone and no product found. `.cz` is taken on re-check.
4. **splatit**: the only other name free on `.cz` (after re-check) plus `.app`. Meaning leans toward repaying debt, so it works less well for a paid-invoice product.
5. **zaplaceno**: strongest "paid" connotation (matches the invoice status concept), free on `.app` only, `.com` and `.cz` taken; a weaker domain position.

Current working name **fakturky**: `.app` is free at $9.99 but `.cz` and `.com` are taken, so it is weaker than the Top 5 for a Czech-market launch.
