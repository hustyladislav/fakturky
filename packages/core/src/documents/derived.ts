// Documents made from another one: payment receipt, final invoice, credit note.
import { type Db, schema } from '@fakturky/db'
import {
  allocateGross,
  Decimal,
  getRate,
  parseDecimal,
  todayPrague,
  toFixed,
  type VatTreatment,
} from '@fakturky/domain'
import { and, asc, eq, isNull, ne, sql } from 'drizzle-orm'
import type { z } from 'zod'
import { DomainError } from '../errors'
import { createDraft } from './drafts'
import { vatApplies } from './lines'
import { get } from './queries'
import type { documentDetailSchema } from './schema'
import { loadProfile, logActivity, parseAmount } from './shared'

type DocumentDetail = z.infer<typeof documentDetailSchema>

const { document, documentLine } = schema

/**
 * One negative VAT-inclusive line per VAT rate of the invoice. The credited gross amount is spread over the
 * rates in proportion to each rate's gross total, so base and VAT per rate stay consistent with the invoice.
 */
async function partialCreditLines(db: Db, orgId: string, src: DocumentDetail, amountInput: string) {
  const amount = parseAmount(amountInput)
  if (amount.lte(0)) throw new DomainError('BAD_REQUEST', 'Amount must be positive')
  const earlier = await db
    .select({ total: document.total })
    .from(document)
    .where(
      and(
        eq(document.organizationId, orgId),
        eq(document.relatedDocumentId, src.id),
        eq(document.type, 'credit_note'),
        isNull(document.deletedAt),
        ne(document.status, 'cancelled'),
      ),
    )
  // Credit notes carry negative totals.
  const creditable = earlier.reduce(
    (left, c) => left.plus(parseDecimal(c.total)),
    parseDecimal(src.total),
  )
  if (amount.gt(creditable)) {
    throw new DomainError(
      'BAD_REQUEST',
      `The credited amount exceeds what is still creditable (${toFixed(creditable, 2)})`,
    )
  }
  const groups = src.vatRecap.length
    ? src.vatRecap.map((r) => ({
        vatRate: r.vatRate,
        vatTreatment: r.vatTreatment,
        gross: parseDecimal(r.total),
      }))
    : [
        {
          vatRate: src.lines[0]?.vatRate ?? '0',
          vatTreatment: src.lines[0]?.vatTreatment ?? 'outside_scope',
          gross: parseDecimal(src.total),
        },
      ]
  const grossSum = groups.reduce((sum, g) => sum.plus(g.gross), new Decimal(0))
  if (grossSum.lte(0)) throw new DomainError('CONFLICT', 'Nothing left to credit on this invoice')
  const shares = allocateGross(
    amount,
    groups.map((g) => g.gross),
  )
  return groups.map((g, i) => {
    const share = shares[i] as Decimal
    const from = src.lines.find((l) => l.vatRate === g.vatRate && l.vatTreatment === g.vatTreatment)
    return {
      description:
        groups.length > 1
          ? `Oprava faktury ${src.number} (${g.vatRate} %)`
          : `Oprava faktury ${src.number}`,
      quantity: '-1',
      unit: null,
      unitPrice: toFixed(share, 2),
      vatRate: g.vatRate,
      vatTreatment: g.vatTreatment as VatTreatment,
      vatNote: from?.vatNote ?? null,
      discountPercent: '0',
    }
  })
}

/**
 * Daňový doklad k přijaté platbě (§28(1)(d)): a VAT payer issues it for an advance received on a proforma.
 * The paid amount is VAT-inclusive; the base is derived at the chosen rate (21 or 12 %).
 */
export async function createPaymentReceipt(
  db: Db,
  orgId: string,
  actorId: string,
  id: string,
  vatRate: '21' | '12',
  /** Splits the received amount over several VAT rates (must add up to the amount received). */
  allocations?: { vatRate: '21' | '12'; amount: string }[],
) {
  const src = await get(db, orgId, id)
  if (!src) throw new DomainError('NOT_FOUND', 'Document not found')
  if (src.type !== 'proforma' || src.status !== 'paid') {
    throw new DomainError('CONFLICT', 'A receipt needs a fully paid proforma')
  }
  const profile = await loadProfile(db, orgId)
  if (!vatApplies(profile, 'payment_receipt')) {
    throw new DomainError('CONFLICT', 'Only VAT payers issue a tax receipt for an advance')
  }
  // One receipt = one tax point: an advance received on several days needs a receipt per payment date.
  if (new Set(src.payments.map((p) => p.paidOn)).size > 1) {
    throw new DomainError(
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
    throw new DomainError(
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
      throw new DomainError('CONFLICT', 'A tax receipt already exists for this proforma')
    }
    return createDraft(
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
}

/**
 * Final invoice for a fully paid proforma: copies its lines and deducts the advance as a negative line.
 * VAT payers need a tax receipt for the advance first, which is not supported yet, so this is refused.
 */
export async function createFinalInvoice(db: Db, orgId: string, actorId: string, id: string) {
  const src = await get(db, orgId, id)
  if (!src) throw new DomainError('NOT_FOUND', 'Document not found')
  if (src.type !== 'proforma' || src.status !== 'paid') {
    throw new DomainError('CONFLICT', 'A final invoice needs a fully paid proforma')
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
      throw new DomainError(
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
      throw new DomainError('CONFLICT', 'A final invoice already exists for this proforma')
    }
    return createDraft(
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
}

/**
 * Opravný daňový doklad: a draft that reverses (all lines negated) an issued invoice. Edit the draft
 * to correct only part of it, then issue it like any other document.
 */
export async function createCreditNote(
  db: Db,
  orgId: string,
  actorId: string,
  id: string,
  reason?: string | null,
  amount?: string | null,
) {
  const src = await get(db, orgId, id)
  if (!src) throw new DomainError('NOT_FOUND', 'Document not found')
  if (src.type !== 'invoice' || (src.status !== 'issued' && src.status !== 'paid')) {
    throw new DomainError('CONFLICT', 'A credit note can only correct an issued invoice')
  }
  const partial = amount ? await partialCreditLines(db, orgId, src, amount) : null
  const draft = await createDraft(
    db,
    orgId,
    actorId,
    {
      type: 'credit_note',
      // A typed amount is credited exactly; a full reversal keeps the invoice's rounding.
      roundTotal: partial ? false : src.roundTotal,
      contactId: src.contactId,
      bankAccountId: src.bankAccountId,
      currency: src.currency,
      exchangeRate: src.exchangeRate,
      language: src.language as 'cs' | 'sk' | 'en',
      paymentMethod: src.paymentMethod,
      introText: reason?.trim() || `Oprava faktury ${src.number}`,
      lines:
        partial ??
        src.lines.map((l) => ({
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
    { relatedDocumentId: id, ...(partial && { pricesIncludeVat: true }) },
  )
  if (!draft) throw new Error('credit note draft missing')
  await logActivity(db, orgId, actorId, id, 'credit_note_created', { creditNoteId: draft.id })
  return get(db, orgId, draft.id)
}
