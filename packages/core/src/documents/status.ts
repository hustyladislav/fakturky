// What was paid on a document, and the status that follows from it.
import { type Db, schema } from '@fakturky/db'
import { Decimal, parseDecimal, todayPrague } from '@fakturky/domain'
import { and, eq, inArray, sql } from 'drizzle-orm'
import type { DisplayStatus } from './schema'
import type { DocRow, Tx } from './shared'

const { payment } = schema

/** `payment.method` of the settlement a credit note makes on its invoice (the note holds the credit note number). */
export const CREDIT_NOTE_METHOD = 'credit_note'

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

/** Day of the latest payment per document: the date the user recorded, not when they clicked. */
export async function lastPaidOn(db: Db | Tx, orgId: string, ids: string[]) {
  const map = new Map<string, string>()
  if (ids.length === 0) return map
  const rows = await db
    .select({ documentId: payment.documentId, paidOn: sql<string>`max(${payment.paidOn})` })
    .from(payment)
    .where(and(eq(payment.organizationId, orgId), inArray(payment.documentId, ids)))
    .groupBy(payment.documentId)
  for (const r of rows) map.set(r.documentId, r.paidOn)
  return map
}
