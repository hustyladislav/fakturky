/**
 * Receivables aging: how late the open invoices are, in CZK. Pure functions, no IO.
 * Foreign-currency balances use the document's own CZK ratio (`totalCzk / total`), the same
 * conversion as the dashboard totals, so they are approximate.
 */
import { daysOverdue, type IsoDate, todayPrague } from './dates.ts'
import { Decimal, parseDecimal, toFixed } from './money.ts'

export const AGING_BUCKETS = ['d1_14', 'd15_30', 'd31_60', 'd60plus'] as const
export type AgingBucketKey = (typeof AGING_BUCKETS)[number]

export interface AgingDocument {
  dueDate: IsoDate | null
  currency: string
  total: string
  paidAmount: string
  /** CZK equivalent of `total`; null on CZK documents. */
  totalCzk: string | null
}

export interface AgingBucket {
  key: AgingBucketKey
  count: number
  /** CZK, 2 decimals. */
  sumCzk: string
}

export interface ReceivablesAging {
  buckets: AgingBucket[]
  /** True when a foreign-currency balance is included, so the sums are approximate. */
  approximate: boolean
}

export function agingBucketOf(days: number): AgingBucketKey | null {
  if (days < 1) return null
  if (days <= 14) return 'd1_14'
  if (days <= 30) return 'd15_30'
  if (days <= 60) return 'd31_60'
  return 'd60plus'
}

/** Buckets the overdue part of `docs` by days past due; fully paid and not-yet-due ones are skipped. */
export function receivablesAging(
  docs: readonly AgingDocument[],
  today: IsoDate = todayPrague(),
): ReceivablesAging {
  const count = { d1_14: 0, d15_30: 0, d31_60: 0, d60plus: 0 }
  const sum = {
    d1_14: new Decimal(0),
    d15_30: new Decimal(0),
    d31_60: new Decimal(0),
    d60plus: new Decimal(0),
  }
  let approximate = false
  for (const d of docs) {
    if (!d.dueDate) continue
    const key = agingBucketOf(daysOverdue(d.dueDate, today))
    if (!key) continue
    const total = parseDecimal(d.total)
    const left = total.minus(parseDecimal(d.paidAmount))
    if (!left.gt(0)) continue
    const foreign = d.currency !== 'CZK'
    const czk =
      !foreign || total.isZero() || !d.totalCzk
        ? left
        : left.times(parseDecimal(d.totalCzk)).div(total)
    if (foreign) approximate = true
    count[key]++
    sum[key] = sum[key].plus(czk)
  }
  return {
    buckets: AGING_BUCKETS.map((key) => ({ key, count: count[key], sumCzk: toFixed(sum[key], 2) })),
    approximate,
  }
}
