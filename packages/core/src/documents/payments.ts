import { type Db, schema } from '@fakturky/db'
import { Decimal, parseDecimal, todayPrague, toFixed } from '@fakturky/domain'
import { and, eq, inArray, isNull, ne } from 'drizzle-orm'
import { DomainError } from '../errors'
import { get } from './queries'
import { logActivity, parseAmount, scoped } from './shared'
import { paidSums } from './status'

const { bankTransaction, document, payment } = schema

export async function markPaid(
  db: Db,
  orgId: string,
  actorId: string,
  id: string,
  input: { amount?: string | null; paidOn?: string; method?: string; note?: string | null },
) {
  await db.transaction(async (tx) => {
    const [doc] = await tx.select().from(document).where(scoped(orgId, id)).for('update')
    if (!doc) throw new DomainError('NOT_FOUND', 'Document not found')
    if (doc.status !== 'issued') {
      throw new DomainError('CONFLICT', 'Only issued, unpaid documents can be marked as paid')
    }
    const already = (await paidSums(tx, orgId, [id])).get(id) ?? new Decimal(0)
    const remaining = parseDecimal(doc.total).minus(already)
    const amount = input.amount ? parseAmount(input.amount) : remaining
    if (amount.lte(0)) throw new DomainError('BAD_REQUEST', 'Amount must be positive')
    if (amount.minus(remaining).greaterThan('0.005')) {
      throw new DomainError('BAD_REQUEST', 'The payment exceeds the remaining balance')
    }
    const paidOn = input.paidOn ?? todayPrague()
    if (paidOn > todayPrague()) {
      throw new DomainError('BAD_REQUEST', 'The payment date cannot be in the future')
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
      await tx.update(document).set({ status: 'paid', paidAt: new Date() }).where(scoped(orgId, id))
    }
    await logActivity(tx, orgId, actorId, id, full ? 'paid' : 'partially_paid', {
      amount: toFixed(amount, 2),
      paidOn,
    })
  })
  return get(db, orgId, id)
}

export async function markUnpaid(
  db: Db,
  orgId: string,
  actorId: string,
  id: string,
  paymentId?: string,
) {
  await db.transaction(async (tx) => {
    const [doc] = await tx.select().from(document).where(scoped(orgId, id)).for('update')
    if (!doc) throw new DomainError('NOT_FOUND', 'Document not found')
    if (doc.status !== 'paid' && doc.status !== 'issued') {
      throw new DomainError('CONFLICT', 'Only issued or paid documents can be marked unpaid')
    }
    if (doc.type === 'invoice' && doc.relatedDocumentId && parseDecimal(doc.total).lte(0)) {
      throw new DomainError(
        'CONFLICT',
        'This invoice is settled by the advance and cannot be reopened',
      )
    }
    if (doc.type === 'payment_receipt') {
      throw new DomainError(
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
        throw new DomainError(
          'CONFLICT',
          'A final invoice already uses this advance; cancel it first',
        )
      }
    }
    // Before the delete: the foreign key nulls `paymentId`, which would lose the link to the payment.
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
          paymentId ? eq(bankTransaction.paymentId, paymentId) : undefined,
        ),
      )
    const removed = await tx
      .delete(payment)
      .where(
        and(
          eq(payment.organizationId, orgId),
          eq(payment.documentId, id),
          paymentId ? eq(payment.id, paymentId) : undefined,
        ),
      )
      .returning({ id: payment.id })
    if (paymentId && removed.length === 0) {
      throw new DomainError('NOT_FOUND', 'Payment not found on this document')
    }
    await tx.update(document).set({ status: 'issued', paidAt: null }).where(scoped(orgId, id))
    await logActivity(tx, orgId, actorId, id, 'unpaid')
  })
  return get(db, orgId, id)
}
