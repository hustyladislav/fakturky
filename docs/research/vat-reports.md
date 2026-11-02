# VAT reporting for VAT payers (research, 2026-11-02)

Goal: generate EPO (Elektronická podání pro Finanční správu) XML for **Přiznání k DPH (DPHDP3)**,
**Kontrolní hlášení (DPHKH1)** and **Souhrnné hlášení (DPHSHV)** from the issued tax documents we hold.
Everything below was read from primary sources on 2026-11-02; where a point could not be confirmed it is
marked **UNCERTAIN**.

## Primary sources

| What | Where |
|---|---|
| DPHDP3 structure page | https://adisspr.mfcr.cz/dpr/adis/idpr_pub/epo2_info/popis_struktury_detail.faces?zkratka=DPHDP3 — **Verze 03.01.04, ze dne 11. 8. 2026** |
| DPHKH1 structure page | …?zkratka=DPHKH1 — **Verze 03.01.15, ze dne 11. 8. 2026** |
| DPHSHV structure page | …?zkratka=DPHSHV — **Verze 02.01.05, ze dne 11. 8. 2026** |
| XSD (all three, as linked from those pages) | https://adisspr.mfcr.cz/adis/jepo/schema/dphdp3_epo2.xsd, `dphkh1_epo2.xsd`, `dphshv_epo2.xsd` |
| KH methodology (Finanční správa, "ke dni 1. 1. 2024", still the newest listed on 2026-11-02) | https://financnisprava.gov.cz/assets/cs/prilohy/d-seznam-dani/Metodicka_informace_k_vyplneni_KH_20240101.pdf |
| KH deadlines page | https://financnisprava.gov.cz/cs/dane/dane/dan-z-pridane-hodnoty/kontrolni-hlaseni-dph/kdy |
| SH rules | https://financnisprava.gov.cz/cs/dane/dane/dan-z-pridane-hodnoty/informace-stanoviska-a-sdeleni/souhrnna-hlaseni/podavani-souhrnneho-hlaseni-od-roku-2010-a-dale |
| Legal basis | zákon 235/2004 Sb. (§ 101c–101j KH, § 102 SH, § 99–101 DPH), vyhláška 457/2020 Sb. (form content) |

The XSDs are vendored in `packages/domain/test/fixtures/xsd/` (added with the generators) so tests validate
against the exact files published by the Finanční správa. Re-download them when the structure pages show a
newer version (the version is printed in the page header, not in the XSD itself).

## File format (common to all three)

- UTF-8 XML, root `<Pisemnost nazevSW="…" verzeSW="…">`, single child `<DPHDP3|DPHKH1|DPHSHV verzePis="…">`.
  `verzePis` is the version of the structure (we use the version from the structure page).
- **All data are XML attributes, not child elements.** Elements are the "věty": `VetaD` (header), `VetaP`
  (taxpayer), then the content věty. Names are lower-case snake_case; amounts use `.` as decimal separator.
- Dates use `DD.MM.RRRR` (`dateInMultiFormat`, pattern `d{1,2}.m{1,2}.yyyy`).
- `VetaD` has fixed attributes: `dokument="DP3|KH1|SHV"`, `k_uladis="DPH"`.
- Upload: mojedane.cz → "Elektronická podání (EPO)" → "Načtení souboru" (works without login; with a datová
  schránka / bank ID / NIA you can sign and submit). The EPO validates the file and shows the form for review
  before submission. Upload is done by the user — we never submit anything on their behalf.

## Periods and deadlines

| Report | Who | Period | Deadline |
|---|---|---|---|
| Přiznání k DPH | all plátci | calendar month or calendar quarter (`mesic` XOR `ctvrt` + `rok`) | 25 days after the end of the period (§ 101 – to be re-checked against the law text; the `dapdph_forma` documentation in the XSD says "nejpozději do 25 dnů po skončení zdaňovacího období") |
| Kontrolní hlášení | právnická osoba: **always monthly**; fyzická osoba: same period as its VAT return (monthly or quarterly) | `mesic` or `ctvrt` + `rok` | 25 days after the end of the (calendar month / tax period); falls on weekend/holiday → next working day (KH methodology 1.3) |
| Souhrnné hlášení | everyone who supplies goods/services to EU VAT payers | **monthly** if the period contains a supply of goods (code 0/1/2); **quarterly** if the VAT return is quarterly and only services (code 3) were supplied | 25 days after the end of the month/quarter |

The SH rule above is from the Finanční správa SH page (summarised via web search; the page itself could not be
fetched verbatim): quarterly VAT payers who supply goods to the EU file SH monthly; services only → together
with the return. **UNCERTAIN** whether a new payer might choose differently; the UI lets the user pick
month/quarter freely and only warns.

## Submission types (`*_forma`)

- DP3 `dapdph_forma`: `B` řádné, `O` řádné/opravné, `D` dodatečné, `E` dodatečné/opravné. We generate `B`.
- KH1 `khdph_forma`: `B` řádné, `O` řádné/opravné, `N` následné, `E` následné/opravné. We generate `B`.
- SHV `shvies_forma`: `R` řádné, `N` následné. We generate `R`.
- `typ_ds` (VetaP): `F` fyzická osoba, `P` právnická osoba. DP3 `typ_platce`: `P` plátce (we always use `P`).
- DP3 `trans`: `A` if tax liability arose, `N` otherwise (optional; we omit).

## Which of our data feeds what

Our data: **issued** documents (status `issued`/`paid`) of type `invoice`, `credit_note` (negative), `payment_receipt`
(daňový doklad k přijaté platbě; DPPD = payment date), with per-line `vat_treatment` and CZK values via the
document's `exchange_rate` (ČNB). Proformas are not tax documents and are ignored. Received invoices /
expenses **do not exist** in the app yet → every input-side section is "doplňte ručně" (manual).

### Přiznání k DPH (DPHDP3) — output side

Row numbers are the rows of the paper/EPO form; attribute names are from the XSD. In the DP3 the row-1/2
attributes are historically named `23`/`5` although the rates are now 21 % / 12 %.

| Řádek | XML (Veta) | Content | Our source |
|---|---|---|---|
| 1 | `Veta1 obrat23` (základ), `dan23` (daň) | domestic taxable supplies, 21 % | lines with treatment `standard`, rate 21 |
| 2 | `Veta1 obrat5`, `dan5` | domestic taxable supplies, 12 % | `standard`, rate 12 |
| 20 | `Veta2 dod_zb` | supply of goods to another member state (§ 64) – hodnota | `eu_reverse_charge` on a *goods* line, customer with EU VAT ID |
| 21 | `Veta2 pln_sluzby` | services with place of supply in another MS (§ 9/1) where the customer pays the tax – hodnota | `eu_reverse_charge` on a *service* line |
| 22 | `Veta2 pln_vyvoz` | export (§ 66) | treatment `export` |
| 23 | `Veta2 dod_dop_nrg` | new means of transport | not supported |
| 24 | `Veta2 pln_zaslani` | OSS selected supplies | not supported |
| 25 | `Veta2 pln_rez_pren` | domestic reverse charge supplies (§ 92a) – hodnota | `reverse_charge` |
| 26 | `Veta2 pln_ost` | other supplies with right to deduct (incl. place of supply outside CZ, § 24a) | `outside_scope` |
| 62 | `Veta6 dan_zocelk` | total output tax | computed = ř.1 + ř.2 daň (+ received-side rows entered manually) |
| 63 | `Veta6 odp_zocelk` | total deduction | **manual input** |
| 64 / 65 | `Veta6 dano_da` / `dano_no` | tax to pay / excess deduction | computed from 62 and 63 |

Evidence for the row ↔ attribute mapping: the attribute documentation in the XSD (`pln_sluzby` says "Hodnota
plnění z řádku 21 se uvede v souhrnném hlášení s kódem 3", `pln_vyvoz` "vývoz dle § 66", `pln_rez_pren`
"plátce, který v tomto režimu uskutečnil zdanitelné plnění", `dod_zb` "dodání zboží do jiného členského
státu § 64") together with the KH methodology section 1.2, which lists "ř. 20 dodání zboží do jiného MS,
ř. 21 služby § 102/1 d), ř. 22 vývoz, ř. 23 NDP, ř. 24 vybraná plnění, ř. 26 ostatní, ř. 25 přenesená daňová
povinnost". The ř.20↔`dod_zb`, ř.22↔`pln_vyvoz` and ř.26↔`pln_ost` pairings are inferred from the order and the
descriptions, not from an explicit "ř. N" label in the XSD. **UNCERTAIN** (low risk: the EPO shows the parsed
form so a wrong row is visible before submission).

**Input side (manual).** The receiving/deduction rows are `Veta4`:

- `pln23` / `pln5`: **UNCERTAIN** — believed to be ř.40 / ř.41 "základ daně" (domestic received supplies
  21 % / 12 %); `odp_tuz23_nar` / `odp_tuz5_nar`: believed to be the "v plné výši" deduction columns and
  `odp_tuz23` / `odp_tuz5` the "krácený odpočet" columns (suffix `_nar` = "nárok"). `odp_sum_nar` /
  `odp_sum_kr` are the sum rows (ř.46). The XSD documentation of these attributes is identical text for all
  of them so the column assignment could not be confirmed from the XSD alone.
  → We expose manual inputs only for **ř.40 and ř.41 (základ + odpočet v plné výši)** and compute ř.46 =
  sum, ř.63, ř.64/65 from them. Everything else (ř.3–13 reverse-charge received, ř.42–45, 47–61) must be
  completed in EPO by hand.

**Amounts in DP3 are whole CZK** (`xs:decimal` with `fractionDigits=0`). The XSD does not state the
rounding rule. We round each row's *sum* mathematically (half-up) to whole CZK. **UNCERTAIN** — the Finanční
správa's pokyny (vyhláška 457/2020) should be consulted; a wrong rounding differs by at most 1 Kč per row.

### Kontrolní hlášení (DPHKH1) — output sections

Věty: `VetaD`, `VetaP`, `VetaA1`…`VetaA5`, `VetaB1`…`VetaB3`, `VetaC` (control sums).

| Section | Věta | Content | Our source |
|---|---|---|---|
| A.1 | `VetaA1` (0..n) | supplies in domestic reverse charge (§ 92a): `dic_odb` (CZ DIČ, digits only), `c_evid_dd`, `duzp`, `zakl_dane1`, `kod_pred_pl` | `reverse_charge` lines; sums to ř.25 |
| A.2 | `VetaA2` | received supplies where the payer assesses tax (§ 108/2,3) | manual (not generated) |
| A.3 | `VetaA3` | investment gold | not supported |
| A.4 | `VetaA4` (0..n) | domestic taxable supplies/advances whose **document total incl. VAT exceeds 10 000 Kč**, one row per document: `dic_odb` (required), `c_evid_dd`, `dppd`, `zakl_dane1`/`dan1` (21 %), `zakl_dane2`/`dan2` (12 %), `kod_rezim_pl="0"`, `zdph_44="N"` | `standard` lines of documents > 10 000 Kč and customer **with CZ DIČ** |
| A.5 | `VetaA5` (0..1) | everything else under § 108/1, **cumulated** per rate: `zakl_dane1/dan1`, `zakl_dane2/dan2` | ≤ 10 000 Kč, or no CZ DIČ (any amount) |
| B.1–B.3 | `VetaB*` | received supplies | manual (not generated) |
| C | `VetaC` | control sums | optional; we leave `VetaC` out for output-only filings (the FS cross-checks to the return within ±1 000 Kč) |

Rules (KH methodology 2.A.4/A.5, section 1.2):

- **Not in the KH at all**: ř.20–24, ř.26 of the return (EU supplies, export, other). Only ř.1, 2 → A.4/A.5 and
  ř.25 → A.1.
- The 10 000 Kč test is on the **whole tax document incl. VAT, in CZK**, regardless of VAT regime; reverse-charge
  and exempt lines on the same document count towards the limit. We test `abs(total_czk) > 10 000`.
- A.4 needs the customer's **Czech DIČ**. If the customer has no CZ DIČ (consumer, foreign company) the
  supply goes to **A.5 irrespective of the amount**.
- Corrections (credit notes) under § 42: reported as a *separate* row with negative amounts, limit judged on the
  absolute value → a credit note > 10 000 Kč appears in A.4 with negative `zakl_dane1`/`dan1`, otherwise it
  reduces A.5. A.5 can therefore be negative.
- `dppd` (A.4) is the **datum povinnosti přiznat daň** (DUZP, or the payment date of an advance received if
  the supply is determined well enough, § 20a). We use the document's `taxable_date`, which for a
  `payment_receipt` is the payment date — equivalent.
- One A.4 row per document: if a document has both 21 % and 12 % lines, both go into the same `VetaA4`
  (`zakl_dane1/dan1` + `zakl_dane2/dan2`). `zakl_dane3`/`dan3` (second reduced rate) is only for DPPD ≤ 2023
  and is not generated.
- `c_evid_dd` = document number as printed on the document (max 60 chars). Must be unique per kod_pred_pl (A.1)
  / per `kod_rezim_pl` or `dppd` (A.4).
- A.1 `kod_pred_pl` (code of the reverse-charge supply, from the methodology): `1` gold, `1a` gold intermediation,
  `3` real estate, `3a` real estate forced sale, `4` construction and assembly work, `4a` construction – staff
  provision, `5` goods in annex 5, `6`/`7` collateral goods/reservation of title, `11` emission allowances,
  `12` cereals/industrial crops, `13` metals, `14` mobile phones, `15` integrated circuits, `16` portable
  computing devices, `17` game consoles, `18` electricity certificates, `19` electricity to a trader, `20`
  gas to a trader, `21` electronic communication services. **We do not know which applies to a line** → add
  a per-line "Kód předmětu plnění" later; for now it is a per-report default chosen in the UI (default `4`,
  construction work, by far the most common for small suppliers) and the UI warns it must be checked.
  Multiple codes on one invoice need one row per code with the same `c_evid_dd`.
- Amounts in KH have **two decimals**, in CZK.
- `VetaD`: `rok` required, `mesic` XOR `ctvrt`; `khdph_forma` required; `d_poddp` (filing date) optional.
- `VetaP`: `dic` (digits only, no `CZ`), `c_ufo` (3-digit finanční úřad code), `typ_ds` required; name and address
  recommended (`jmeno`+`prijmeni` for F, `zkrobchjm` for P; `ulice`, `c_pop`, `c_orient`, `naz_obce`, `psc`, `stat`).
  `c_ufo` / `c_pracufo` code lists are at mojedane.gov.cz → Dokumentace → Číselníky (ÚFO, Pracoviště FÚ).

### Souhrnné hlášení (DPHSHV)

`VetaD` (`rok`, `mesic` XOR `ctvrt`, `shvies_forma`), `VetaP` (same taxpayer block as KH), `VetaR` (0..n): one row per
customer + code:

- `k_stat` (2-letter country code of the VAT ID, **Greece = `EL`**, Northern Ireland goods = `XI`),
  `c_vat` (VAT ID **without** the country code, no spaces),
  `k_pln_eu`: `0` goods to another MS, `1` transfer of own goods, `2` triangular (middle person), `3` services
  (§ 9/1) where the customer pays the tax,
  `pln_pocet` (number of supplies),
  `pln_hodnota` — **whole CZK, rounded UP ("na celé koruny nahoru")**; credit notes are counted negatively.
- A VAT ID may appear only once per `k_pln_eu` code → aggregate per (country, VAT ID, code).
- `k_storno` must not be used in a regular (`R`) SH. `poc_radku`, `poc_stran`, `pln_poc_celk`, `suma_pln` are
  "nevyplňuje se" (kept for backwards compatibility) → omitted.
- `VetaS` (correction rows) is only for follow-up SH → not generated.
- Goods vs services distinction: `dod_zb` (ř.20) / code 0 vs `pln_sluzby` (ř.21) / code 3 requires knowing
  whether a line is goods or a service. **Our lines have no goods/service flag.** Assumption: `eu_reverse_charge`
  lines are treated as *services* unless the UI marks the report row as goods; to be decided with the user
  (open question). Until then the report offers a per-report choice "Plnění do EU jsou: služby / zboží".

## CZK conversion

Documents in foreign currency store the ČNB `exchange_rate` valid for the DUZP. Per § 4 odst. 2 ZDPH the base and
tax are converted with that rate; we use the CZK recap values from `computeDocumentTotals` (base converted,
VAT converted separately, each rounded to 2 decimals). VAT shown on a foreign-currency document must already
include the CZK amount (DOMAIN.md), so these figures agree with what the customer sees.

## Warnings the report must raise

- Domestic supply > 10 000 Kč incl. VAT to a customer without DIČ → goes to A.5; show a hint ("zkontrolujte, zda
  odběratel nemá DIČ").
- `reverse_charge` / `eu_reverse_charge` document without customer DIČ / VAT ID → cannot be included in A.1 / SH
  (blocking warning; row is listed under "Nelze zahrnout").
- EU customer VAT ID with unknown country prefix or malformed.
- Missing `exchange_rate` on a foreign-currency document.
- Business profile without DIČ / tax office code / VAT period.

## Disclaimer (must be prominent in UI)

"Kontrolujte před podáním — aplikace nenahrazuje daňového poradce."

## Open questions

1. Goods vs service flag per line (affects ř.20/21 and SH code 0/3).
2. Per-line "kód předmětu plnění" for domestic reverse charge (A.1).
3. DP3 whole-koruna rounding rule and Veta4 column assignment (see UNCERTAIN above) — confirm with the
   vyhláška 457/2020 pokyny or the owner's accountant.
4. Identified persons (`identified_person`) have no domestic VAT: the page is shown for `payer` only.
5. Input VAT (received invoices) will need an `expense` model; until then ř.40–46, A.2, B.* are manual.
