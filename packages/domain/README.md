# @fakturky/domain

Pure Czech invoicing logic (no DB, no framework). TypeScript source is exported directly (`exports` → `.ts`).

| Module | What |
|---|---|
| `money` | Decimal helpers, `formatCzk`, `formatMoney` |
| `vat` | rates, `vat_treatment` + legal texts, `computeDocumentTotals` |
| `numbering` | pattern format/parse, period key, variable symbol |
| `ico`, `dic`, `iban`, `czech-account`, `bank-codes` | identifiers & bank accounts |
| `qr/spayd`, `qr/epc`, `qr/render` | QR Platba (+QR Faktura), EPC SEPA, SVG |
| `dates` | Europe/Prague helpers |
| `integrations/{ares,cnb,vies}` | fetch-based clients with injectable `fetch` |
| `isdoc` | ISDOC 6.0.2 XML generator |

`pnpm test` runs Vitest; the ISDOC test validates against the official XSD in `test/fixtures` when `xmllint` is installed.
Regenerate bank codes: `pnpm gen:bank-codes` (downloads the ČNB CSV).
