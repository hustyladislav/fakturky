# Domain Docs

How the engineering skills consume this repo's domain documentation. Single-context: one domain doc, one decision log.

## Before exploring, read these

- **[`docs/DOMAIN.md`](../DOMAIN.md)**: Czech invoicing rules (VAT, document types, numbering, dates, bank accounts, QR codes, integrations, exports, retention). Source of truth for `packages/domain`; open it before touching money, VAT, numbering, dates or a legal text. VAT reports (DPH/KH/SH XML): [`docs/research/vat-reports.md`](../research/vat-reports.md).
- **[`docs/ARCHITECTURE.md`](../ARCHITECTURE.md)** for the data model and request flow; **[`docs/PRODUCT.md`](../PRODUCT.md)** for scope (what is in v1, what is later).
- **[`docs/decisions/`](../decisions/README.md)**: this repo's ADRs. Read the entries that touch the area you're about to work in (the README index has one line each).

`GLOSSARY.md` at the repo root does not exist yet — the glossary below is the vocabulary until `/domain-modeling` creates it. **Proceed silently** if it is absent.

## ADRs are `docs/decisions/` entries

Wherever a skill says `docs/adr/` or "ADR", use `docs/decisions/` and its [README](../decisions/README.md): its bar for what gets logged (stricter than the skill's ADR format: agent tooling, feature defaults and tuning stay out), its template, `NNNN-slug.md` numbering after the highest existing number, the index line, and superseding instead of rewriting. Calibrate on [examples.md](../decisions/examples.md); in doubt, leave it out.

## Glossary (Czech terms used in code, data and UI)

| Term | Meaning |
|---|---|
| OSVČ | Self-employed person (sole trader); the main user |
| IČO / DIČ / IČ DPH | Company id / tax id / Slovak VAT id. IČO has a mod-11 checksum |
| ARES | Czech business register; looked up by IČO or name (server-side proxy) |
| VIES | EU VAT id validation service |
| Plátce DPH / neplátce / identifikovaná osoba | VAT payer / non-payer / identified person (`vat_status`: `payer`, `non_payer`, `identified_person`) |
| DUZP | Datum uskutečnění zdanitelného plnění — taxable supply date (`taxable_date`); drives the ČNB rate and VAT period |
| Faktura / daňový doklad | Invoice / tax document (payers: "Faktura – daňový doklad") |
| Zálohová faktura (proforma) | Advance invoice, not a tax document; paid → daňový doklad k přijaté platbě (payment receipt) → final invoice |
| Opravný (daňový) doklad / dobropis | Credit note, references the original; negative amounts |
| Storno | Cancellation of an unpaid invoice (status `cancelled`, number kept) |
| Nabídka | Estimate (later) |
| Vystavit | Issue: allocates the number and freezes the snapshot |
| Koncept | Draft (no number) |
| Po splatnosti / Zaplacená / Neuhrazená | Overdue / paid / unpaid |
| Odběratel / Dodavatel | Customer / supplier |
| Rekapitulace DPH | VAT recap per rate (base, VAT, total) |
| Přenesená daňová povinnost (§92a), reverse charge | Reverse charge; zero-VAT lines use a `vat_treatment`, there is no "0 %" rate |
| Přiznání k DPH, Kontrolní hlášení, Souhrnné hlášení | VAT return (DPHDP3), control statement (DPHKH1), recapitulative statement (DPHSHV), EPO XML |
| VS / KS / SS | Variable / constant / specific symbol on a Czech bank payment; VS defaults to the digits of the document number |
| QR Platba (SPAYD) / EPC QR | Czech / SEPA payment QR |
| ČNB | Czech National Bank; daily exchange rates |
| ISDOC | Czech e-invoice XML format (6.0.2), accountants import it |
| Fio, Raiffeisenbank, ČSOB, KB | Banks whose statements are parsed; Fio also has a token API |
| Obrat | Turnover (the VAT-registration limit tracker; never "Tržby") |
| Kup mi kávu | The donation link; never on success screens or modals |

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined above. UI copy follows the Czech wording rules in [ui.md](ui.md).

If the concept you need isn't in the glossary yet, that's a signal: either you're inventing language the project doesn't use (reconsider) or there's a real gap (add it here).

## Flag decision conflicts

If your output contradicts an accepted decision, surface it explicitly rather than silently overriding:

> _Contradicts 0003 (Better Auth), but worth reopening because…_
