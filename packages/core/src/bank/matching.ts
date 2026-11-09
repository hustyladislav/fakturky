import type { Db } from '@fakturky/db'
import { schema } from '@fakturky/db'
import { Decimal, parseDecimal, todayPrague, toFixed } from '@fakturky/domain'
import {
  findByVariableSymbol,
  type MatchDocument,
  type MatchSuggestion,
  suggestMatches,
} from '@fakturky/domain/bank'
import { and, asc, eq, gt, inArray, isNull, ne } from 'drizzle-orm'
import { paidSums } from '../documents/repo'
import { BankError } from './repo'

const { bankTransaction, document, payment, activity } = schema

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]
type TxRow = typeof bankTransaction.$inferSelect

/** Documents a customer can pay by bank transfer: invoices and advance (proforma) invoices. */
const PAYABLE = ['invoice', 'proforma'] as const

async function logActivity(
  tx: Db | Tx,
  orgId: string,
  actorId: string | null,
  documentId: string,
  action: string,
  data: Record<string, unknown>,
) {
  await tx.insert(activity).values({
    organizationId: orgId,
    actorId,
    entityType: 'document',
    entityId: documentId,
    action,
    data,
  })
}

export type OpenDocument = MatchDocument & { total: string; dueDate: string | null }

export type TransactionSuggestion = MatchSuggestion & { document: OpenDocument }

export const bankMatchingRepo = {
  /** Issued, not fully paid invoices / proformas of the organization with their open balance. */
  async openDocuments(db: Db | Tx, orgId: string): Promise<OpenDocument[]> {
    const docs = await db
      .select()
      .from(document)
      .where(
        and(
          eq(document.organizationId, orgId),
          eq(document.status, 'issued'),
          inArray(document.type, [...PAYABLE]),
          isNull(document.deletedAt),
        ),
      )
      .orderBy(asc(document.dueDate), asc(document.number))
    const paid = await paidSums(
      db,
      orgId,
      docs.map((d) => d.id),
    )
    return docs
      .map((d) => {
        const remaining = parseDecimal(d.total).minus(paid.get(d.id) ?? new Decimal(0))
        return {
          id: d.id,
          number: d.number,
          variableSymbol: d.variableSymbol,
          currency: d.currency,
          remaining: toFixed(remaining, 2),
          total: toFixed(d.total, 2),
          dueDate: d.dueDate,
          customerName: (d.customerSnapshot?.name as string | undefined) ?? null,
        }
      })
      .filter((d) => new Decimal(d.remaining).gt(0))
  },

  /**
   * Books a (part of a) bank transaction as a payment on a document. `amount` defaults to the whole transaction;
   * the part beyond the open balance is not booked and shows up as an overpayment on the transaction.
   */
  async match(
    db: Db,
    orgId: string,
    actorId: string | null,
    transactionId: string,
    documentId: string,
    opts: { amount?: string; auto?: boolean } = {},
  ) {
    return db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(bankTransaction)
        .where(
          and(eq(bankTransaction.organizationId, orgId), eq(bankTransaction.id, transactionId)),
        )
        .for('update')
      if (!row) throw new BankError('NOT_FOUND', 'Transaction not found')
      if (row.matchStatus === 'matched') {
        throw new BankError('CONFLICT', 'The transaction is already paired with a document')
      }
      const received = parseDecimal(row.amount)
      if (received.lte(0)) {
        throw new BankError('BAD_REQUEST', 'Only incoming payments can be paired with a document')
      }
      const [doc] = await tx
        .select()
        .from(document)
        .where(
          and(
            eq(document.organizationId, orgId),
            eq(document.id, documentId),
            isNull(document.deletedAt),
          ),
        )
        .for('update')
      if (!doc) throw new BankError('NOT_FOUND', 'Document not found')
      if (!(PAYABLE as readonly string[]).includes(doc.type)) {
        throw new BankError('CONFLICT', 'Only invoices and advance invoices can be paid')
      }
      if (doc.status !== 'issued') {
        throw new BankError(
          'CONFLICT',
          'Only issued, unpaid documents can be paired with a payment',
        )
      }
      if (doc.currency !== row.currency) {
        throw new BankError(
          'BAD_REQUEST',
          'The payment currency differs from the document currency',
        )
      }
      const already = (await paidSums(tx, orgId, [doc.id])).get(doc.id) ?? new Decimal(0)
      const remaining = parseDecimal(doc.total).minus(already)
      if (remaining.lte(0)) throw new BankError('CONFLICT', 'The document is already fully paid')
      let wanted = received
      if (opts.amount !== undefined) {
        wanted = parseDecimal(opts.amount)
        if (wanted.lte(0) || wanted.gt(received)) {
          throw new BankError(
            'BAD_REQUEST',
            'The amount must be positive and at most the received amount',
          )
        }
      }
      const pay = wanted.lt(remaining) ? wanted : remaining
      const paidOn = row.bookedOn > todayPrague() ? todayPrague() : row.bookedOn
      const [created] = await tx
        .insert(payment)
        .values({
          organizationId: orgId,
          documentId: doc.id,
          paidOn,
          amount: toFixed(pay, 2),
          currency: doc.currency,
          method: 'bank_transfer',
          note: row.counterpartyName,
          source: 'bank',
        })
        .returning({ id: payment.id })
      if (!created) throw new Error('payment insert returned no row')
      const full = already.plus(pay).gte(parseDecimal(doc.total))
      if (full) {
        await tx
          .update(document)
          .set({ status: 'paid', paidAt: new Date() })
          .where(and(eq(document.organizationId, orgId), eq(document.id, doc.id)))
      }
      await tx
        .update(bankTransaction)
        .set({
          matchStatus: 'matched',
          matchedDocumentId: doc.id,
          paymentId: created.id,
          matchedAmount: toFixed(pay, 2),
        })
        .where(
          and(eq(bankTransaction.organizationId, orgId), eq(bankTransaction.id, transactionId)),
        )
      const overpaid = received.minus(pay)
      await logActivity(tx, orgId, actorId, doc.id, 'bank_matched', {
        amount: toFixed(pay, 2),
        paidOn,
        bankTransactionId: transactionId,
        auto: opts.auto ?? false,
        full,
        ...(overpaid.gt('0.005') ? { overpaid: toFixed(overpaid, 2) } : {}),
      })
      return {
        documentId: doc.id,
        paymentId: created.id,
        amount: toFixed(pay, 2),
        full,
        overpaid: toFixed(overpaid, 2),
      }
    })
  },

  /** Undoes a pairing: removes the payment it created and reopens the document if that payment had settled it. */
  async unmatch(db: Db, orgId: string, actorId: string | null, transactionId: string) {
    await db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(bankTransaction)
        .where(
          and(eq(bankTransaction.organizationId, orgId), eq(bankTransaction.id, transactionId)),
        )
        .for('update')
      if (!row) throw new BankError('NOT_FOUND', 'Transaction not found')
      if (row.matchStatus !== 'matched') {
        throw new BankError('CONFLICT', 'The transaction is not paired with a document')
      }
      if (row.matchedDocumentId) {
        const [doc] = await tx
          .select()
          .from(document)
          .where(and(eq(document.organizationId, orgId), eq(document.id, row.matchedDocumentId)))
          .for('update')
        if (doc?.type === 'proforma') {
          const [dependent] = await tx
            .select({ id: document.id })
            .from(document)
            .where(
              and(
                eq(document.organizationId, orgId),
                eq(document.relatedDocumentId, doc.id),
                inArray(document.type, ['invoice', 'payment_receipt']),
                isNull(document.deletedAt),
                ne(document.status, 'cancelled'),
              ),
            )
          if (dependent) {
            throw new BankError(
              'CONFLICT',
              'A final invoice already uses this advance; cancel it first',
            )
          }
        }
        if (row.paymentId) {
          await tx
            .delete(payment)
            .where(and(eq(payment.organizationId, orgId), eq(payment.id, row.paymentId)))
        }
        if (doc && doc.status === 'paid') {
          const left = (await paidSums(tx, orgId, [doc.id])).get(doc.id) ?? new Decimal(0)
          if (left.lt(parseDecimal(doc.total))) {
            await tx
              .update(document)
              .set({ status: 'issued', paidAt: null })
              .where(and(eq(document.organizationId, orgId), eq(document.id, doc.id)))
          }
        }
        if (doc) {
          await logActivity(tx, orgId, actorId, doc.id, 'bank_unmatched', {
            amount: row.matchedAmount,
            bankTransactionId: transactionId,
          })
        }
      }
      await tx
        .update(bankTransaction)
        .set({
          matchStatus: 'unmatched',
          matchedDocumentId: null,
          paymentId: null,
          matchedAmount: null,
        })
        .where(
          and(eq(bankTransaction.organizationId, orgId), eq(bankTransaction.id, transactionId)),
        )
    })
  },

  async setIgnored(db: Db, orgId: string, transactionId: string, ignored: boolean) {
    const [row] = await db
      .select()
      .from(bankTransaction)
      .where(and(eq(bankTransaction.organizationId, orgId), eq(bankTransaction.id, transactionId)))
    if (!row) throw new BankError('NOT_FOUND', 'Transaction not found')
    if (row.matchStatus === 'matched') {
      throw new BankError('CONFLICT', 'Unpair the transaction first')
    }
    await db
      .update(bankTransaction)
      .set({ matchStatus: ignored ? 'ignored' : 'unmatched' })
      .where(and(eq(bankTransaction.organizationId, orgId), eq(bankTransaction.id, transactionId)))
  },

  /**
   * Pairs every unmatched incoming payment whose variable symbol identifies exactly one open document (same
   * currency). Partial payments are booked as such; an excess is flagged on the transaction. Everything else is
   * left for the user (see `suggest`).
   */
  async autoMatch(db: Db, orgId: string, actorId: string | null) {
    const open = await this.openDocuments(db, orgId)
    if (open.length === 0) return 0
    const rows = await db
      .select()
      .from(bankTransaction)
      .where(
        and(
          eq(bankTransaction.organizationId, orgId),
          eq(bankTransaction.matchStatus, 'unmatched'),
          gt(bankTransaction.amount, '0'),
        ),
      )
      .orderBy(
        asc(bankTransaction.bookedOn),
        asc(bankTransaction.createdAt),
        asc(bankTransaction.id),
      )
    let matched = 0
    for (const row of rows) {
      const hit = findByVariableSymbol(row, open)
      if (!hit) continue
      try {
        const r = await this.match(db, orgId, actorId, row.id, hit.id, { auto: true })
        matched++
        hit.remaining = toFixed(parseDecimal(hit.remaining).minus(r.amount), 2)
        if (r.full || new Decimal(hit.remaining).lte(0))
          open.splice(open.indexOf(hit as OpenDocument), 1)
      } catch (e) {
        // The document changed under us (paid manually, cancelled): leave the transaction for a human.
        if (!(e instanceof BankError)) throw e
      }
    }
    return matched
  },

  /** Cron entry point: auto-pair for every organization that has unmatched incoming payments. */
  async autoMatchAll(db: Db) {
    const orgs = await db
      .selectDistinct({ organizationId: bankTransaction.organizationId })
      .from(bankTransaction)
      .where(and(eq(bankTransaction.matchStatus, 'unmatched'), gt(bankTransaction.amount, '0')))
    let total = 0
    for (const { organizationId } of orgs) total += await this.autoMatch(db, organizationId, null)
    return total
  },

  /** Fuzzy suggestions (amount, payer name, reference in the message) for unmatched incoming payments. */
  async suggest(db: Db, orgId: string, rows: TxRow[]) {
    const out = new Map<string, TransactionSuggestion[]>()
    const wanted = rows.filter((r) => r.matchStatus === 'unmatched' && parseDecimal(r.amount).gt(0))
    if (wanted.length === 0) return out
    const open = await this.openDocuments(db, orgId)
    for (const r of wanted) {
      out.set(r.id, suggestMatches(r, open) as TransactionSuggestion[])
    }
    return out
  },
}
