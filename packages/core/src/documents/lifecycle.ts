// After issue: cancelling, rotating the public link, tagging assistant-made documents.
import { randomBytes } from 'node:crypto'
import { type Db, schema } from '@fakturky/db'
import { Decimal, parseDecimal } from '@fakturky/domain'
import { and, eq, inArray, isNull, sql } from 'drizzle-orm'
import { DomainError } from '../errors'
import { get } from './queries'
import { logActivity, scoped } from './shared'
import { CREDIT_NOTE_METHOD, paidSums } from './status'

const { document, payment, activity } = schema

export async function cancel(db: Db, orgId: string, actorId: string, id: string) {
  await db.transaction(async (tx) => {
    const [doc] = await tx.select().from(document).where(scoped(orgId, id)).for('update')
    if (!doc) throw new DomainError('NOT_FOUND', 'Document not found')
    if (doc.status !== 'issued' && doc.status !== 'paid') {
      throw new DomainError('CONFLICT', 'Only issued documents can be cancelled')
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
      throw new DomainError(
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
  return get(db, orgId, id)
}

/**
 * Replaces the public link token of an issued document: the previous link stops working immediately
 * (revocation) and the returned document carries the new token to share.
 */
export async function rotatePublicToken(db: Db, orgId: string, actorId: string, id: string) {
  await db.transaction(async (tx) => {
    const [doc] = await tx.select().from(document).where(scoped(orgId, id)).for('update')
    if (!doc) throw new DomainError('NOT_FOUND', 'Document not found')
    if (doc.status === 'draft') {
      throw new DomainError('CONFLICT', 'Drafts have no public link; issue the document first')
    }
    await tx
      .update(document)
      .set({ publicToken: randomBytes(24).toString('base64url') })
      .where(scoped(orgId, id))
    await logActivity(tx, orgId, actorId, id, 'link_rotated')
  })
  return get(db, orgId, id)
}

/** Marks a freshly created draft as proposed by the assistant (for drafts made by duplicate/template/credit-note). */
export async function tagAssistant(db: Db, orgId: string, documentId: string) {
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
}
