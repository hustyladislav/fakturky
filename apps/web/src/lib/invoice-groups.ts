import { Decimal, parseDecimal, toFixed } from '@fakturky/domain/money'

interface Groupable {
  issueDate: string | null
  status: string
  total: string
  totalCzk: string | null
  currency: string
}

export interface MonthGroup<T> {
  /** `YYYY-MM`, or `none` for documents without an issue date. */
  key: string
  rows: T[]
  /** CZK sum of the issued/paid documents in the month (drafts and cancelled ones don't count). */
  sum: string
}

/** CZK value of a document: its stored CZK total, or the total itself for CZK documents. */
export function czkTotal(d: Pick<Groupable, 'total' | 'totalCzk' | 'currency'>): Decimal {
  return d.currency === 'CZK' || !d.totalCzk ? parseDecimal(d.total) : parseDecimal(d.totalCzk)
}

/** Groups rows (already sorted by issue date) into consecutive month buckets with subtotals. */
export function groupByMonth<T extends Groupable>(rows: T[]): MonthGroup<T>[] {
  const groups: { key: string; rows: T[]; sum: Decimal }[] = []
  for (const r of rows) {
    const key = r.issueDate?.slice(0, 7) ?? 'none'
    let g = groups.at(-1)
    if (!g || g.key !== key) {
      g = { key, rows: [], sum: new Decimal(0) }
      groups.push(g)
    }
    g.rows.push(r)
    if (r.status === 'issued' || r.status === 'paid') g.sum = g.sum.plus(czkTotal(r))
  }
  return groups.map((g) => ({ key: g.key, rows: g.rows, sum: toFixed(g.sum, 2) }))
}
