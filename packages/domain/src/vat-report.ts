/**
 * VAT reporting for VAT payers: aggregates issued tax documents of a period into the rows of the
 * VAT return (DPHDP3), the control statement (DPHKH1) and the recapitulative statement (DPHSHV).
 * Pure functions, no IO. Rules and sources: docs/research/vat-reports.md.
 *
 * Only OUTPUT VAT is derived (issued documents). Received invoices do not exist in the app yet, so the
 * input side is supplied manually (see `Dp3ManualInput`).
 */
import { addDays, isWeekend, type IsoDate } from './dates.ts'
import { isValidEuVatId, normalizeVatId, parseVatId } from './dic.ts'
import { Decimal, parseDecimal, round, sum, toFixed } from './money.ts'
import type { VatTreatment } from './vat.ts'

// ---------------------------------------------------------------------------------------------
// Periods
// ---------------------------------------------------------------------------------------------

export type VatPeriod =
  | { kind: 'month'; year: number; month: number }
  | { kind: 'quarter'; year: number; quarter: number }

export function isValidVatPeriod(p: VatPeriod): boolean {
  if (!Number.isInteger(p.year) || p.year < 2016 || p.year > 2100) return false
  return p.kind === 'month'
    ? Number.isInteger(p.month) && p.month >= 1 && p.month <= 12
    : Number.isInteger(p.quarter) && p.quarter >= 1 && p.quarter <= 4
}

const pad2 = (n: number) => String(n).padStart(2, '0')

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/** First and last day (inclusive) of the period. */
export function vatPeriodRange(p: VatPeriod): { from: IsoDate; to: IsoDate } {
  if (!isValidVatPeriod(p)) throw new Error('Invalid VAT period')
  const firstMonth = p.kind === 'month' ? p.month : (p.quarter - 1) * 3 + 1
  const lastMonth = p.kind === 'month' ? p.month : firstMonth + 2
  return {
    from: `${p.year}-${pad2(firstMonth)}-01`,
    to: `${p.year}-${pad2(lastMonth)}-${pad2(lastDayOfMonth(p.year, lastMonth))}`,
  }
}

/**
 * Filing deadline of the return / KH / SH: 25 days after the end of the period, moved to the next
 * working day when it falls on a weekend. Public holidays are NOT considered (informative only).
 */
export function vatFilingDeadline(p: VatPeriod): IsoDate {
  let d = addDays(vatPeriodRange(p).to, 25)
  while (isWeekend(d)) d = addDays(d, 1)
  return d
}

// ---------------------------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------------------------

export interface VatReportCustomer {
  name: string
  /** ISO country code of the customer; null/empty is treated as CZ. */
  country: string | null
  dic: string | null
  /** EU VAT ID stored in the dedicated field (Slovak IČ DPH or any other EU VAT ID). */
  icDph: string | null
}

export interface VatReportRecapRow {
  /** Percent, '21' | '12' for `standard`; '0' otherwise. */
  vatRate: string
  vatTreatment: VatTreatment
  /** CZK, 2 decimals (converted with the ČNB rate on the document). */
  baseCzk: string
  vatCzk: string
}

export interface VatReportDocument {
  id: string
  type: 'invoice' | 'credit_note' | 'payment_receipt'
  /** Document number as printed (KH `c_evid_dd`). */
  number: string
  /** DUZP; for a payment receipt the date of the received payment (DPPD). */
  taxableDate: IsoDate
  customer: VatReportCustomer
  recap: readonly VatReportRecapRow[]
  /** Overrides the report default for EU supplies (goods → ř.20 / SH code 0, services → ř.21 / code 3). */
  euSupplyKind?: 'goods' | 'services'
  /** Foreign-currency document without a stored ČNB rate: the CZK amounts are not trustworthy. */
  missingExchangeRate?: boolean
}

export interface VatReportOptions {
  /** Default for EU supplies when the document does not say. Our lines carry no goods/service flag. */
  euSupplyKind?: 'goods' | 'services'
  /** KH A.1 `kod_pred_pl` used for every domestic reverse-charge supply. Default '4' (construction work). */
  reverseChargeCode?: string
}

/** Document total incl. VAT above which a domestic supply is listed individually in KH A.4. */
export const KH_A4_LIMIT_CZK = '10000'

// ---------------------------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------------------------

export type Dp3RowKey = '1' | '2' | '20' | '21' | '22' | '25' | '26' | 'exempt'

export type VatRowKey =
  | `dp3.${Dp3RowKey}`
  | 'kh.A1'
  | 'kh.A4'
  | 'kh.A5'
  | 'sh.0'
  | 'sh.3'

export interface AmountPair {
  base: string
  vat: string
}

export interface KhA1Row {
  documentId: string
  number: string
  /** Customer's Czech DIČ, digits only. */
  dicOdb: string
  duzp: IsoDate
  base: string
  code: string
}

export interface KhA4Row {
  documentId: string
  number: string
  dicOdb: string
  dppd: IsoDate
  base21: string
  vat21: string
  base12: string
  vat12: string
}

export interface KhA5 {
  base21: string
  vat21: string
  base12: string
  vat12: string
}

export interface ShRow {
  /** Country prefix of the VAT ID ('DE', 'EL', …). */
  country: string
  /** VAT ID without the country prefix. */
  vatNumber: string
  /** k_pln_eu: '0' goods, '3' services. */
  code: '0' | '3'
  /** Number of supplies (documents, credit notes not counted). */
  count: number
  /** Exact value in CZK (credit notes negative). */
  valueCzk: string
  /** Value rounded UP to whole CZK, as required in the SH. */
  valueWhole: string
}

export interface VatContribution {
  rowKey: VatRowKey
  documentId: string
  base: string
  vat: string
}

export type VatWarningCode =
  /** Domestic reverse charge supply without a Czech DIČ: cannot be listed in KH A.1. */
  | 'missing_dic_reverse_charge'
  /** EU supply without an EU VAT ID: cannot be listed in the SH. */
  | 'missing_vat_id_eu'
  | 'invalid_eu_vat_id'
  /** Domestic supply above the KH limit, customer without Czech DIČ → reported in A.5. */
  | 'large_domestic_without_dic'
  | 'unsupported_rate'
  /** Foreign-currency document without a ČNB exchange rate: CZK amounts cannot be derived. */
  | 'missing_exchange_rate'
  /** Exempt supplies are not derived: ř.26 vs ř.50 depends on the right to deduct. */
  | 'exempt_manual'

export interface VatWarning {
  code: VatWarningCode
  /** true: the document is missing from a statement and the user must fix it. */
  blocking: boolean
  documentId: string
  number: string
}

export interface VatReport {
  period: VatPeriod
  range: { from: IsoDate; to: IsoDate }
  dp3: Record<Dp3RowKey, AmountPair>
  kh: { a1: KhA1Row[]; a4: KhA4Row[]; a5: KhA5 }
  sh: ShRow[]
  contributions: VatContribution[]
  warnings: VatWarning[]
  documentCount: number
}

// ---------------------------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------------------------

/** Digits of a Czech DIČ (`CZ12345678` → `12345678`); null when the customer has none. */
export function czDicDigits(customer: Pick<VatReportCustomer, 'country' | 'dic'>): string | null {
  if (!customer.dic) return null
  const v = normalizeVatId(customer.dic)
  const prefixed = /^CZ(\d{8,10})$/.exec(v)
  if (prefixed) return prefixed[1] ?? null
  const country = (customer.country ?? 'CZ').toUpperCase()
  if (country === 'CZ' && /^\d{8,10}$/.test(v)) return v
  return null
}

/** EU VAT ID of a non-Czech customer, split into prefix and number; null when there is none. */
export function euVatIdOf(
  customer: Pick<VatReportCustomer, 'icDph' | 'dic'>,
): { country: string; number: string } | null {
  for (const candidate of [customer.icDph, customer.dic]) {
    if (!candidate) continue
    const parsed = parseVatId(candidate)
    if (parsed && parsed.countryCode !== 'CZ' && parsed.number) {
      return { country: parsed.countryCode, number: parsed.number }
    }
  }
  return null
}

const zero = () => new Decimal(0)

interface Acc {
  base: Decimal
  vat: Decimal
}

export function buildVatReport(
  period: VatPeriod,
  documents: readonly VatReportDocument[],
  options: VatReportOptions = {},
): VatReport {
  const range = vatPeriodRange(period)
  const defaultKind = options.euSupplyKind ?? 'services'
  const rcCode = options.reverseChargeCode ?? '4'

  const dp3: Record<Dp3RowKey, Acc> = {
    '1': { base: zero(), vat: zero() },
    '2': { base: zero(), vat: zero() },
    '20': { base: zero(), vat: zero() },
    '21': { base: zero(), vat: zero() },
    '22': { base: zero(), vat: zero() },
    '25': { base: zero(), vat: zero() },
    '26': { base: zero(), vat: zero() },
    exempt: { base: zero(), vat: zero() },
  }
  const a1: KhA1Row[] = []
  const a4: KhA4Row[] = []
  const a5 = { base21: zero(), vat21: zero(), base12: zero(), vat12: zero() }
  const shMap = new Map<
    string,
    { country: string; vatNumber: string; code: '0' | '3'; count: number; value: Decimal }
  >()
  const contributions: VatContribution[] = []
  const warnings: VatWarning[] = []
  let documentCount = 0

  const sorted = [...documents]
    .filter((d) => d.taxableDate >= range.from && d.taxableDate <= range.to)
    .sort((a, b) => a.taxableDate.localeCompare(b.taxableDate) || a.number.localeCompare(b.number))

  for (const doc of sorted) {
    documentCount += 1
    const warn = (code: VatWarningCode, blocking: boolean) =>
      warnings.push({ code, blocking, documentId: doc.id, number: doc.number })
    const contribute = (rowKey: VatRowKey, base: Decimal, vat: Decimal) =>
      contributions.push({ rowKey, documentId: doc.id, base: toFixed(base), vat: toFixed(vat) })

    if (doc.missingExchangeRate) warn('missing_exchange_rate', true)

    const docTotal = sum(doc.recap.map((r) => parseDecimal(r.baseCzk).plus(parseDecimal(r.vatCzk))))
    const czDic = czDicDigits(doc.customer)

    // Standard-rated lines (KH A.4 / A.5, ř.1 / ř.2)
    const std = { base21: zero(), vat21: zero(), base12: zero(), vat12: zero() }
    let hasStd = false
    // Reverse charge
    let rcBase = zero()
    // EU supplies
    let euBase = zero()
    const kind = doc.euSupplyKind ?? defaultKind

    for (const row of doc.recap) {
      const base = parseDecimal(row.baseCzk)
      const vat = parseDecimal(row.vatCzk)
      switch (row.vatTreatment) {
        case 'standard': {
          const rate = parseDecimal(row.vatRate)
          if (rate.eq(21)) {
            dp3['1'].base = dp3['1'].base.plus(base)
            dp3['1'].vat = dp3['1'].vat.plus(vat)
            std.base21 = std.base21.plus(base)
            std.vat21 = std.vat21.plus(vat)
            hasStd = true
            contribute('dp3.1', base, vat)
          } else if (rate.eq(12)) {
            dp3['2'].base = dp3['2'].base.plus(base)
            dp3['2'].vat = dp3['2'].vat.plus(vat)
            std.base12 = std.base12.plus(base)
            std.vat12 = std.vat12.plus(vat)
            hasStd = true
            contribute('dp3.2', base, vat)
          } else if (!base.isZero() || !vat.isZero()) {
            warn('unsupported_rate', true)
          }
          break
        }
        case 'reverse_charge':
          rcBase = rcBase.plus(base)
          dp3['25'].base = dp3['25'].base.plus(base)
          contribute('dp3.25', base, zero())
          break
        case 'eu_reverse_charge': {
          euBase = euBase.plus(base)
          const key = kind === 'goods' ? '20' : '21'
          dp3[key].base = dp3[key].base.plus(base)
          contribute(`dp3.${key}`, base, zero())
          break
        }
        case 'export':
          dp3['22'].base = dp3['22'].base.plus(base)
          contribute('dp3.22', base, zero())
          break
        case 'outside_scope':
          dp3['26'].base = dp3['26'].base.plus(base)
          contribute('dp3.26', base, zero())
          break
        case 'exempt':
          dp3.exempt.base = dp3.exempt.base.plus(base)
          contribute('dp3.exempt', base, zero())
          break
      }
    }

    if (doc.recap.some((r) => r.vatTreatment === 'exempt')) warn('exempt_manual', false)

    // KH A.1: domestic reverse charge supplies
    if (!rcBase.isZero()) {
      if (czDic) {
        a1.push({
          documentId: doc.id,
          number: doc.number,
          dicOdb: czDic,
          duzp: doc.taxableDate,
          base: toFixed(rcBase),
          code: rcCode,
        })
        contribute('kh.A1', rcBase, zero())
      } else {
        warn('missing_dic_reverse_charge', true)
      }
    }

    // KH A.4 / A.5: domestic taxable supplies
    if (hasStd) {
      const large = docTotal.abs().gt(KH_A4_LIMIT_CZK)
      if (large && czDic) {
        a4.push({
          documentId: doc.id,
          number: doc.number,
          dicOdb: czDic,
          dppd: doc.taxableDate,
          base21: toFixed(std.base21),
          vat21: toFixed(std.vat21),
          base12: toFixed(std.base12),
          vat12: toFixed(std.vat12),
        })
        contribute('kh.A4', std.base21.plus(std.base12), std.vat21.plus(std.vat12))
      } else {
        if (large) warn('large_domestic_without_dic', false)
        a5.base21 = a5.base21.plus(std.base21)
        a5.vat21 = a5.vat21.plus(std.vat21)
        a5.base12 = a5.base12.plus(std.base12)
        a5.vat12 = a5.vat12.plus(std.vat12)
        contribute('kh.A5', std.base21.plus(std.base12), std.vat21.plus(std.vat12))
      }
    }

    // SH: EU supplies
    if (!euBase.isZero()) {
      const vatId = euVatIdOf(doc.customer)
      if (!vatId) {
        warn('missing_vat_id_eu', true)
      } else {
        if (!isValidEuVatId(`${vatId.country}${vatId.number}`)) warn('invalid_eu_vat_id', false)
        const code = kind === 'goods' ? '0' : '3'
        const key = `${vatId.country}|${vatId.number}|${code}`
        const cur = shMap.get(key) ?? {
          country: vatId.country,
          vatNumber: vatId.number,
          code,
          count: 0,
          value: zero(),
        }
        cur.value = cur.value.plus(euBase)
        if (doc.type !== 'credit_note') cur.count += 1
        shMap.set(key, cur)
        contribute(code === '0' ? 'sh.0' : 'sh.3', euBase, zero())
      }
    }
  }

  const sh: ShRow[] = [...shMap.values()]
    .map((r) => ({
      country: r.country,
      vatNumber: r.vatNumber,
      code: r.code,
      count: r.count,
      valueCzk: toFixed(r.value),
      // "Celková hodnota plnění se zaokrouhlí na celé koruny nahoru."
      valueWhole: r.value.toDecimalPlaces(0, Decimal.ROUND_CEIL).toFixed(0),
    }))
    .sort(
      (a, b) =>
        a.country.localeCompare(b.country) ||
        a.vatNumber.localeCompare(b.vatNumber) ||
        a.code.localeCompare(b.code),
    )

  const out = (a: Acc): AmountPair => ({ base: toFixed(a.base), vat: toFixed(a.vat) })
  return {
    period,
    range,
    dp3: {
      '1': out(dp3['1']),
      '2': out(dp3['2']),
      '20': out(dp3['20']),
      '21': out(dp3['21']),
      '22': out(dp3['22']),
      '25': out(dp3['25']),
      '26': out(dp3['26']),
      exempt: out(dp3.exempt),
    },
    kh: {
      a1,
      a4,
      a5: {
        base21: toFixed(a5.base21),
        vat21: toFixed(a5.vat21),
        base12: toFixed(a5.base12),
        vat12: toFixed(a5.vat12),
      },
    },
    sh,
    contributions,
    warnings,
    documentCount,
  }
}

// ---------------------------------------------------------------------------------------------
// DP3 figures (whole CZK) including the manually entered input side
// ---------------------------------------------------------------------------------------------

/** Input VAT totals the user enters by hand (received invoices are not tracked yet). Whole or decimal CZK. */
export interface Dp3ManualInput {
  /** ř.40: received domestic supplies at 21 % — base and deduction "v plné výši". */
  r40Base?: string
  r40Deduction?: string
  /** ř.41: same at 12 %. */
  r41Base?: string
  r41Deduction?: string
}

export interface Dp3Figures {
  r1: { base: string; vat: string }
  r2: { base: string; vat: string }
  r20: string
  r21: string
  r22: string
  r25: string
  r26: string
  r40: { base: string; deduction: string }
  r41: { base: string; deduction: string }
  /** ř.46: total deduction in full (sum of ř.40–45 "v plné výši"). */
  r46: string
  /** ř.62: output tax. */
  r62: string
  /** ř.63: deduction. */
  r63: string
  /** ř.64: tax to pay (output > deduction). */
  r64: string
  /** ř.65: excess deduction (refund). */
  r65: string
}

const whole = (v: Decimal | string | undefined): Decimal => round(parseDecimal(v ?? '0'), 0)

/**
 * The DP3 is filed in whole CZK. Each row is rounded (half up) once, from the exact period sum; the
 * summary rows are computed from the rounded rows, as the form does.
 */
export function computeDp3(report: VatReport, manual: Dp3ManualInput = {}): Dp3Figures {
  const r1 = { base: whole(report.dp3['1'].base), vat: whole(report.dp3['1'].vat) }
  const r2 = { base: whole(report.dp3['2'].base), vat: whole(report.dp3['2'].vat) }
  const r40 = { base: whole(manual.r40Base), deduction: whole(manual.r40Deduction) }
  const r41 = { base: whole(manual.r41Base), deduction: whole(manual.r41Deduction) }
  const r46 = r40.deduction.plus(r41.deduction)
  const r62 = r1.vat.plus(r2.vat)
  const r63 = r46
  const diff = r62.minus(r63)
  const s = (d: Decimal) => d.toFixed(0)
  return {
    r1: { base: s(r1.base), vat: s(r1.vat) },
    r2: { base: s(r2.base), vat: s(r2.vat) },
    r20: s(whole(report.dp3['20'].base)),
    r21: s(whole(report.dp3['21'].base)),
    r22: s(whole(report.dp3['22'].base)),
    r25: s(whole(report.dp3['25'].base)),
    r26: s(whole(report.dp3['26'].base)),
    r40: { base: s(r40.base), deduction: s(r40.deduction) },
    r41: { base: s(r41.base), deduction: s(r41.deduction) },
    r46: s(r46),
    r62: s(r62),
    r63: s(r63),
    r64: s(diff.gt(0) ? diff : zero()),
    r65: s(diff.lt(0) ? diff.negated() : zero()),
  }
}
