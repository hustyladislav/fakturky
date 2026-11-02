import { randomBytes } from 'node:crypto'
import type { Db } from '@fakturky/db'
import { schema } from '@fakturky/db'
import {
  addDays,
  buildPaymentQrPayload,
  computeDocumentTotals,
  DEFAULT_NUMBER_PATTERNS,
  Decimal,
  formatDateCs,
  formatDocumentNumber,
  formatMoney,
  getRate,
  parseDecimal,
  periodKey,
  renderPaymentQr,
  todayPrague,
  toFixed,
  VAT_RATES,
  type VatTreatment,
  variableSymbolFromNumber,
} from '@fakturky/domain'
import { and, asc, desc, eq, ilike, inArray, isNull, lt, ne, or, sql } from 'drizzle-orm'
import { MailError, type Services } from '../context'
import { paymentQrInput } from '../payment-qr'
import type { DisplayStatus, DraftInput, DraftPatch } from '../schemas/document'
import { appearanceRepo } from './appearance'
import { bankAccountsRepo } from './bank-accounts'

const {
  bankTransaction,
  document,
  documentLine,
  payment,
  activity,
  businessProfile,
  contact,
  numberSeries,
  orgAsset,
} = schema

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]
type DocRow = typeof document.$inferSelect

/** Domain-level failure; the router maps `code` onto an oRPC error. */
export class DocumentError extends Error {
  constructor(
    readonly code: 'NOT_FOUND' | 'CONFLICT' | 'PRECONDITION_FAILED' | 'BAD_REQUEST',
    message: string,
    readonly fields?: string[],
  ) {
    super(message)
  }
}

const scoped = (orgId: string, id: string) =>
  and(eq(document.organizationId, orgId), eq(document.id, id), isNull(document.deletedAt))

export function deriveStatus(
  doc: Pick<DocRow, 'status' | 'dueDate'> & { type?: string },
  paid: Decimal,
  today = todayPrague(),
): DisplayStatus {
  switch (doc.status) {
    case 'draft':
      return 'draft'
    case 'paid':
      return 'paid'
    case 'cancelled':
      return 'cancelled'
    default:
      // A credit note is a correction, never a receivable: it cannot be overdue.
      if (doc.type !== 'credit_note' && doc.dueDate && doc.dueDate < today) return 'overdue'
      return paid.gt(0) ? 'partially_paid' : 'issued'
  }
}

async function logActivity(
  tx: Db | Tx,
  orgId: string,
  actorId: string | null,
  entityId: string,
  action: string,
  data?: Record<string, unknown>,
) {
  await tx
    .insert(activity)
    .values({ organizationId: orgId, actorId, entityType: 'document', entityId, action, data })
}

async function loadProfile(db: Db | Tx, orgId: string) {
  const [p] = await db
    .select()
    .from(businessProfile)
    .where(eq(businessProfile.organizationId, orgId))
  return p ?? null
}

/** VAT applies only to tax documents issued by a VAT payer; proformas never carry VAT. */
const SERIES_NAMES: Record<string, string> = {
  invoice: 'Faktury',
  proforma: 'Zálohové faktury',
  credit_note: 'Opravné doklady',
  payment_receipt: 'Doklady k přijaté platbě',
}

/** A user-supplied money string ("1500", "1 500,5"); anything else is a client error, not a 500. */
function parseAmount(raw: string) {
  const v = raw.replace(/[\s\u00a0]/g, '').replace(',', '.')
  if (!/^-?\d+(\.\d+)?$/.test(v)) throw new DocumentError('BAD_REQUEST', 'Amount is not a number')
  return parseDecimal(v)
}

const vatApplies = (profile: { vatStatus: string } | null, type: string) =>
  profile?.vatStatus === 'payer' &&
  (type === 'invoice' || type === 'credit_note' || type === 'payment_receipt')

/**
 * Whether VAT is computed. A credit note follows the VAT treatment of the invoice it corrects (the
 * supplier's status may have changed since), everything else follows the current profile.
 */
async function vatOn(
  db: Db | Tx,
  orgId: string,
  profile: { vatStatus: string } | null,
  type: string,
  relatedId: string | null | undefined,
) {
  if (type !== 'credit_note') return vatApplies(profile, type)
  if (!relatedId) return false
  const [o] = await db
    .select({ vatMode: document.vatMode })
    .from(document)
    .where(and(eq(document.organizationId, orgId), eq(document.id, relatedId)))
  return !!o && o.vatMode !== 'none'
}

/** A VAT payer's standard-rated line needs a real rate (there is no 0 % in Czech VAT: use a regime). */
function assertVatLines(
  lines: Array<{ vatRate: string; vatTreatment?: string }>,
  vatPayer: boolean,
) {
  if (!vatPayer) return
  const bad = lines.find(
    (l) =>
      (l.vatTreatment ?? 'standard') === 'standard' &&
      !(VAT_RATES.CZ as readonly string[]).includes(String(Number(l.vatRate))),
  )
  if (bad) {
    throw new DocumentError(
      'BAD_REQUEST',
      'Use a VAT rate of 21 or 12, or choose a VAT regime (exempt, reverse charge, …) for the line',
      ['line.vatRate'],
    )
  }
}

/** Freezes the document look (colour, brand line, logo/signature versions) at issue. */
async function appearanceSnapshot(db: Db | Tx, orgId: string) {
  const [p] = await db
    .select({ accentColor: businessProfile.accentColor, showBrand: businessProfile.showBrand })
    .from(businessProfile)
    .where(eq(businessProfile.organizationId, orgId))
  const assets = await db
    .select({ id: orgAsset.id, kind: orgAsset.kind })
    .from(orgAsset)
    .where(and(eq(orgAsset.organizationId, orgId), isNull(orgAsset.supersededAt)))
  return {
    accentColor: p?.accentColor ?? null,
    showBrand: p?.showBrand ?? true,
    logoAssetId: assets.find((a) => a.kind === 'logo')?.id ?? null,
    signatureAssetId: assets.find((a) => a.kind === 'signature')?.id ?? null,
  }
}

function totalsFor(
  lines: DraftInput['lines'],
  opts: {
    vatPayer: boolean
    currency: string
    exchangeRate?: string | null
    roundTotal?: boolean
    pricesIncludeVat?: boolean
  },
) {
  return computeDocumentTotals(
    lines.map((l) => ({
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      vatRate: l.vatRate,
      vatTreatment: l.vatTreatment as VatTreatment | undefined,
      discountPercent: l.discountPercent,
    })),
    {
      vatPayer: opts.vatPayer,
      roundTotal: opts.roundTotal ?? false,
      pricesIncludeVat: opts.pricesIncludeVat ?? false,
      currency: opts.currency,
      exchangeRate: opts.currency === 'CZK' ? 1 : (opts.exchangeRate ?? 1),
    },
  )
}

async function writeLines(
  tx: Tx,
  orgId: string,
  documentId: string,
  lines: DraftInput['lines'],
  totals: ReturnType<typeof computeDocumentTotals>,
  vatOn: boolean,
) {
  await tx
    .delete(documentLine)
    .where(and(eq(documentLine.organizationId, orgId), eq(documentLine.documentId, documentId)))
  if (lines.length === 0) return
  await tx.insert(documentLine).values(
    lines.map((l, i) => ({
      organizationId: orgId,
      documentId,
      position: i,
      description: l.description,
      quantity: l.quantity,
      unit: l.unit ?? null,
      unitPrice: l.unitPrice,
      vatRate: totals.lines[i]?.vatRate ?? '0',
      vatTreatment: vatOn ? (totals.lines[i]?.vatTreatment ?? 'standard') : 'standard',
      vatNote:
        vatOn && totals.lines[i]?.vatTreatment === 'exempt' ? l.vatNote?.trim() || null : null,
      discountPercent: l.discountPercent,
      lineSubtotal: totals.lines[i]?.base ?? '0',
      lineVat: totals.lines[i]?.vat ?? '0',
      lineTotal: totals.lines[i]?.total ?? '0',
    })),
  )
}

function totalColumns(totals: ReturnType<typeof computeDocumentTotals>, currency: string) {
  return {
    subtotal: totals.subtotal,
    vatTotal: totals.vatTotal,
    total: totals.total,
    totalCzk: currency === 'CZK' ? totals.total : totals.totalCzk,
    rounding: totals.rounding,
  }
}

/** `payment.method` of the settlement a credit note makes on its invoice (the note holds the credit note number). */
export const CREDIT_NOTE_METHOD = 'credit_note'

export async function paidSums(db: Db | Tx, orgId: string, ids: string[]) {
  const map = new Map<string, Decimal>()
  if (ids.length === 0) return map
  const rows = await db
    .select({ documentId: payment.documentId, amount: payment.amount })
    .from(payment)
    .where(and(eq(payment.organizationId, orgId), inArray(payment.documentId, ids)))
  for (const r of rows) {
    map.set(r.documentId, (map.get(r.documentId) ?? new Decimal(0)).plus(parseDecimal(r.amount)))
  }
  return map
}

export type ListSort = 'issueDate' | 'dueDate' | 'number' | 'customer' | 'total'

/** WHERE for list/stats: tenant scope, filter chip, type and free-text search (joins `contact`). */
function listWhere(
  orgId: string,
  opts: {
    filter: 'all' | 'draft' | 'unpaid' | 'overdue' | 'paid' | 'cancelled'
    search?: string
    type?: 'invoice' | 'proforma' | 'credit_note' | 'payment_receipt'
    contactId?: string
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
    term
      ? or(
          ilike(sql`coalesce(${document.number}, '')`, `%${term}%`),
          ilike(sql`coalesce(${document.variableSymbol}, '')`, `%${term}%`),
          ilike(sql`coalesce(${document.customerSnapshot}->>'name', '')`, `%${term}%`),
          ilike(sql`coalesce(${contact.name}, '')`, `%${term}%`),
        )
      : undefined,
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

export const documentsRepo = {
  /** Issued (numbered) documents only; drafts have no legal content to export. */
  async forExport(db: Db, orgId: string, id: string) {
    const [doc] = await db.select().from(document).where(scoped(orgId, id))
    if (!doc || doc.status === 'draft') return null
    const lines = await db
      .select()
      .from(documentLine)
      .where(and(eq(documentLine.organizationId, orgId), eq(documentLine.documentId, id)))
      .orderBy(asc(documentLine.position))
    return { doc, lines, original: await loadOriginal(db, orgId, doc) }
  },

  async defaults(db: Db, orgId: string) {
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
  },

  async list(
    db: Db,
    orgId: string,
    opts: {
      filter: 'all' | 'draft' | 'unpaid' | 'overdue' | 'paid' | 'cancelled'
      search?: string
      type?: 'invoice' | 'proforma' | 'credit_note' | 'payment_receipt'
      contactId?: string
      sort?: ListSort
      dir?: 'asc' | 'desc'
      limit: number
      offset: number
    },
  ) {
    const dir = opts.dir === 'asc' ? asc : desc
    const customerName = sql`lower(coalesce(${document.customerSnapshot}->>'name', ${contact.name}, ''))`
    const orderBy = {
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
    return rows.map(({ doc, contactName }) => ({
      ...decorate(
        doc,
        sums.get(doc.id) ?? new Decimal(0),
        (doc.customerSnapshot?.name as string | undefined) ?? contactName,
      ),
      viaAssistant: viaAssistant.has(doc.id),
    }))
  },

  /**
   * Counts and CZK sums for the list's filter chips. Unpaid/overdue sum what is still owed;
   * the other buckets sum the document totals (credit notes net). Respects `search` and `type`.
   */
  async stats(
    db: Db,
    orgId: string,
    opts: { search?: string; type?: 'invoice' | 'proforma' | 'credit_note' | 'payment_receipt' },
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
  },

  async get(db: Db | Tx, orgId: string, id: string) {
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
      /** Look frozen at issue (live settings for drafts); logo/signature as data URLs. */
      look: await appearanceRepo.forDocument(db, orgId, doc.appearance).then((l) => ({
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
              .where(
                and(eq(document.organizationId, orgId), eq(document.id, doc.relatedDocumentId)),
              )
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
  },

  async createDraft(
    db: Db,
    orgId: string,
    actorId: string,
    input: DraftInput,
    opts: { relatedDocumentId?: string; pricesIncludeVat?: boolean } = {},
    via?: 'assistant',
  ) {
    if (input.type === 'payment_receipt' && !opts.relatedDocumentId) {
      throw new DocumentError(
        'BAD_REQUEST',
        'Tax receipts are created from a paid proforma (createPaymentReceipt)',
      )
    }
    if (input.type === 'credit_note' && !opts.relatedDocumentId) {
      throw new DocumentError(
        'BAD_REQUEST',
        'Credit notes are created from an invoice (createCreditNote)',
      )
    }
    const id = await db.transaction(async (tx) => {
      const profile = await loadProfile(tx, orgId)
      const issueDate = input.issueDate ?? todayPrague()
      let dueDays = profile?.defaultDueDays ?? 14
      if (input.contactId) {
        const [c] = await tx
          .select()
          .from(contact)
          .where(and(eq(contact.organizationId, orgId), eq(contact.id, input.contactId)))
        if (!c) throw new DocumentError('NOT_FOUND', 'Contact not found')
        dueDays = c.defaultDueDays ?? dueDays
      }
      const currency = input.currency ?? profile?.defaultCurrency ?? 'CZK'
      const vatPayer = await vatOn(tx, orgId, profile, input.type, opts.relatedDocumentId)
      assertVatLines(input.lines, vatPayer)
      const paymentMethod = input.paymentMethod ?? profile?.defaultPaymentMethod ?? 'bank_transfer'
      // Whole-koruna rounding is the default for CZK cash payments (docs/DOMAIN.md); an explicit choice wins.
      const roundTotal = input.roundTotal ?? (currency === 'CZK' && paymentMethod === 'cash')
      const totals = totalsFor(input.lines, {
        vatPayer,
        roundTotal,
        pricesIncludeVat: opts.pricesIncludeVat,
        currency,
        exchangeRate: input.exchangeRate,
      })
      const bank = input.bankAccountId
        ? await bankAccountsRepo.get(tx, orgId, input.bankAccountId)
        : await bankAccountsRepo.defaultFor(tx, orgId, currency)
      if (input.bankAccountId && !bank)
        throw new DocumentError('NOT_FOUND', 'Bank account not found')
      const [row] = await tx
        .insert(document)
        .values({
          organizationId: orgId,
          type: input.type,
          roundTotal,
          pricesIncludeVat: opts.pricesIncludeVat ?? false,
          relatedDocumentId: opts.relatedDocumentId ?? null,
          contactId: input.contactId ?? null,
          bankAccountId: bank?.id ?? null,
          appearance: await appearanceSnapshot(tx, orgId),
          issueDate,
          taxableDate: input.taxableDate ?? issueDate,
          dueDate: input.dueDate ?? addDays(issueDate, dueDays),
          currency,
          exchangeRate: input.exchangeRate ?? null,
          language: input.language ?? profile?.defaultLanguage ?? 'cs',
          paymentMethod: input.paymentMethod ?? profile?.defaultPaymentMethod ?? 'bank_transfer',
          constantSymbol: input.constantSymbol ?? null,
          orderNumber: input.orderNumber ?? null,
          introText: input.introText ?? null,
          footerText: input.footerText ?? profile?.defaultFooter ?? null,
          privateNote: input.privateNote ?? null,
          vatMode: vatPayer ? 'standard' : 'none',
          ...totalColumns(totals, currency),
        })
        .returning({ id: document.id })
      if (!row) throw new Error('insert returned no row')
      await writeLines(tx, orgId, row.id, input.lines, totals, vatPayer)
      await logActivity(tx, orgId, actorId, row.id, 'created', via ? { via } : undefined)
      return row.id
    })
    return this.get(db, orgId, id)
  },

  async updateDraft(db: Db, orgId: string, actorId: string, id: string, patch: DraftPatch) {
    await db.transaction(async (tx) => {
      const [doc] = await tx.select().from(document).where(scoped(orgId, id)).for('update')
      if (!doc) throw new DocumentError('NOT_FOUND', 'Document not found')
      if (doc.status !== 'draft') {
        throw new DocumentError(
          'CONFLICT',
          'Only drafts can be edited; issued documents are immutable',
        )
      }
      const { lines, ...rest } = patch
      if (rest.contactId) {
        const [c] = await tx
          .select({ id: contact.id })
          .from(contact)
          .where(and(eq(contact.organizationId, orgId), eq(contact.id, rest.contactId)))
        if (!c) throw new DocumentError('NOT_FOUND', 'Contact not found')
      }
      if (rest.bankAccountId && !(await bankAccountsRepo.get(tx, orgId, rest.bankAccountId))) {
        throw new DocumentError('NOT_FOUND', 'Bank account not found')
      }
      const profile = await loadProfile(tx, orgId)
      const currency = rest.currency ?? doc.currency
      const exchangeRate = rest.exchangeRate === undefined ? doc.exchangeRate : rest.exchangeRate
      const existingLines = lines
        ? null
        : await tx
            .select()
            .from(documentLine)
            .where(and(eq(documentLine.organizationId, orgId), eq(documentLine.documentId, id)))
      const effective = (lines ?? existingLines ?? []) as DraftInput['lines']
      const vatForDraft = await vatOn(tx, orgId, profile, doc.type, doc.relatedDocumentId)
      assertVatLines(effective, vatForDraft)
      const roundTotal = rest.roundTotal ?? doc.roundTotal
      const totals = totalsFor(effective, {
        vatPayer: vatForDraft,
        roundTotal,
        pricesIncludeVat: doc.pricesIncludeVat,
        currency,
        exchangeRate,
      })
      await tx
        .update(document)
        .set({
          ...rest,
          currency,
          exchangeRate,
          vatMode: vatForDraft ? 'standard' : 'none',
          ...totalColumns(totals, currency),
        })
        .where(scoped(orgId, id))
      if (lines) await writeLines(tx, orgId, id, lines, totals, vatForDraft)
      await logActivity(tx, orgId, actorId, id, 'updated')
    })
    return this.get(db, orgId, id)
  },

  async issue(db: Db, orgId: string, actorId: string, id: string) {
    await db.transaction(async (tx) => {
      const [doc] = await tx.select().from(document).where(scoped(orgId, id)).for('update')
      if (!doc) throw new DocumentError('NOT_FOUND', 'Document not found')
      if (doc.status !== 'draft') throw new DocumentError('CONFLICT', 'Document is already issued')
      const profile = await loadProfile(tx, orgId)
      if (!profile) {
        throw new DocumentError(
          'PRECONDITION_FAILED',
          'Fill in your business profile before issuing',
        )
      }
      if (!doc.contactId) throw new DocumentError('PRECONDITION_FAILED', 'Choose a customer first')
      const lines = await tx
        .select()
        .from(documentLine)
        .where(and(eq(documentLine.organizationId, orgId), eq(documentLine.documentId, id)))
      if (lines.length === 0)
        throw new DocumentError('PRECONDITION_FAILED', 'Add at least one line')
      if (doc.currency !== 'CZK' && !doc.exchangeRate) {
        throw new DocumentError(
          'PRECONDITION_FAILED',
          'Exchange rate is required for foreign currency',
        )
      }
      const vatOnNow = await vatOn(tx, orgId, profile, doc.type, doc.relatedDocumentId)
      const [customer] = await tx
        .select()
        .from(contact)
        .where(and(eq(contact.organizationId, orgId), eq(contact.id, doc.contactId)))
      if (!customer) throw new DocumentError('NOT_FOUND', 'Contact not found')
      // §29 ZDPH: a tax document needs the customer's name and address; the DIČ only if the customer is registered
      // (a consumer has none), so a missing IČO/DIČ must not block issuing.
      if (vatOnNow) {
        const exempt = lines.filter((l) => l.vatTreatment === 'exempt')
        if (exempt.some((l) => !l.vatNote?.trim())) {
          throw new DocumentError(
            'PRECONDITION_FAILED',
            'Exempt lines need the statutory basis (§ of the VAT act)',
            ['line.vatNote'],
          )
        }
        const missing: string[] = []
        if (
          !customer.address.street?.trim() ||
          !customer.address.city?.trim() ||
          !customer.address.zip?.trim()
        ) {
          missing.push('address')
        }
        // EU reverse charge needs the customer's VAT ID (IČ DPH / DIČ), not just an IČO.
        if (
          lines.some((l) => l.vatTreatment === 'eu_reverse_charge') &&
          !customer.icDph?.trim() &&
          !customer.dic?.trim()
        ) {
          missing.push('vatId')
        }
        // The EU reverse charge applies to supplies to another member state, not to a domestic customer.
        if (
          lines.some((l) => l.vatTreatment === 'eu_reverse_charge') &&
          (customer.country ?? 'CZ').toUpperCase() === 'CZ'
        ) {
          missing.push('country')
        }
        if (missing.length > 0) {
          throw new DocumentError(
            'PRECONDITION_FAILED',
            `The customer is missing: ${missing.join(', ')}`,
            missing.map((f) => `customer.${f}`),
          )
        }
      }
      const bank = doc.bankAccountId
        ? await bankAccountsRepo.get(tx, orgId, doc.bankAccountId)
        : await bankAccountsRepo.defaultFor(tx, orgId, doc.currency)

      // Totals are recomputed under the VAT status being snapshotted (it may have changed since the draft).
      if (doc.type === 'credit_note' && (!doc.relatedDocumentId || !doc.introText?.trim())) {
        throw new DocumentError(
          'PRECONDITION_FAILED',
          'A credit note needs the corrected invoice and a reason',
        )
      }
      const totals = totalsFor(lines as unknown as DraftInput['lines'], {
        vatPayer: vatOnNow,
        roundTotal: doc.roundTotal,
        pricesIncludeVat: doc.pricesIncludeVat,
        currency: doc.currency,
        exchangeRate: doc.exchangeRate,
      })
      assertVatLines(lines as unknown as DraftInput['lines'], vatOnNow)
      if (doc.type === 'credit_note' && doc.relatedDocumentId) {
        // Corrections may be partial and repeated, but together they cannot refund more than the invoice.
        const originalId = doc.relatedDocumentId
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`credit:${originalId}`}))`)
        const [orig] = await tx
          .select({ total: document.total })
          .from(document)
          .where(scoped(orgId, originalId))
        const others = await tx
          .select({ total: document.total })
          .from(document)
          .where(
            and(
              eq(document.organizationId, orgId),
              eq(document.relatedDocumentId, originalId),
              eq(document.type, 'credit_note'),
              inArray(document.status, ['issued', 'paid']),
              isNull(document.deletedAt),
              ne(document.id, id),
            ),
          )
        const credited = others.reduce(
          (sum, o) => sum.plus(parseDecimal(o.total)),
          parseDecimal(totals.total),
        )
        if (orig && credited.abs().greaterThan(parseDecimal(orig.total).abs())) {
          throw new DocumentError(
            'CONFLICT',
            'The credit notes would refund more than the invoice total',
          )
        }
      }
      await writeLines(tx, orgId, id, lines as unknown as DraftInput['lines'], totals, vatOnNow)

      // Number allocation: lazily created default series + atomic counter bump.
      // Serialize per (org, type) so concurrent first issues cannot create two default series.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`${orgId}:${doc.type}`}))`)
      let [series] = await tx
        .select()
        .from(numberSeries)
        .where(
          and(
            eq(numberSeries.organizationId, orgId),
            eq(numberSeries.documentType, doc.type),
            eq(numberSeries.isDefault, true),
          ),
        )
        .orderBy(asc(numberSeries.createdAt))
      if (!series) {
        const pattern = DEFAULT_NUMBER_PATTERNS[doc.type as keyof typeof DEFAULT_NUMBER_PATTERNS]
        ;[series] = await tx
          .insert(numberSeries)
          .values({
            organizationId: orgId,
            documentType: doc.type,
            name: SERIES_NAMES[doc.type] ?? doc.type,
            pattern,
            reset: 'yearly',
          })
          .returning()
      }
      if (!series) throw new Error('series missing')
      const issueDate = doc.issueDate ?? todayPrague()
      const date = { year: Number(issueDate.slice(0, 4)), month: Number(issueDate.slice(5, 7)) }
      const period = periodKey(series.reset, date)
      const [counter] = await tx
        .insert(schema.numberSeriesCounter)
        .values({ organizationId: orgId, seriesId: series.id, period, nextValue: 2 })
        .onConflictDoUpdate({
          target: [schema.numberSeriesCounter.seriesId, schema.numberSeriesCounter.period],
          set: { nextValue: sql`${schema.numberSeriesCounter.nextValue} + 1` },
        })
        .returning({ nextValue: schema.numberSeriesCounter.nextValue })
      if (!counter) throw new Error('counter missing')
      const number = formatDocumentNumber(series.pattern, counter.nextValue - 1, date)

      await tx
        .update(document)
        .set({
          status: 'issued',
          vatMode: vatOnNow ? 'standard' : 'none',
          ...totalColumns(totals, doc.currency),
          number,
          seriesId: series.id,
          variableSymbol: variableSymbolFromNumber(number, doc.type),
          bankAccountId: bank?.id ?? null,
          issueDate,
          publicToken: randomBytes(24).toString('base64url'),
          supplierSnapshot: {
            name: profile.legalName,
            ico: profile.ico,
            dic: profile.dic,
            address: profile.address,
            vatStatus: profile.vatStatus,
            registryNote: profile.registryNote,
            email: profile.email,
            phone: profile.phone,
            website: profile.website,
          },
          customerSnapshot: {
            name: customer.name,
            ico: customer.ico,
            dic: customer.dic,
            icDph: customer.icDph,
            address: customer.address,
            country: customer.country,
            emails: customer.emails,
            phone: customer.phone,
          },
          bankSnapshot: bank
            ? {
                label: bank.label,
                currency: bank.currency,
                iban: bank.iban,
                accountNumber: bank.accountNumber,
                bankCode: bank.bankCode,
                bic: bank.bic,
                showQr: bank.showQr,
              }
            : null,
        })
        .where(scoped(orgId, id))
      // A final invoice fully covered by the advance is settled on issue.
      // A tax receipt documents a payment already received, so it is settled on issue.
      if (
        doc.type === 'payment_receipt' ||
        (doc.type === 'invoice' && doc.relatedDocumentId && parseDecimal(totals.total).lte(0))
      ) {
        await tx
          .update(document)
          .set({ status: 'paid', paidAt: new Date() })
          .where(scoped(orgId, id))
      }
      // A credit note settles the corrected invoice's open balance (never beyond it: a refund of money
      // already received is a separate payment out).
      if (doc.type === 'credit_note' && doc.relatedDocumentId) {
        const [orig] = await tx
          .select()
          .from(document)
          .where(scoped(orgId, doc.relatedDocumentId))
          .for('update')
        if (orig && orig.status === 'issued') {
          const open = parseDecimal(orig.total).minus(
            (await paidSums(tx, orgId, [orig.id])).get(orig.id) ?? new Decimal(0),
          )
          const creditTotal = parseDecimal(totals.total).abs()
          const credit = creditTotal.lt(open) ? creditTotal : open
          if (credit.gt(0)) {
            await tx.insert(payment).values({
              organizationId: orgId,
              documentId: orig.id,
              paidOn: doc.issueDate ?? todayPrague(),
              amount: toFixed(credit, 2),
              currency: orig.currency,
              method: CREDIT_NOTE_METHOD,
              note: number,
            })
            if (credit.gte(open)) {
              await tx
                .update(document)
                .set({ status: 'paid', paidAt: new Date() })
                .where(scoped(orgId, orig.id))
            }
          }
        }
      }
      await logActivity(tx, orgId, actorId, id, 'issued', { number })
    })
    return this.get(db, orgId, id)
  },

  /**
   * E-mails an issued (open) invoice with the PDF attached and the public link; records `sent`.
   * `reminder` sends a payment reminder instead (records `reminded`).
   */
  async send(
    db: Db,
    orgId: string,
    actorId: string,
    id: string,
    services: Services | undefined,
    opts: {
      to?: string
      message?: string | null
      reminder?: boolean
      /** The caller already recorded the `reminded` activity (it claims the stage before sending). */
      alreadyLogged?: boolean
    } = {},
  ) {
    const found = await this.forExport(db, orgId, id)
    if (!found) throw new DocumentError('NOT_FOUND', 'Issued document not found')
    const { doc, lines } = found
    if (doc.status === 'cancelled' || (opts.reminder && doc.status !== 'issued')) {
      throw new DocumentError('CONFLICT', 'This document cannot be sent')
    }
    if (doc.type === 'credit_note' && opts.reminder) {
      throw new DocumentError('CONFLICT', 'Reminders do not apply to credit notes')
    }
    if (opts.reminder && (!doc.dueDate || doc.dueDate >= todayPrague())) {
      throw new DocumentError('CONFLICT', 'Reminders can only be sent for overdue invoices')
    }
    const customerEmails = (doc.customerSnapshot?.emails as string[] | undefined) ?? []
    const to = opts.to ?? customerEmails[0]
    if (!to) throw new DocumentError('PRECONDITION_FAILED', 'The customer has no e-mail address')
    if (
      !services?.sendInvoice ||
      !services.renderPdf ||
      !services.publicBaseUrl ||
      !doc.publicToken
    ) {
      throw new MailError('EMAIL_NOT_CONFIGURED')
    }
    const bytes = await services.renderPdf(doc, lines, found.original)
    const paid = (await paidSums(db, orgId, [id])).get(id) ?? new Decimal(0)
    const hasQr = buildPaymentQrPayload(paymentQrInput(doc, lines, paid)) !== null
    const supplier = doc.supplierSnapshot ?? {}
    await services.sendInvoice({
      to,
      replyTo: (supplier.email as string | null) ?? null,
      supplierName: String(supplier.name ?? ''),
      number: doc.number ?? '',
      total: formatMoney(doc.total, doc.currency),
      dueDate: doc.dueDate ? formatDateCs(doc.dueDate) : '',
      publicUrl: `${services.publicBaseUrl}/f/${doc.publicToken}`,
      qrUrl: hasQr ? `${services.publicBaseUrl}/f/${doc.publicToken}/qr.png` : null,
      message: opts.message ?? null,
      isReminder: opts.reminder ?? false,
      language: doc.language as 'cs' | 'sk' | 'en',
      pdf: { filename: `${doc.number}.pdf`, bytes },
    })
    await db.transaction(async (tx) => {
      if (!opts.reminder) {
        await tx.update(document).set({ sentAt: new Date() }).where(scoped(orgId, id))
      }
      if (!opts.alreadyLogged) {
        await logActivity(tx, orgId, actorId, id, opts.reminder ? 'reminded' : 'sent', { to })
      }
    })
    return this.get(db, orgId, id)
  },

  /** Marks a freshly created draft as proposed by the assistant (for drafts made by duplicate/template/credit-note). */
  async tagAssistant(db: Db, orgId: string, documentId: string) {
    await db
      .update(activity)
      .set({ data: sql`coalesce(${activity.data}, '{}'::jsonb) || '{"via":"assistant"}'::jsonb` })
      .where(
        and(
          eq(activity.organizationId, orgId),
          eq(activity.entityType, 'document'),
          eq(activity.entityId, documentId),
          eq(activity.action, 'created'),
        ),
      )
  },

  async duplicate(db: Db, orgId: string, actorId: string, id: string) {
    const src = await this.get(db, orgId, id)
    if (!src) throw new DocumentError('NOT_FOUND', 'Document not found')
    if (src.type === 'credit_note') {
      throw new DocumentError('CONFLICT', 'Credit notes cannot be duplicated')
    }
    return this.createDraft(db, orgId, actorId, {
      type: src.type as 'invoice' | 'proforma' | 'credit_note',
      contactId: src.contactId,
      bankAccountId: src.bankAccountId,
      currency: src.currency,
      exchangeRate: src.exchangeRate,
      roundTotal: src.roundTotal,
      language: src.language as 'cs' | 'sk' | 'en',
      paymentMethod: src.paymentMethod,
      constantSymbol: src.constantSymbol,
      orderNumber: src.orderNumber,
      introText: src.introText,
      footerText: src.footerText,
      privateNote: src.privateNote,
      lines: src.lines.map((l) => ({
        description: l.description,
        quantity: l.quantity,
        unit: l.unit,
        unitPrice: l.unitPrice,
        vatRate: l.vatRate,
        vatTreatment: l.vatTreatment as VatTreatment,
        vatNote: l.vatNote,
        discountPercent: l.discountPercent,
      })),
    })
  },

  /**
   * Daňový doklad k přijaté platbě (§28(1)(d)): a VAT payer issues it for an advance received on a proforma.
   * The paid amount is VAT-inclusive; the base is derived at the chosen rate (21 or 12 %).
   */
  async createPaymentReceipt(
    db: Db,
    orgId: string,
    actorId: string,
    id: string,
    vatRate: '21' | '12',
    /** Splits the received amount over several VAT rates (must add up to the amount received). */
    allocations?: { vatRate: '21' | '12'; amount: string }[],
  ) {
    const src = await this.get(db, orgId, id)
    if (!src) throw new DocumentError('NOT_FOUND', 'Document not found')
    if (src.type !== 'proforma' || src.status !== 'paid') {
      throw new DocumentError('CONFLICT', 'A receipt needs a fully paid proforma')
    }
    const profile = await loadProfile(db, orgId)
    if (!vatApplies(profile, 'payment_receipt')) {
      throw new DocumentError('CONFLICT', 'Only VAT payers issue a tax receipt for an advance')
    }
    // One receipt = one tax point: an advance received on several days needs a receipt per payment date.
    if (new Set(src.payments.map((p) => p.paidOn)).size > 1) {
      throw new DocumentError(
        'CONFLICT',
        'The advance was received on different dates; issue a receipt for each payment separately',
      )
    }
    const paid = src.payments.reduce((s, p) => s.plus(parseDecimal(p.amount)), new Decimal(0))
    const split = allocations?.length ? allocations : [{ vatRate, amount: toFixed(paid, 2) }]
    if (
      new Set(split.map((a) => a.vatRate)).size !== split.length ||
      split.some((a) => parseDecimal(a.amount).lte(0)) ||
      !split.reduce((s, a) => s.plus(parseDecimal(a.amount)), new Decimal(0)).eq(paid)
    ) {
      throw new DocumentError(
        'BAD_REQUEST',
        `The allocations must use each VAT rate once and add up to the amount received (${toFixed(paid, 2)})`,
      )
    }
    // The received amount is VAT-inclusive: the draft is priced gross and VAT is extracted (A × r / (100 + r)).
    // The tax point is the day the payment was received; foreign advances use the ČNB rate of that day.
    const paidOn =
      src.payments
        .map((p) => p.paidOn)
        .sort()
        .at(-1) ?? todayPrague()
    let receiptRate: string | undefined = src.exchangeRate ?? undefined
    if (src.currency !== 'CZK') {
      receiptRate = await getRate(src.currency, paidOn)
        .then((r) => r.rate)
        .catch(() => src.exchangeRate ?? undefined)
    }
    return db.transaction(async (txn) => {
      const tx = txn as unknown as Db
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`receipt:${id}`}))`)
      const [existing] = await tx
        .select({ id: document.id })
        .from(document)
        .where(
          and(
            eq(document.organizationId, orgId),
            eq(document.relatedDocumentId, id),
            eq(document.type, 'payment_receipt'),
            isNull(document.deletedAt),
            ne(document.status, 'cancelled'),
          ),
        )
      if (existing) {
        throw new DocumentError('CONFLICT', 'A tax receipt already exists for this proforma')
      }
      return this.createDraft(
        tx,
        orgId,
        actorId,
        {
          type: 'payment_receipt',
          roundTotal: false,
          taxableDate: paidOn,
          contactId: src.contactId,
          bankAccountId: src.bankAccountId,
          currency: src.currency,
          exchangeRate: receiptRate,
          language: src.language as 'cs' | 'sk' | 'en',
          paymentMethod: src.paymentMethod,
          introText: `Přijatá záloha na základě zálohové faktury ${src.number}`,
          lines: split.map((a) => ({
            description:
              split.length > 1
                ? `Přijatá záloha ${a.vatRate} % (zálohová faktura ${src.number})`
                : `Přijatá záloha (zálohová faktura ${src.number})`,
            quantity: '1',
            unit: null,
            unitPrice: toFixed(parseDecimal(a.amount), 2),
            vatRate: a.vatRate,
            vatTreatment: 'standard' as const,
            vatNote: null,
            discountPercent: '0',
          })),
        },
        { relatedDocumentId: id, pricesIncludeVat: true },
      )
    })
  },

  /**
   * Final invoice for a fully paid proforma: copies its lines and deducts the advance as a negative line.
   * VAT payers need a tax receipt for the advance first, which is not supported yet, so this is refused.
   */
  async createFinalInvoice(db: Db, orgId: string, actorId: string, id: string) {
    const src = await this.get(db, orgId, id)
    if (!src) throw new DocumentError('NOT_FOUND', 'Document not found')
    if (src.type !== 'proforma' || src.status !== 'paid') {
      throw new DocumentError('CONFLICT', 'A final invoice needs a fully paid proforma')
    }
    const profile = await loadProfile(db, orgId)
    const payer = vatApplies(profile, 'invoice')
    // A VAT payer deducts the advance as shown on the tax receipt (base and VAT per rate).
    let receipt: { number: string | null; parts: { rate: string; base: string }[] } | null = null
    if (payer) {
      const [r] = await db
        .select()
        .from(document)
        .where(
          and(
            eq(document.organizationId, orgId),
            eq(document.relatedDocumentId, id),
            eq(document.type, 'payment_receipt'),
            eq(document.status, 'paid'),
            isNull(document.deletedAt),
          ),
        )
      const rls = r
        ? await db
            .select()
            .from(documentLine)
            .where(and(eq(documentLine.organizationId, orgId), eq(documentLine.documentId, r.id)))
            .orderBy(asc(documentLine.position))
        : []
      if (!r || rls.length === 0) {
        throw new DocumentError(
          'PRECONDITION_FAILED',
          'Issue the tax receipt for the received advance first',
        )
      }
      receipt = {
        number: r.number,
        parts: rls.map((rl) => ({ rate: rl.vatRate, base: rl.lineSubtotal })),
      }
    }
    const advance = src.payments.reduce((s, p) => s.plus(parseDecimal(p.amount)), new Decimal(0))
    const draft = await db.transaction(async (txn) => {
      const tx = txn as unknown as Db
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`final:${id}`}))`)
      const [existing] = await tx
        .select({ id: document.id })
        .from(document)
        .where(
          and(
            eq(document.organizationId, orgId),
            eq(document.relatedDocumentId, id),
            eq(document.type, 'invoice'),
            isNull(document.deletedAt),
            ne(document.status, 'cancelled'),
          ),
        )
      if (existing) {
        throw new DocumentError('CONFLICT', 'A final invoice already exists for this proforma')
      }
      return this.createDraft(
        tx,
        orgId,
        actorId,
        {
          type: 'invoice',
          roundTotal: src.roundTotal,
          contactId: src.contactId,
          bankAccountId: src.bankAccountId,
          currency: src.currency,
          exchangeRate: src.exchangeRate,
          language: src.language as 'cs' | 'sk' | 'en',
          paymentMethod: src.paymentMethod,
          introText: src.introText,
          footerText: src.footerText,
          lines: [
            ...src.lines.map((l) => ({
              description: l.description,
              quantity: l.quantity,
              unit: l.unit,
              unitPrice: l.unitPrice,
              // Proforma lines carry no VAT rate; a payer's final invoice uses the receipt's rate.
              vatRate:
                receipt && Number(l.vatRate) === 0
                  ? (receipt.parts[0]?.rate ?? l.vatRate)
                  : l.vatRate,
              vatTreatment: l.vatTreatment as VatTreatment,
              vatNote: l.vatNote,
              discountPercent: l.discountPercent,
            })),
            ...(receipt
              ? receipt.parts.map((part) => ({
                  description: `Odpočet zálohy ${part.rate} % (daňový doklad k přijaté platbě ${receipt.number})`,
                  quantity: '1',
                  unit: null,
                  unitPrice: parseDecimal(part.base).negated().toString(),
                  vatRate: part.rate,
                  vatTreatment: 'standard' as const,
                  vatNote: null,
                  discountPercent: '0',
                }))
              : [
                  {
                    description: `Uhrazená záloha (zálohová faktura ${src.number})`,
                    quantity: '1',
                    unit: null,
                    unitPrice: advance.negated().toString(),
                    vatRate: '0',
                    vatTreatment: 'standard' as const,
                    discountPercent: '0',
                  },
                ]),
          ],
        },
        { relatedDocumentId: id },
      )
    })
    if (!draft) throw new Error('final invoice draft missing')
    await logActivity(db, orgId, actorId, id, 'final_invoice_created', { invoiceId: draft.id })
    return draft
  },

  /**
   * Opravný daňový doklad: a draft that reverses (all lines negated) an issued invoice. Edit the draft
   * to correct only part of it, then issue it like any other document.
   */
  async createCreditNote(
    db: Db,
    orgId: string,
    actorId: string,
    id: string,
    reason?: string | null,
  ) {
    const src = await this.get(db, orgId, id)
    if (!src) throw new DocumentError('NOT_FOUND', 'Document not found')
    if (src.type !== 'invoice' || (src.status !== 'issued' && src.status !== 'paid')) {
      throw new DocumentError('CONFLICT', 'A credit note can only correct an issued invoice')
    }
    const draft = await this.createDraft(
      db,
      orgId,
      actorId,
      {
        type: 'credit_note',
        roundTotal: src.roundTotal,
        contactId: src.contactId,
        bankAccountId: src.bankAccountId,
        currency: src.currency,
        exchangeRate: src.exchangeRate,
        language: src.language as 'cs' | 'sk' | 'en',
        paymentMethod: src.paymentMethod,
        introText: reason?.trim() || `Oprava faktury ${src.number}`,
        lines: src.lines.map((l) => ({
          description: l.description,
          quantity: parseDecimal(l.quantity).negated().toString(),
          unit: l.unit,
          unitPrice: l.unitPrice,
          vatRate: l.vatRate,
          vatTreatment: l.vatTreatment as VatTreatment,
          vatNote: l.vatNote,
          discountPercent: l.discountPercent,
        })),
      },
      { relatedDocumentId: id },
    )
    if (!draft) throw new Error('credit note draft missing')
    await logActivity(db, orgId, actorId, id, 'credit_note_created', { creditNoteId: draft.id })
    return this.get(db, orgId, draft.id)
  },

  async markPaid(
    db: Db,
    orgId: string,
    actorId: string,
    id: string,
    input: { amount?: string | null; paidOn?: string; method?: string; note?: string | null },
  ) {
    await db.transaction(async (tx) => {
      const [doc] = await tx.select().from(document).where(scoped(orgId, id)).for('update')
      if (!doc) throw new DocumentError('NOT_FOUND', 'Document not found')
      if (doc.status !== 'issued') {
        throw new DocumentError('CONFLICT', 'Only issued, unpaid documents can be marked as paid')
      }
      const already = (await paidSums(tx, orgId, [id])).get(id) ?? new Decimal(0)
      const remaining = parseDecimal(doc.total).minus(already)
      const amount = input.amount ? parseAmount(input.amount) : remaining
      if (amount.lte(0)) throw new DocumentError('BAD_REQUEST', 'Amount must be positive')
      if (amount.minus(remaining).greaterThan('0.005')) {
        throw new DocumentError('BAD_REQUEST', 'The payment exceeds the remaining balance')
      }
      const paidOn = input.paidOn ?? todayPrague()
      if (paidOn > todayPrague()) {
        throw new DocumentError('BAD_REQUEST', 'The payment date cannot be in the future')
      }
      await tx.insert(payment).values({
        organizationId: orgId,
        documentId: id,
        paidOn,
        amount: toFixed(amount, 2),
        currency: doc.currency,
        method: input.method ?? doc.paymentMethod,
        note: input.note ?? null,
      })
      const full = already.plus(amount).gte(parseDecimal(doc.total))
      if (full) {
        await tx
          .update(document)
          .set({ status: 'paid', paidAt: new Date() })
          .where(scoped(orgId, id))
      }
      await logActivity(tx, orgId, actorId, id, full ? 'paid' : 'partially_paid', {
        amount: toFixed(amount, 2),
        paidOn,
      })
    })
    return this.get(db, orgId, id)
  },

  async markUnpaid(db: Db, orgId: string, actorId: string, id: string) {
    await db.transaction(async (tx) => {
      const [doc] = await tx.select().from(document).where(scoped(orgId, id)).for('update')
      if (!doc) throw new DocumentError('NOT_FOUND', 'Document not found')
      if (doc.status !== 'paid' && doc.status !== 'issued') {
        throw new DocumentError('CONFLICT', 'Only issued or paid documents can be marked unpaid')
      }
      if (doc.type === 'invoice' && doc.relatedDocumentId && parseDecimal(doc.total).lte(0)) {
        throw new DocumentError(
          'CONFLICT',
          'This invoice is settled by the advance and cannot be reopened',
        )
      }
      if (doc.type === 'payment_receipt') {
        throw new DocumentError(
          'CONFLICT',
          'A tax receipt documents a received payment; cancel it instead',
        )
      }
      if (doc.type === 'proforma') {
        const [dep] = await tx
          .select({ id: document.id })
          .from(document)
          .where(
            and(
              eq(document.organizationId, orgId),
              eq(document.relatedDocumentId, id),
              inArray(document.type, ['invoice', 'payment_receipt']),
              isNull(document.deletedAt),
              ne(document.status, 'cancelled'),
            ),
          )
        if (dep) {
          throw new DocumentError(
            'CONFLICT',
            'A final invoice already uses this advance; cancel it first',
          )
        }
      }
      const removed = await tx
        .delete(payment)
        .where(and(eq(payment.organizationId, orgId), eq(payment.documentId, id)))
        .returning({ id: payment.id })
      // Bank transactions that were paired with this document's payments become available again.
      if (removed.length > 0) {
        await tx
          .update(bankTransaction)
          .set({
            matchStatus: 'unmatched',
            matchedDocumentId: null,
            paymentId: null,
            matchedAmount: null,
          })
          .where(
            and(
              eq(bankTransaction.organizationId, orgId),
              eq(bankTransaction.matchedDocumentId, id),
              eq(bankTransaction.matchStatus, 'matched'),
            ),
          )
      }
      await tx.update(document).set({ status: 'issued', paidAt: null }).where(scoped(orgId, id))
      await logActivity(tx, orgId, actorId, id, 'unpaid')
    })
    return this.get(db, orgId, id)
  },

  async cancel(db: Db, orgId: string, actorId: string, id: string) {
    await db.transaction(async (tx) => {
      const [doc] = await tx.select().from(document).where(scoped(orgId, id)).for('update')
      if (!doc) throw new DocumentError('NOT_FOUND', 'Document not found')
      if (doc.status !== 'issued' && doc.status !== 'paid') {
        throw new DocumentError('CONFLICT', 'Only issued documents can be cancelled')
      }
      const [credit] = await tx
        .select({ id: document.id })
        .from(document)
        .where(
          and(
            eq(document.organizationId, orgId),
            eq(document.relatedDocumentId, id),
            eq(document.type, 'credit_note'),
            inArray(document.status, ['issued', 'paid']),
            isNull(document.deletedAt),
          ),
        )
      if (credit) {
        throw new DocumentError(
          'CONFLICT',
          'This invoice already has a credit note; cancelling it too would correct it twice',
        )
      }
      await tx
        .update(document)
        .set({ status: 'cancelled', cancelledAt: new Date() })
        .where(scoped(orgId, id))
      // Cancelling a credit note takes back the settlement it made on the corrected invoice.
      if (doc.type === 'credit_note' && doc.relatedDocumentId && doc.number) {
        const removed = await tx
          .delete(payment)
          .where(
            and(
              eq(payment.organizationId, orgId),
              eq(payment.documentId, doc.relatedDocumentId),
              eq(payment.method, CREDIT_NOTE_METHOD),
              eq(payment.note, doc.number),
            ),
          )
          .returning({ id: payment.id })
        if (removed.length > 0) {
          const [orig] = await tx
            .select()
            .from(document)
            .where(scoped(orgId, doc.relatedDocumentId))
            .for('update')
          if (orig?.status === 'paid') {
            const paid = (await paidSums(tx, orgId, [orig.id])).get(orig.id) ?? new Decimal(0)
            if (paid.lt(parseDecimal(orig.total))) {
              await tx
                .update(document)
                .set({ status: 'issued', paidAt: null })
                .where(scoped(orgId, orig.id))
            }
          }
        }
      }
      await logActivity(tx, orgId, actorId, id, 'cancelled')
    })
    return this.get(db, orgId, id)
  },

  /**
   * Replaces the public link token of an issued document: the previous link stops working immediately
   * (revocation) and the returned document carries the new token to share.
   */
  async rotatePublicToken(db: Db, orgId: string, actorId: string, id: string) {
    await db.transaction(async (tx) => {
      const [doc] = await tx.select().from(document).where(scoped(orgId, id)).for('update')
      if (!doc) throw new DocumentError('NOT_FOUND', 'Document not found')
      if (doc.status === 'draft') {
        throw new DocumentError('CONFLICT', 'Drafts have no public link; issue the document first')
      }
      await tx
        .update(document)
        .set({ publicToken: randomBytes(24).toString('base64url') })
        .where(scoped(orgId, id))
      await logActivity(tx, orgId, actorId, id, 'link_rotated')
    })
    return this.get(db, orgId, id)
  },

  /** Drafts only: issued numbers are never reused, so issued documents are cancelled instead. */
  async deleteDraft(db: Db, orgId: string, actorId: string, id: string) {
    return db.transaction(async (tx) => {
      const [doc] = await tx.select().from(document).where(scoped(orgId, id)).for('update')
      if (!doc) throw new DocumentError('NOT_FOUND', 'Document not found')
      if (doc.status !== 'draft') {
        throw new DocumentError(
          'CONFLICT',
          'Only drafts can be deleted; cancel issued documents instead',
        )
      }
      await tx.update(document).set({ deletedAt: new Date() }).where(scoped(orgId, id))
      await logActivity(tx, orgId, actorId, id, 'deleted')
      return { id }
    })
  },
}
