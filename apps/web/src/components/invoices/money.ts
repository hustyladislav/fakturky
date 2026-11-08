import { parseDecimal } from '@fakturky/domain/money'
import { moneyParts } from '@fakturky/ui/lib/money'

/** `92 400 Kč`: whole crowns, non-breaking. Haléře are noise in a summary. */
export function crowns(amount: string): string {
  const p = moneyParts(parseDecimal(amount).toDecimalPlaces(0).toFixed(0))
  return `${p.negative ? '−' : ''}${p.integer}\u00a0${p.currency}`
}
