import { type MoneyInput, parseDecimal } from '@fakturky/domain/money'
import { moneyParts } from '@fakturky/ui/lib/money'

/** The amount in whole crowns as a two-decimal string, for `<Amount>`; never "-0.00". */
export function wholeCrowns(amount: MoneyInput): string {
  const rounded = parseDecimal(amount).toDecimalPlaces(0)
  return rounded.isZero() ? '0.00' : rounded.toFixed(2)
}

/** `92 400 Kč`: whole crowns, non-breaking. Haléře are noise in a summary. */
export function crowns(amount: MoneyInput): string {
  const p = moneyParts(wholeCrowns(amount))
  return `${p.negative ? '−' : ''}${p.integer} ${p.currency}`
}
