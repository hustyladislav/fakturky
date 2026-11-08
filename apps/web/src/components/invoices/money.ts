import { moneyParts } from '@fakturky/ui/lib/money'

/** `92 400 Kč`: whole crowns, non-breaking. Haléře are noise in a summary. */
export function crowns(amount: string): string {
  const p = moneyParts(String(Math.round(Number(amount))))
  return `${p.negative ? '−' : ''}${p.integer} ${p.currency}`
}
