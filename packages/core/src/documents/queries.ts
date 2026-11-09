import { type Db, schema } from '@fakturky/db'
import { Decimal, parseDecimal, renderPaymentQr, todayPrague, toFixed } from '@fakturky/domain'
import { and, asc, desc, eq, inArray, isNull, lt, ne, or, sql } from 'drizzle-orm'
import { appearanceRepo } from '../appearance/repo'
import { amountTerm, foldedWordsMatch } from '../fold'
import { totalsFor, vatOn } from './lines'
import { paymentQrInput } from './payment-qr'
import type { DraftInput } from './schema'
import { type DocRow, loadProfile, scoped, type Tx } from './shared'
import { deriveStatus, lastPaidOn, paidSums } from './status'

const { document, documentLine, payment, activity, contact } = schema

/** `recent` (last touched first) is internal: the command palette, not a public sort. */
export type ListSort = 'issueDate' | 'dueDate' | 'number' | 'customer' | 'total' | 'recent'

/**
 * Documents whose DUZP (issue date when none) falls in `from`..`to`, both ends inclusive.
 * A period means issued paperwork: drafts carry a provisional date and never match.
 */
export function periodWhere(from?: string, to?: string) {
  if (!from && !to) return undefined
  const date = sql`coalesce(${document.taxableDate}, ${document.issueDate})`
  return and(
    ne(document.status, 'draft'),
    from ? sql`${date} >= ${from}` : undefined,
    to ? sql`${date} <= ${to}` : undefined,
  )
}

/** WHERE for list/stats: tenant scope, filter chip, type, period and free-text search (joins `contact`). */
function listWhere(
  orgId: string,
  opts: {
    filter: 'all' | 'draft' | 'unpaid' | 'overdue' | 'paid' | 'cancelled'
    search?: string
    type?: 'invoice' | 'proforma' | 'credit_note' | 'payment_receipt'
    contactId?: string
    from?: string
    to?: string
  },
) {
  const today = todayPrague()
  const term = opts.search?.trim()
  const statusWhere = {
    all: undefined,
    draft: eq(document.status, 'draft'),
    unpaid: and(eq(document.status, 'issued'), ne(document.type, 'credit_note')),
    overdue: and(
      eq(document.status, 'issued'),
      ne(document.type, 'credit_note'),
      lt(document.dueDate, today),
    ),
    paid: eq(document.status, 'paid'),
    cancelled: eq(document.status, 'cancelled'),
  }[opts.filter]
  return and(
    eq(document.organizationId, orgId),
    isNull(document.deletedAt),
    statusWhere,
    opts.type ? eq(document.type, opts.type) : undefined,
    opts.contactId ? eq(document.contactId, opts.contactId) : undefined,
    periodWhere(opts.from, opts.to),
    term ? documentSearch(term) : undefined,
  )
}

/** Number, VS, customer (snapshot or live contact) and amount; case- and diacritics-insensitive. */
export function documentSearch(term: string) {
  const amount = amountTerm(term)
  return or(
    foldedWordsMatch(term, [
      sql`${document.number}`,
      sql`${document.variableSymbol}`,
      sql`${document.customerSnapshot}->>'name'`,
      sql`${contact.name}`,
      // The IČO printed on an issued document, not whatever the contact says today.
      sql`coalesce(${document.customerSnapshot}->>'ico', ${contact.ico})`,
    ]),
    amount ? sql`${document.total}::text like ${`%${amount}%`}` : undefined,
  )
}

function decorate(doc: DocRow, paid: Decimal, customerName: string | null) {
  const diff = parseDecimal(doc.total).minus(paid)
  const remaining = diff.isNegative() ? new Decimal(0) : diff
  return {
    ...doc,
    displayStatus: deriveStatus(doc, paid),
    customerName,
    paidAmount: toFixed(paid, 2),
    remaining: toFixed(remaining, 2),
  }
}

/** The corrected document of a credit note (same organization), or null. */
export async function loadOriginal(db: Db | Tx, orgId: string, doc: DocRow) {
  if (doc.type !== 'credit_note' || !doc.relatedDocumentId) return null
  const [o] = await db
    .select({ id: document.id, number: document.number, issueDate: document.issueDate })
    .from(document)
    .where(and(eq(document.organizationId, orgId), eq(document.id, doc.relatedDocumentId)))
  return o?.number && o.issueDate ? { number: o.number, issueDate: o.issueDate, uuid: o.id } : null
}

/** Issued (numbered) documents only; drafts have no legal content to export. */
export async function forExport(db: Db, orgId: string, id: string) {
  const [doc] = await db.select().from(document).where(scoped(orgId, id))
  if (!doc || doc.status === 'draft') return null
  const lines = await db
    .select()
    .from(documentLine)
    .where(and(eq(documentLine.organizationId, orgId), eq(documentLine.documentId, id)))
    .orderBy(asc(documentLine.position))
  return { doc, lines, original: await loadOriginal(db, orgId, doc) }
}

export async function defaults(db: Db, orgId: string) {
  const p = await loadProfile(db, orgId)
  return {
    vatPayer: p?.vatStatus === 'payer',
    hasProfile: p !== null,
    currency: p?.defaultCurrency ?? 'CZK',
    dueDays: p?.defaultDueDays ?? 14,
    language: p?.defaultLanguage ?? 'cs',
    paymentMethod: p?.defaultPaymentMethod ?? 'bank_transfer',
    footerText: p?.defaultFooter ?? null,
    registryNoteMissing: !p?.registryNote?.trim(),
  }
}

export async function list(
  db: Db,
  orgId: string,
  opts: {
    filter: 'all' | 'draft' | 'unpaid' | 'overdue' | 'paid' | 'cancelled'
    search?: string
    type?: 'invoice' | 'proforma' | 'credit_note' | 'payment_receipt'
    contactId?: string
    from?: string
    to?: string
    sort?: ListSort
    dir?: 'asc' | 'desc'
    limit: number
    offset: number
  },
) {
  const dir = opts.dir === 'asc' ? asc : desc
  const customerName = sql`lower(coalesce(${document.customerSnapshot}->>'name', ${contact.name}, ''))`
  const orderBy = {
    recent: [desc(document.updatedAt), desc(document.id)],
    issueDate: [dir(document.issueDate), dir(document.createdAt), dir(document.id)],
    dueDate: [dir(document.dueDate), desc(document.createdAt), desc(document.id)],
    number: [dir(document.number), desc(document.createdAt), desc(document.id)],
    customer: [dir(customerName), desc(document.createdAt), desc(document.id)],
    total: [
      dir(sql`coalesce(${document.totalCzk}, ${document.total})`),
      desc(document.createdAt),
      desc(document.id),
    ],
  }[opts.sort ?? 'issueDate']
  const rows = await db
    .select({ doc: document, contactName: contact.name })
    .from(document)
    .leftJoin(contact, and(eq(contact.id, document.contactId), eq(contact.organizationId, orgId)))
    .where(listWhere(orgId, opts))
    .orderBy(...orderBy)
    .limit(opts.limit)
    .offset(opts.offset)
  const sums = await paidSums(
    db,
    orgId,
    rows.map((r) => r.doc.id),
  )
  // Drafts the assistant created are flagged so the UI can show "Koncept · navrhl asistent".
  const viaRows = rows.length
    ? await db
        .select({ id: activity.entityId })
        .from(activity)
        .where(
          and(
            eq(activity.organizationId, orgId),
            eq(activity.entityType, 'document'),
            eq(activity.action, 'created'),
            sql`${activity.data}->>'via' = 'assistant'`,
            inArray(
              activity.entityId,
              rows.map((r) => r.doc.id),
            ),
          ),
        )
    : []
  const viaAssistant = new Set(viaRows.map((r) => r.id))
  const paidOn = await lastPaidOn(
    db,
    orgId,
    rows.map((r) => r.doc.id),
  )
  return rows.map(({ doc, contactName }) => ({
    paidOn: paidOn.get(doc.id) ?? null,
    ...decorate(
      doc,
      sums.get(doc.id) ?? new Decimal(0),
      (doc.customerSnapshot?.name as string | undefined) ?? contactName,
    ),
    viaAssistant: viaAssistant.has(doc.id),
  }))
}

/**
 * Counts and CZK sums for the list's filter chips. Unpaid/overdue sum what is still owed;
 * the other buckets sum the document totals (credit notes net). Respects `search` and `type`.
 */
export async function stats(
  db: Db,
  orgId: string,
  opts: {
    search?: string
    type?: 'invoice' | 'proforma' | 'credit_note' | 'payment_receipt'
    from?: string
    to?: string
  },
) {
  const today = todayPrague()
  const rows = await db
    .select({
      id: document.id,
      status: document.status,
      type: document.type,
      dueDate: document.dueDate,
      total: document.total,
      totalCzk: document.totalCzk,
      currency: document.currency,
    })
    .from(document)
    .leftJoin(contact, and(eq(contact.id, document.contactId), eq(contact.organizationId, orgId)))
    .where(listWhere(orgId, { filter: 'all', ...opts }))
  const sums = await paidSums(
    db,
    orgId,
    rows.filter((r) => r.status === 'issued').map((r) => r.id),
  )
  const bucket = () => ({ count: 0, sum: new Decimal(0) })
  const out = {
    all: bucket(),
    draft: bucket(),
    unpaid: bucket(),
    overdue: bucket(),
    paid: bucket(),
  }
  for (const r of rows) {
    const total = parseDecimal(r.total)
    const czk = (amount: Decimal) =>
      r.currency === 'CZK' || total.isZero() || !r.totalCzk
        ? amount
        : amount.times(parseDecimal(r.totalCzk)).div(total)
    out.all.count++
    if (r.status === 'draft') {
      out.draft.count++
      out.draft.sum = out.draft.sum.plus(czk(total))
      continue
    }
    if (r.status === 'cancelled') continue
    out.all.sum = out.all.sum.plus(czk(total))
    if (r.status === 'paid') {
      out.paid.count++
      out.paid.sum = out.paid.sum.plus(czk(total))
    } else if (r.status === 'issued' && r.type !== 'credit_note') {
      const left = total.minus(sums.get(r.id) ?? 0)
      out.unpaid.count++
      out.unpaid.sum = out.unpaid.sum.plus(czk(left.isNegative() ? new Decimal(0) : left))
      if (r.dueDate && r.dueDate < today) {
        out.overdue.count++
        out.overdue.sum = out.overdue.sum.plus(czk(left.isNegative() ? new Decimal(0) : left))
      }
    }
  }
  const fmt = (b: ReturnType<typeof bucket>) => ({ count: b.count, sum: toFixed(b.sum, 2) })
  return {
    all: fmt(out.all),
    draft: fmt(out.draft),
    unpaid: fmt(out.unpaid),
    overdue: fmt(out.overdue),
    paid: fmt(out.paid),
  }
}

export async function get(db: Db | Tx, orgId: string, id: string) {
  const [doc] = await db.select().from(document).where(scoped(orgId, id))
  if (!doc) return null
  const [lines, payments, acts, [c]] = await Promise.all([
    db
      .select()
      .from(documentLine)
      .where(and(eq(documentLine.organizationId, orgId), eq(documentLine.documentId, id)))
      .orderBy(asc(documentLine.position)),
    db
      .select()
      .from(payment)
      .where(and(eq(payment.organizationId, orgId), eq(payment.documentId, id)))
      .orderBy(asc(payment.paidOn), asc(payment.createdAt)),
    db
      .select()
      .from(activity)
      .where(
        and(
          eq(activity.organizationId, orgId),
          eq(activity.entityType, 'document'),
          eq(activity.entityId, id),
        ),
      )
      .orderBy(asc(activity.createdAt)),
    doc.contactId
      ? db
          .select({ name: contact.name })
          .from(contact)
          .where(and(eq(contact.organizationId, orgId), eq(contact.id, doc.contactId)))
      : Promise.resolve([] as { name: string }[]),
  ])
  const paid = payments.reduce((s, p) => s.plus(parseDecimal(p.amount)), new Decimal(0))
  const profile = doc.status === 'draft' ? await loadProfile(db, orgId) : null
  const totals = totalsFor(lines.map((l) => ({ ...l, unit: l.unit })) as DraftInput['lines'], {
    vatPayer:
      doc.status === 'draft'
        ? await vatOn(db, orgId, profile, doc.type, doc.relatedDocumentId)
        : doc.vatMode !== 'none',
    roundTotal: doc.roundTotal,
    pricesIncludeVat: doc.pricesIncludeVat,
    currency: doc.currency,
    exchangeRate: doc.exchangeRate,
  })
  return {
    ...decorate(doc, paid, (doc.customerSnapshot?.name as string | undefined) ?? c?.name ?? null),
    lines,
    payments,
    vatRecap: totals.recap.map((r) => ({
      vatRate: r.vatRate,
      vatTreatment: r.vatTreatment,
      base: r.base,
      vat: r.vat,
      total: r.total,
    })),
    activity: acts,
    /** Look frozen at issue; a draft follows the live settings. Logo/signature as data URLs. */
    look: await appearanceRepo
      .forDocument(db, orgId, doc.status === 'draft' ? null : doc.appearance)
      .then((l) => ({
        accentColor: l.accentColor,
        showBrand: l.showBrand,
        logo: l.logo?.dataUrl ?? null,
        signature: l.signature?.dataUrl ?? null,
      })),
    paymentQr:
      doc.status === 'draft' ? null : await renderPaymentQr(paymentQrInput(doc, lines, paid)),
    /** The document this one corrects or was created from (proforma, invoice), if any. */
    parent: doc.relatedDocumentId
      ? ((
          await db
            .select({
              id: document.id,
              type: document.type,
              number: document.number,
              status: document.status,
              issueDate: document.issueDate,
            })
            .from(document)
            .where(and(eq(document.organizationId, orgId), eq(document.id, doc.relatedDocumentId)))
        )[0] ?? null)
      : null,
    related: await db
      .select({
        id: document.id,
        type: document.type,
        number: document.number,
        status: document.status,
      })
      .from(document)
      .where(
        and(
          eq(document.organizationId, orgId),
          eq(document.relatedDocumentId, id),
          isNull(document.deletedAt),
        ),
      ),
    viaAssistant: acts.some(
      (a) => a.action === 'created' && (a.data as { via?: string } | null)?.via === 'assistant',
    ),
  }
}
