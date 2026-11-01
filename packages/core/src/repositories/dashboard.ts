import type { Db } from '@fakturky/db'
import { schema } from '@fakturky/db'
import { Decimal, parseDecimal, todayPrague, toFixed } from '@fakturky/domain'
import { and, eq, gte, inArray, isNull, or } from 'drizzle-orm'

const { document, payment, businessProfile } = schema

/** Annual turnover (without VAT) above which a non-payer must register for VAT. */
export const VAT_REGISTRATION_LIMIT = '2000000'

const DAY = 86_400_000

export const dashboardRepo = {
  async summary(db: Db, orgId: string) {
    const today = todayPrague()
    const year = today.slice(0, 4)
    const month = today.slice(0, 7)
    const [y, m] = [Number(year), Number(today.slice(5, 7))]
    // First day of the month five months back (chart window).
    const chartStart = new Date(Date.UTC(y, m - 6, 1)).toISOString().slice(0, 10)
    const since = chartStart < `${year}-01-01` ? chartStart : `${year}-01-01`

    const [profile] = await db
      .select({ vatStatus: businessProfile.vatStatus })
      .from(businessProfile)
      .where(eq(businessProfile.organizationId, orgId))

    // Open invoices of any age (unpaid/overdue) plus everything issued within the reporting window.
    const rows = await db
      .select()
      .from(document)
      .where(
        and(
          eq(document.organizationId, orgId),
          isNull(document.deletedAt),
          eq(document.type, 'invoice'),
          or(
            eq(document.status, 'issued'),
            and(eq(document.status, 'paid'), gte(document.issueDate, since)),
          ),
        ),
      )
    const openIds = rows.filter((r) => r.status === 'issued').map((r) => r.id)
    const paid = new Map<string, Decimal>()
    if (openIds.length > 0) {
      const pays = await db
        .select({ documentId: payment.documentId, amount: payment.amount })
        .from(payment)
        .where(and(eq(payment.organizationId, orgId), inArray(payment.documentId, openIds)))
      for (const p of pays) {
        paid.set(
          p.documentId,
          (paid.get(p.documentId) ?? new Decimal(0)).plus(parseDecimal(p.amount)),
        )
      }
    }

    /** CZK equivalent of an amount expressed in the document currency. */
    const czk = (doc: (typeof rows)[number], amount: Decimal) => {
      const total = parseDecimal(doc.total)
      if (doc.currency === 'CZK' || total.isZero() || !doc.totalCzk) return amount
      return amount.times(parseDecimal(doc.totalCzk)).div(total)
    }

    let monthTurnover = new Decimal(0)
    let yearTurnover = new Decimal(0)
    let unpaid = new Decimal(0)
    let overdue = new Decimal(0)
    let overdueCount = 0
    let oldestOverdue: string | null = null
    const byMonth = new Map<string, Decimal>()
    for (let i = 5; i >= 0; i--) {
      byMonth.set(new Date(Date.UTC(y, m - 1 - i, 1)).toISOString().slice(0, 7), new Decimal(0))
    }

    for (const d of rows) {
      const issue = d.issueDate ?? ''
      if (issue >= since) {
        const net = czk(d, parseDecimal(d.subtotal))
        const key = issue.slice(0, 7)
        const bucket = byMonth.get(key)
        if (bucket) byMonth.set(key, bucket.plus(net))
        if (key === month) monthTurnover = monthTurnover.plus(net)
        if (issue.startsWith(year)) yearTurnover = yearTurnover.plus(net)
      }
      if (d.status === 'issued') {
        const left = czk(d, parseDecimal(d.total).minus(paid.get(d.id) ?? 0))
        if (left.gt(0)) {
          unpaid = unpaid.plus(left)
          if (d.dueDate && d.dueDate < today) {
            overdue = overdue.plus(left)
            overdueCount++
            if (!oldestOverdue || d.dueDate < oldestOverdue) oldestOverdue = d.dueDate
          }
        }
      }
    }

    const nonPayer = (profile?.vatStatus ?? 'non_payer') === 'non_payer'
    const limit = new Decimal(VAT_REGISTRATION_LIMIT)
    return {
      monthTurnover: toFixed(monthTurnover, 2),
      unpaid: toFixed(unpaid, 2),
      overdue: toFixed(overdue, 2),
      overdueCount,
      oldestOverdueDays: oldestOverdue
        ? Math.round((Date.parse(today) - Date.parse(oldestOverdue)) / DAY)
        : 0,
      vatLimit: nonPayer
        ? {
            year: Number(year),
            turnover: toFixed(yearTurnover, 2),
            limit: toFixed(limit, 0),
            percent: Math.min(100, Math.round(yearTurnover.div(limit).times(100).toNumber())),
          }
        : null,
      months: [...byMonth.entries()].map(([key, v]) => ({ month: key, turnover: toFixed(v, 2) })),
    }
  },
}
