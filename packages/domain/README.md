# @fakturky/domain

Pure Czech invoicing logic (no DB, no framework). TypeScript source is exported directly (`exports` → `.ts`).

| Module | What |
|---|---|
| `money` | Decimal helpers, `formatCzk`, `formatMoney` |
| `vat` | rates, `vat_treatment` + legal texts, `computeDocumentTotals` |
| `numbering` | pattern format/parse, period key, variable symbol |
| `ico`, `iban`, `czech-account`, `bank-codes` | identifiers & bank accounts |
| `qr/spayd`, `qr/epc`, `qr/render` | QR Platba (+QR Faktura), SVG |
| `dic` | CZ/SK/EU VAT ID validation |
| `dates` | Europe/Prague helpers |
| `isdoc` | ISDOC 6.0.2 XML export (validated against the official XSD) |
| `integrations/ares` | ARES lookup by IČO (injectable `fetch`) |
| `integrations/vies` | VIES VAT number check |
| `integrations/cnb` | ČNB daily rates, `getRate` with weekend/holiday fallback |

Planned follow-up: ARES search by name.
