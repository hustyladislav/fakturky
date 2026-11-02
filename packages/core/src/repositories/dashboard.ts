import type { Db } from '@fakturky/db'
import { schema } from '@fakturky/db'
import { Decimal, parseDecimal, todayPrague, toFixed } from '@fakturky/domain'
import { and, desc, eq, gte, inArray, isNull, or, sql } from 'drizzle-orm'

const { document, payment, businessProfile, activity } = schema

/** Annual turnover (without VAT) above which a non-payer must register for VAT. */
export const VAT_REGISTRATION_LIMIT = '2000000'

/** Above this turnover the obligation to register starts immediately (docs/DOMAIN.md). */
export const IMMEDIATE_REGISTRATION_LIMIT = '2536500'

const DAY = 86_400_000

export const dashboardRepo = {
  async summary(db: Db, orgId: string) {
    const today = todayPrague()
    const year = today.slice(0, 4)
    const month = today.slice(0, 7)
    const [y, m] = [Number(year), Number(today.slice(5, 7))]
    // First day of the month eleven months back (12-month chart window).
    const chartStart = new Date(Date.UTC(y, m - 12, 1)).toISOString().slice(0, 10)
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
          inArray(document.type, ['invoice', 'credit_note']),
          or(
            eq(document.status, 'issued'),
            and(
              eq(document.status, 'paid'),
              or(gte(document.issueDate, since), gte(document.taxableDate, since)),
            ),
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

    // Payments received inside the window (cash view for "Zaplaceno tento měsíc").
    const received = new Map<string, Decimal>()
    const receivedRows = await db
      .select({
        paidOn: payment.paidOn,
        amount: payment.amount,
        total: document.total,
        totalCzk: document.totalCzk,
        currency: document.currency,
      })
      .from(payment)
      .innerJoin(
        document,
        and(eq(document.id, payment.documentId), eq(document.organizationId, orgId)),
      )
      .where(
        and(
          eq(payment.organizationId, orgId),
          isNull(document.deletedAt),
          eq(document.type, 'invoice'),
          gte(payment.paidOn, chartStart),
        ),
      )
    for (const p of receivedRows) {
      const total = parseDecimal(p.total)
      const amount = parseDecimal(p.amount)
      const inCzk =
        p.currency === 'CZK' || total.isZero() || !p.totalCzk
          ? amount
          : amount.times(parseDecimal(p.totalCzk)).div(total)
      const key = p.paidOn.slice(0, 7)
      received.set(key, (received.get(key) ?? new Decimal(0)).plus(inCzk))
    }

    let monthTurnover = new Decimal(0)
    let monthIssuedCount = 0
    let monthCreditNotes = new Decimal(0)
    let unpaidCount = 0
    let yearTurnover = new Decimal(0)
    let unpaid = new Decimal(0)
    let overdue = new Decimal(0)
    let overdueCount = 0
    let oldestOverdue: string | null = null
    const byMonth = new Map<string, { turnover: Decimal; paid: Decimal }>()
    for (let i = 11; i >= 0; i--) {
      byMonth.set(new Date(Date.UTC(y, m - 1 - i, 1)).toISOString().slice(0, 7), {
        turnover: new Decimal(0),
        paid: new Decimal(0),
      })
    }

    for (const d of rows) {
      // Turnover is attributed by DUZP (taxable date), falling back to the issue date.
      const issue = d.taxableDate ?? d.issueDate ?? ''
      if (issue >= since) {
        const net = czk(d, parseDecimal(d.subtotal))
        const key = issue.slice(0, 7)
        const bucket = byMonth.get(key)
        if (bucket) {
          bucket.turnover = bucket.turnover.plus(net)
          // Share of this document that is already paid (credit notes carry no payment).
          const total = parseDecimal(d.total)
          const share =
            d.type !== 'invoice'
              ? new Decimal(0)
              : d.status === 'paid'
                ? new Decimal(1)
                : total.isZero()
                  ? new Decimal(0)
                  : (paid.get(d.id) ?? new Decimal(0)).div(total)
          bucket.paid = bucket.paid.plus(net.times(share.gt(1) ? 1 : share))
        }
        if (key === month) {
          monthTurnover = monthTurnover.plus(net)
          if (d.type === 'invoice') monthIssuedCount++
          else monthCreditNotes = monthCreditNotes.plus(net)
        }
        if (issue.startsWith(year)) yearTurnover = yearTurnover.plus(net)
      }
      // Credit notes net the turnover above but are never "open" receivables.
      if (d.status === 'issued' && d.type === 'invoice') {
        const left = czk(d, parseDecimal(d.total).minus(paid.get(d.id) ?? 0))
        if (left.gt(0)) {
          unpaid = unpaid.plus(left)
          unpaidCount++
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
      monthIssuedCount,
      monthCreditNotes: toFixed(monthCreditNotes, 2),
      monthReceived: toFixed(received.get(month) ?? new Decimal(0), 2),
      unpaidCount,
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
            immediateLimit: toFixed(new Decimal(IMMEDIATE_REGISTRATION_LIMIT), 0),
            immediateExceeded: yearTurnover.gt(IMMEDIATE_REGISTRATION_LIMIT),
            percent: Math.min(100, Math.round(yearTurnover.div(limit).times(100).toNumber())),
          }
        : null,
      months: [...byMonth.entries()].map(([key, v]) => ({
        month: key,
        turnover: toFixed(v.turnover, 2),
        paid: toFixed(v.paid, 2),
        unpaid: toFixed(v.turnover.minus(v.paid), 2),
        received: toFixed(received.get(key) ?? new Decimal(0), 2),
      })),
    }
  },

  /** The latest document events (issued, paid, sent, reminded, bank-matched) for the dashboard feed. */
  async activity(db: Db, orgId: string, limit: number) {
    const rows = await db
      .select({
        id: activity.id,
        action: activity.action,
        createdAt: activity.createdAt,
        documentId: document.id,
        number: document.number,
        type: document.type,
        customerName: sql<string | null>`${document.customerSnapshot}->>'name'`,
      })
      .from(activity)
      .innerJoin(
        document,
        and(eq(document.id, activity.entityId), eq(document.organizationId, orgId)),
      )
      .where(
        and(
          eq(activity.organizationId, orgId),
          eq(activity.entityType, 'document'),
          isNull(document.deletedAt),
          inArray(activity.action, [
            'issued',
            'paid',
            'partially_paid',
            'sent',
            'reminded',
            'bank_matched',
          ]),
        ),
      )
      .orderBy(desc(activity.createdAt), desc(activity.id))
      .limit(limit)
    return rows
  },
}
