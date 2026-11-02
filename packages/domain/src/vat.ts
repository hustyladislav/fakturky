import { Decimal, parseDecimal, round, sum, toFixed, type MoneyInput } from './money.ts'

export type VatCountry = 'CZ' | 'SK'

export const VAT_RATES = {
  CZ: ['21', '12'],
  SK: ['23', '19', '5'],
} as const satisfies Record<VatCountry, readonly string[]>

export function getVatRates(country: VatCountry): readonly string[] {
  return VAT_RATES[country]
}

export function isValidVatRate(country: VatCountry, rate: MoneyInput): boolean {
  const r = parseDecimal(rate)
  return VAT_RATES[country].some((x) => r.eq(x))
}

export const VAT_TREATMENTS = [
  'standard',
  'exempt',
  'reverse_charge',
  'eu_reverse_charge',
  'export',
  'outside_scope',
] as const
export type VatTreatment = (typeof VAT_TREATMENTS)[number]

export type DocumentLanguage = 'cs' | 'sk' | 'en'

export const VAT_TREATMENT_TEXTS: Record<VatTreatment, Record<DocumentLanguage, string>> = {
  standard: { cs: '', sk: '', en: '' },
  exempt: {
    cs: 'Osvobozeno od DPH',
    sk: 'Oslobodené od DPH',
    en: 'VAT exempt',
  },
  reverse_charge: {
    cs: 'Daň odvede zákazník (režim přenesení daňové povinnosti, § 92a zákona o DPH)',
    sk: 'Daň odvedie zákazník (prenesenie daňovej povinnosti)',
    en: 'Reverse charge – VAT to be accounted for by the customer (domestic reverse charge)',
  },
  eu_reverse_charge: {
    cs: 'Přenesení daňové povinnosti – daň odvede zákazník (§ 9 zákona o DPH, čl. 196 směrnice 2006/112/ES)',
    sk: 'Prenesenie daňovej povinnosti – daň odvedie zákazník (čl. 196 smernice 2006/112/ES)',
    en: 'Reverse charge – VAT to be accounted for by the customer (Art. 196 Directive 2006/112/EC)',
  },
  export: {
    cs: 'Vývoz zboží do třetí země – osvobozeno od DPH (§ 66 zákona o DPH)',
    sk: 'Vývoz tovaru do tretej krajiny – oslobodené od DPH',
    en: 'Export of goods to a third country – VAT exempt',
  },
  outside_scope: {
    cs: 'Plnění mimo předmět daně (místo plnění mimo tuzemsko)',
    sk: 'Plnenie mimo predmetu dane',
    en: 'Outside the scope of VAT',
  },
}

export function vatTreatmentText(treatment: VatTreatment, language: DocumentLanguage = 'cs'): string {
  return VAT_TREATMENT_TEXTS[treatment][language]
}

export interface DocumentLineInput {
  quantity: MoneyInput
  /** Unit price: without VAT, or with VAT when `pricesIncludeVat`. */
  unitPrice: MoneyInput
  /** VAT rate in percent, e.g. '21'. Ignored (treated as 0) unless treatment is `standard`. */
  vatRate?: MoneyInput
  vatTreatment?: VatTreatment
  /** Per-line discount in percent (0–100). */
  discountPercent?: MoneyInput
}

export interface ComputeTotalsOptions {
  pricesIncludeVat?: boolean
  /** false → no VAT anywhere (neplátce DPH). */
  vatPayer?: boolean
  /** Round the payable total to whole currency units, shown as a separate `rounding`. */
  roundTotal?: boolean
  currency?: string
  /** Units of CZK per 1 unit of `currency` (already divided by ČNB "množství"). */
  exchangeRate?: MoneyInput
  /** Document-level discount in percent applied to every line. */
  documentDiscountPercent?: MoneyInput
}

export interface LineTotals {
  vatRate: string
  vatTreatment: VatTreatment
  /** Line base (without VAT) after discounts. */
  base: string
  vat: string
  total: string
  /** Total discount (percent combined) applied, as an amount of base. */
  discount: string
}

export interface VatRecapRow {
  vatRate: string
  vatTreatment: VatTreatment
  base: string
  vat: string
  total: string
  baseCzk?: string
  vatCzk?: string
  totalCzk?: string
}

export interface DocumentTotals {
  lines: LineTotals[]
  recap: VatRecapRow[]
  subtotal: string
  vatTotal: string
  /** Sum before rounding. */
  totalBeforeRounding: string
  rounding: string
  /** Payable total (after rounding). */
  total: string
  currency: string
  exchangeRate: string
  /** CZK equivalents (only meaningful for foreign currency; equal to the values for CZK). */
  subtotalCzk: string
  vatTotalCzk: string
  totalCzk: string
}

const HUNDRED = new Decimal(100)

function hundredMinus(pct: Decimal): Decimal {
  return HUNDRED.minus(pct)
}

/**
 * Computes line totals, the VAT recap per rate and document totals.
 *
 * Rules (docs/DOMAIN.md): line base = round2(qty × net price × discounts); VAT is computed once
 * per rate on the summed bases (`vat_r = round2(base_r × r)`), never per line; line VAT values are
 * informational and are reconciled so their sum equals the recap VAT.
 */
export function computeDocumentTotals(
  lines: readonly DocumentLineInput[],
  options: ComputeTotalsOptions = {},
): DocumentTotals {
  const {
    pricesIncludeVat = false,
    vatPayer = true,
    roundTotal = false,
    currency = 'CZK',
    documentDiscountPercent = 0,
  } = options
  const exchangeRate = parseDecimal(options.exchangeRate ?? 1)
  if (exchangeRate.lte(0)) throw new Error('exchangeRate must be positive')

  const docDiscount = parseDecimal(documentDiscountPercent)
  if (docDiscount.lt(0) || docDiscount.gt(100)) {
    throw new Error('documentDiscountPercent must be between 0 and 100')
  }

  interface Work {
    treatment: VatTreatment
    rate: Decimal
    base: Decimal
    gross: Decimal
    discount: Decimal
  }

  const work: Work[] = lines.map((line) => {
    const qty = parseDecimal(line.quantity)
    const price = parseDecimal(line.unitPrice)
    const lineDiscount = parseDecimal(line.discountPercent ?? 0)
    if (lineDiscount.lt(0) || lineDiscount.gt(100)) {
      throw new Error('discountPercent must be between 0 and 100')
    }
    const treatment: VatTreatment = vatPayer ? (line.vatTreatment ?? 'standard') : 'outside_scope'
    const rate =
      vatPayer && treatment === 'standard' ? parseDecimal(line.vatRate ?? 0) : new Decimal(0)
    if (rate.isNegative()) throw new Error('vatRate must not be negative')

    const factor = hundredMinus(lineDiscount).div(100).times(hundredMinus(docDiscount).div(100))
    const entered = qty.times(price)
    const afterDiscount = round(entered.times(factor), 2)
    const discount = round(entered, 2).minus(afterDiscount)
    // VAT-inclusive: `afterDiscount` is gross; base is derived per group below. Per-line base is
    // informational, split with the same formula.
    const base = pricesIncludeVat
      ? afterDiscount.minus(round(afterDiscount.times(rate).div(rate.plus(100)), 2))
      : afterDiscount
    return { treatment, rate, base, gross: afterDiscount, discount }
  })

  const groups = new Map<
    string,
    { treatment: VatTreatment; rate: Decimal; bases: Decimal[]; grosses: Decimal[] }
  >()
  for (const w of work) {
    const key = `${w.treatment}|${w.rate.toString()}`
    const g = groups.get(key) ?? { treatment: w.treatment, rate: w.rate, bases: [], grosses: [] }
    g.bases.push(w.base)
    g.grosses.push(w.gross)
    groups.set(key, g)
  }

  const rateOrder = (r: Decimal) => -r.toNumber()
  const recapRows = [...groups.values()]
    .sort((a, b) => rateOrder(a.rate) - rateOrder(b.rate) || a.treatment.localeCompare(b.treatment))
    .map((g) => {
      let base: Decimal
      let vat: Decimal
      if (pricesIncludeVat) {
        // Top-down: gross is authoritative, VAT = gross × r / (100 + r).
        const gross = sum(g.grosses)
        vat = round(gross.times(g.rate).div(g.rate.plus(100)), 2)
        base = gross.minus(vat)
      } else {
        base = sum(g.bases)
        vat = round(base.times(g.rate).div(100), 2)
      }
      return { vatRate: g.rate.toString(), vatTreatment: g.treatment, base, vat, total: base.plus(vat) }
    })

  const subtotal = sum(recapRows.map((r) => r.base))
  const vatTotal = sum(recapRows.map((r) => r.vat))
  const totalBefore = subtotal.plus(vatTotal)
  const rounded = roundTotal ? round(totalBefore, 0) : totalBefore
  const roundingAmount = rounded.minus(totalBefore)

  const toCzk = (v: Decimal) => round(v.times(exchangeRate), 2)
  const isCzk = currency.toUpperCase() === 'CZK'

  // Non-payers have no VAT recap.
  const recap: VatRecapRow[] = (vatPayer ? recapRows : []).map((r) => ({
    vatRate: r.vatRate,
    vatTreatment: r.vatTreatment,
    base: toFixed(r.base),
    vat: toFixed(r.vat),
    total: toFixed(r.total),
    ...(isCzk
      ? {}
      : {
          baseCzk: toFixed(toCzk(r.base)),
          vatCzk: toFixed(toCzk(r.vat)),
          totalCzk: toFixed(toCzk(r.total)),
        }),
  }))

  // Line VAT: informational per-line, last line of each group absorbs the rounding difference.
  const lineVat = work.map((w) => (pricesIncludeVat ? w.gross.minus(w.base) : round(w.base.times(w.rate).div(100), 2)))
  for (const g of recapRows) {
    const idx = work.flatMap((w, i) =>
      w.treatment === g.vatTreatment && w.rate.toString() === g.vatRate ? [i] : [],
    )
    const diff = g.vat.minus(sum(idx.map((i) => lineVat[i] as Decimal)))
    const last = idx[idx.length - 1]
    if (last !== undefined && !diff.isZero()) {
      lineVat[last] = (lineVat[last] as Decimal).plus(diff)
    }
  }

  const lineTotals: LineTotals[] = work.map((w, i) => ({
    vatRate: w.rate.toString(),
    vatTreatment: w.treatment,
    // VAT-inclusive: the entered gross is fixed, so the base absorbs any VAT reconciliation.
    base: toFixed(pricesIncludeVat ? w.gross.minus(lineVat[i] as Decimal) : w.base),
    vat: toFixed(lineVat[i] as Decimal),
    total: toFixed(pricesIncludeVat ? w.gross : w.base.plus(lineVat[i] as Decimal)),
    discount: toFixed(w.discount),
  }))

  const totalCzk = isCzk ? rounded : toCzk(rounded)
  return {
    lines: lineTotals,
    recap,
    subtotal: toFixed(subtotal),
    vatTotal: toFixed(vatTotal),
    totalBeforeRounding: toFixed(totalBefore),
    rounding: toFixed(roundingAmount),
    total: toFixed(rounded),
    currency: currency.toUpperCase(),
    exchangeRate: exchangeRate.toString(),
    subtotalCzk: toFixed(isCzk ? subtotal : toCzk(subtotal)),
    vatTotalCzk: toFixed(isCzk ? vatTotal : toCzk(vatTotal)),
    totalCzk: toFixed(totalCzk),
  }
}

/**
 * Spreads a VAT-inclusive amount over groups (e.g. VAT rates) in proportion to their gross totals,
 * to whole cents; the last group takes the remainder so the parts always add up to `amount`.
 */
export function allocateGross(amount: MoneyInput, grosses: readonly MoneyInput[]): Decimal[] {
  const total = sum(grosses)
  const target = parseDecimal(amount)
  let left = target
  return grosses.map((g, i) => {
    const share =
      i === grosses.length - 1 || total.isZero()
        ? left
        : round(target.times(parseDecimal(g)).div(total), 2)
    left = left.minus(share)
    return share
  })
}

/** Splits a VAT-inclusive amount into base and VAT top-down (VAT = gross × r / (100 + r)). */
export function splitGross(gross: MoneyInput, ratePct: MoneyInput): { base: Decimal; vat: Decimal } {
  const g = parseDecimal(gross)
  const r = parseDecimal(ratePct)
  const vat = round(g.times(r).div(r.plus(100)), 2)
  return { base: g.minus(vat), vat }
}
