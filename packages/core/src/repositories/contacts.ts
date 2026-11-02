import type { Db } from '@fakturky/db'
import { schema } from '@fakturky/db'
import { Decimal, parseDecimal, todayPrague, toFixed } from '@fakturky/domain'
import { and, asc, eq, ilike, inArray, isNotNull, isNull, or, sql } from 'drizzle-orm'
import type { ContactInput, ContactPatch } from '../schemas/contact'
import { paidSums } from './documents'

const { contact, document } = schema

/** Every function takes `orgId` and scopes by it. No exceptions. */
export const contactsRepo = {
  async list(
    db: Db,
    orgId: string,
    opts: { search?: string; includeArchived?: boolean; limit: number; offset: number },
  ) {
    const term = opts.search?.trim()
    const where = and(
      eq(contact.organizationId, orgId),
      opts.includeArchived ? undefined : isNull(contact.archivedAt),
      term
        ? or(
            ilike(contact.name, `%${term}%`),
            ilike(sql`coalesce(${contact.ico}, '')`, `%${term}%`),
          )
        : undefined,
    )
    return db
      .select()
      .from(contact)
      .where(where)
      .orderBy(asc(contact.name), asc(contact.id))
      .limit(opts.limit)
      .offset(opts.offset)
  },

  /**
   * Per-contact billing figures in CZK: invoiced (issued + paid invoices, credit notes netted),
   * still owed, overdue, document count and the latest issue date. Contacts without documents are omitted.
   */
  async stats(db: Db, orgId: string, opts: { contactId?: string }) {
    const today = todayPrague()
    const [y, mo] = [Number(today.slice(0, 4)), Number(today.slice(5, 7))]
    // The last 12 calendar months, oldest first.
    const months = Array.from({ length: 12 }, (_, i) =>
      new Date(Date.UTC(y, mo - 12 + i, 1)).toISOString().slice(0, 7),
    )
    const rows = await db
      .select({
        id: document.id,
        contactId: document.contactId,
        type: document.type,
        status: document.status,
        issueDate: document.issueDate,
        taxableDate: document.taxableDate,
        dueDate: document.dueDate,
        total: document.total,
        subtotal: document.subtotal,
        totalCzk: document.totalCzk,
        currency: document.currency,
      })
      .from(document)
      .where(
        and(
          eq(document.organizationId, orgId),
          isNull(document.deletedAt),
          isNotNull(document.contactId),
          inArray(document.type, ['invoice', 'credit_note']),
          inArray(document.status, ['issued', 'paid']),
          opts.contactId ? eq(document.contactId, opts.contactId) : undefined,
        ),
      )
    const paid = await paidSums(
      db,
      orgId,
      rows.filter((r) => r.status === 'issued' && r.type === 'invoice').map((r) => r.id),
    )
    const out = new Map<
      string,
      {
        invoiced: Decimal
        outstanding: Decimal
        overdue: Decimal
        count: number
        last: string | null
        monthly: Map<string, Decimal>
      }
    >()
    for (const r of rows) {
      if (!r.contactId) continue
      const e = out.get(r.contactId) ?? {
        invoiced: new Decimal(0),
        outstanding: new Decimal(0),
        overdue: new Decimal(0),
        count: 0,
        last: null,
        monthly: new Map(),
      }
      out.set(r.contactId, e)
      const total = parseDecimal(r.total)
      const czk = (amount: Decimal) =>
        r.currency === 'CZK' || total.isZero() || !r.totalCzk
          ? amount
          : amount.times(parseDecimal(r.totalCzk)).div(total)
      e.invoiced = e.invoiced.plus(czk(total))
      e.count++
      const key = (r.taxableDate ?? r.issueDate ?? '').slice(0, 7)
      if (key)
        e.monthly.set(
          key,
          (e.monthly.get(key) ?? new Decimal(0)).plus(czk(parseDecimal(r.subtotal ?? r.total))),
        )
      if (r.issueDate && (!e.last || r.issueDate > e.last)) e.last = r.issueDate
      if (r.status === 'issued' && r.type === 'invoice') {
        const left = total.minus(paid.get(r.id) ?? 0)
        if (left.gt(0)) {
          e.outstanding = e.outstanding.plus(czk(left))
          if (r.dueDate && r.dueDate < today) e.overdue = e.overdue.plus(czk(left))
        }
      }
    }
    return [...out.entries()].map(([contactId, e]) => ({
      contactId,
      invoiced: toFixed(e.invoiced, 2),
      outstanding: toFixed(e.outstanding, 2),
      overdue: toFixed(e.overdue, 2),
      documentCount: e.count,
      lastInvoiceDate: e.last,
      monthly: months.map((m) => toFixed(e.monthly.get(m) ?? new Decimal(0), 2)),
    }))
  },

  async get(db: Db, orgId: string, id: string) {
    const [row] = await db
      .select()
      .from(contact)
      .where(and(eq(contact.organizationId, orgId), eq(contact.id, id)))
    return row ?? null
  },

  async create(db: Db, orgId: string, input: ContactInput) {
    const [row] = await db
      .insert(contact)
      .values({ ...input, organizationId: orgId })
      .returning()
    if (!row) throw new Error('insert returned no row')
    return row
  },

  async update(db: Db, orgId: string, id: string, input: ContactPatch) {
    const [row] = await db
      .update(contact)
      .set(input)
      .where(and(eq(contact.organizationId, orgId), eq(contact.id, id)))
      .returning()
    return row ?? null
  },

  async archive(db: Db, orgId: string, id: string) {
    const [row] = await db
      .update(contact)
      .set({ archivedAt: new Date() })
      .where(and(eq(contact.organizationId, orgId), eq(contact.id, id)))
      .returning()
    return row ?? null
  },
}
