# Domain rules (Czech invoicing)

Source of truth for `packages/domain`. Researched 2026-11-01; law = zákon 235/2004 Sb. (DPH),
563/1991 Sb. (účetnictví), občanský zákoník §435. Items marked (verify) need a re-check before relying on them.

## Who issues what

- **Neplátce DPH** (non-VAT payer): no VAT anywhere, no VAT recap. Document title "Faktura". Print
  "Neplátce DPH" under supplier. Must show name, address, IČO, and the registry note — for sole traders the
  convention is "Fyzická osoba zapsaná v živnostenském rejstříku." (derived from OZ §435), for companies
  "Zapsáno v obchodním rejstříku vedeném <soud>, oddíl X, vložka Y."
- **Plátce DPH** (VAT payer): "Faktura – daňový doklad". Required by §29(1): supplier+customer name, address,
  DIČ; number; subject of supply; issue date; DUZP; unit price without VAT; discount; base; rate; VAT amount
  **in CZK**. Issue within 15 days of DUZP.
- **Identifikovaná osoba** (§6g): has a DIČ, no domestic VAT; treat like non-payer domestically.
- Registration threshold: turnover 2 000 000 Kč per calendar year (immediate obligation above 2 536 500 Kč).
  Show a turnover tracker on the dashboard for non-payers (sum of `total_czk` of paid+issued invoices in the
  calendar year, by DUZP/issue date).

## VAT

- CZ rates: **21 %** and **12 %** only. There is no "0 %" rate — model zero-VAT lines with a `vat_treatment`:
  `exempt` (osvobozeno, needs § reference), `reverse_charge` (§92a, text "Daň odvede zákazník"),
  `eu_reverse_charge` (služba/zboží do EU, text per §29(2) / "reverse charge" + customer VAT ID),
  `export`, `outside_scope`. Each prints its legal text on the document.
- Line VAT modes: prices entered **without VAT** (default) or **with VAT** (per document toggle).
- Compute VAT on the recap per rate: `base_r = Σ line bases at rate r`, `vat_r = round2(base_r × r)`.
  Total = Σ(base_r + vat_r). Optional whole-koruna rounding of total payable (`rounding` line, outside tax base,
  §36(5)) — default on for CZK cash, off for bank transfer.
- Foreign currency: VAT amount must also be shown in CZK using ČNB rate for the DUZP (last published rate for
  weekends/holidays (verify)). Store `exchange_rate` on the document; allow manual override.
- SK (later): 23 %, 19 %, 5 %; IČ DPH = `SK` + 10 digits; e-invoicing (Peppol UBL) mandatory for SK payers from 2027.

## VAT reporting (payers)

The **DPH** page (`/dph`, payers only) previews and exports the EPO XML for the Přiznání k DPH (DPHDP3),
Kontrolní hlášení (DPHKH1) and Souhrnné hlášení (DPHSHV) from issued tax documents by DUZP. Only output VAT is
derived; input VAT is entered by hand (ř.40/41). Formats, row mapping, rounding rules and the open questions are
in `docs/research/vat-reports.md`; logic is `packages/domain/src/vat-report.ts` (aggregation) and `vat-xml.ts`
(generators, validated against the official XSDs in `packages/domain/test/fixtures/xsd/`). Filing details
(`vat_filing`: tax office code, period, taxpayer type) live on the business profile. Always shown:
"Kontrolujte před podáním — aplikace nenahrazuje daňového poradce."

## Document types

- `invoice` — faktura / daňový doklad.
- `proforma` — zálohová faktura. **Not** a tax document, no VAT recap. After payment a payer issues
  `payment_receipt` (daňový doklad k přijaté platbě, §28(1)(d)); the final invoice deducts advances (§37a).
- `credit_note` — opravný daňový doklad §45: references original number, reason, differences of base/VAT/total.
  For non-payers: "Opravný doklad". Negative quantities/amounts.
- `estimate` — nabídka (later).
- Cancellation (storno) of an unpaid invoice = status `cancelled` (keeps number); for payers prefer credit note.

## Numbering

- Pattern tokens: `{YYYY}`, `{YY}`, `{MM}`, `{N…}` (zero-padded counter, width = count of N), literal text.
  Defaults: invoice `{YYYY}-{NNNN}`, proforma `Z{YYYY}-{NNNN}`, credit note `D{YYYY}-{NNNN}`,
  payment receipt `P{YYYY}-{NNNN}`. Yearly reset by default. Unique per org+type+number.
- Allocated at **issue**, atomically. Drafts have no number. Gaps are legal but must be explainable — never
  reuse numbers; deleting an issued document is only allowed for the latest number in the series, otherwise cancel.
- Variable symbol defaults to digits of the number (max 10 digits).

## Dates

- `issue_date` default today; `taxable_date` (DUZP) default = issue date (hide for non-payers unless enabled);
  `due_date` = issue + due days (presets 7 / 14 / 30, default 14 or contact default).
- Overdue = status `issued` and `due_date < today` (Europe/Prague).

## Bank accounts & payments

- Czech account: `[prefix-]number/bank_code`. Validate with weighted mod 11 (prefix weights 10,5,8,4,2,1;
  number weights 6,3,7,9,10,5,8,4,2,1).
- CZ IBAN = `CZ` + check + bank(4) + prefix(6, zero-pad) + number(10, zero-pad); check = `98 − (int(BBAN+"123500") mod 97)`.
  Test vector: 19-2000145399/0800 → `CZ6508000000192000145399`.
- Any IBAN must be accepted (Revolut gives LT IBAN + BIC `REVOLT21`; Wise often BE). Validate IBAN mod 97.
- Bank codes + BIC: ČNB CSV `https://www.cnb.cz/cs/platebni-styk/.galleries/ucty_kody_bank/download/kody_bank_CR.csv`
  (semicolon, BOM). Ship a generated `bank-codes.ts` snapshot.
- Payment methods: `bank_transfer`, `cash`, `card`, `cash_on_delivery`, `other`.
- Partial payments supported; status becomes `paid` when Σ payments ≥ total.

## QR codes

- **QR Platba (SPAYD)** for CZK and bank transfer: `SPD*1.0*ACC:<IBAN>[+BIC]*AM:<0.00>*CC:CZK*X-VS:<vs>*DT:<YYYYMMDD>*MSG:<≤60>*RN:<≤35>`.
  Escape `*` as `%2A`. ECC level M. Optionally embed QR Faktura via `X-INV:` (SID, URL-encoded).
- **EPC QR (SEPA)** for EUR: lines `BCD\n002\n1\nSCT\n<BIC>\n<name≤70>\n<IBAN>\nEUR<amount>\n\n\n<text≤140>`.
- **Pay by square** for SK (later): npm `bysquare`.

## Integrations

- **ARES**: `GET https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/{ico}` (404 → not found),
  search `POST …/ekonomicke-subjekty/vyhledat` `{"obchodniJmeno":"…","start":0,"pocet":10}`. Fields: `ico`,
  `obchodniJmeno`, `dic`, `sidlo{nazevUlice,cisloDomovni,cisloOrientacni,nazevObce,psc,textovaAdresa}`,
  `pravniForma`, `seznamRegistraci.stavZdrojeDph`. CORS open; still proxy server-side + cache 24 h. IČO checksum
  (mod 11) validate before calling.
- **VIES**: `POST https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-number` `{"countryCode","vatNumber"}`.
- **ČNB rates**: `https://www.cnb.cz/cs/financni-trhy/devizovy-trh/kurzy-devizoveho-trhu/kurzy-devizoveho-trhu/denni_kurz.txt?date=DD.MM.YYYY`
  (`země|měna|množství|kód|kurz`, comma decimals, divide by `množství`), or JSON `https://api.cnb.cz/cnbapi/exrates/daily`.
- **Fio API** (free bank pairing for Fio users): token-based, 1 req / 30 s.
- **Bank statements** (`@fakturky/domain/bank`, `parseStatement`): CSV (Fio, Revolut personal + Business, Raiffeisenbank,
  ČSOB, KB — detected from the header, columns matched by name aliases; any other CSV via an explicit column mapping),
  ABO/GPC (records 074/075/078/079, posting code 1 debit / 2 credit / 4 storno debit / 5 storno credit, Windows-1250),
  CAMT.053 XML (VS/KS/SS from the Czech `/VS…/SS…/KS…` EndToEndId convention or `Strd/CdtrRefInf/Ref`). Amounts are
  signed (credit > 0). Re-imports are idempotent through `external_id` (bank id, else a row fingerprint).
  CSV exports of KB/ČSOB/Raiffeisen were modelled from their documented column names, not from real account exports.

## Exports

- **ISDOC 6.0.2** XML per document (schema: github.com/isdoc/schema) — accountants and Pohoda/Money import it.
- CSV of documents and contacts; Pohoda XML (later).

## Retention & deletion

- Keep issued documents 10 years. Account deletion: export first, issued documents are retained in a
  locked state for the legal period unless the user confirms they keep their own copies (legal text in UI).

## Competitive context

Every Czech competitor's free tier caps at 5 customers and paywalls API, recurring invoices, reminders and bank
matching. We give all of that for free, plus a first-class MCP server and CLI. Closest competitor: Doklad.ai
(free, closed source). No well-maintained open-source Czech invoicer exists.
