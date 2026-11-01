# @fakturky/domain

Pure Czech invoicing logic (no DB, no framework). TypeScript source is exported directly (`exports` → `.ts`).

| Module | What |
|---|---|
| `money` | Decimal helpers, `formatCzk`, `formatMoney` |
| `vat` | rates, `vat_treatment` + legal texts, `computeDocumentTotals` |
| `numbering` | pattern format/parse, period key, variable symbol |
| `ico`, `iban`, `czech-account`, `bank-codes` | identifiers & bank accounts |
| `qr/spayd`, `qr/render` | QR Platba (+QR Faktura), SVG |
| `dates` | Europe/Prague helpers |
| `integrations/ares` | ARES lookup by IČO (injectable `fetch`) |

Planned follow-ups: ČNB rates, VIES, EPC QR, ISDOC, DIČ validation.
