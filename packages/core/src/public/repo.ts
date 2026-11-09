import type { Db } from '@fakturky/db'
import { schema } from '@fakturky/db'
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { loadOriginal } from '../documents/queries'

const { document, documentLine, payment, activity } = schema

/**
 * Public access is by unguessable token only (192-bit); the token is the tenant boundary.
 * Drafts never have a token, so they can never be reached here.
 */
export const publicDocumentsRepo = {
  async getByToken(db: Db, token: string) {
    if (token.length < 20) return null
    const [doc] = await db
      .select()
      .from(document)
      .where(
        and(
          eq(document.publicToken, token),
          inArray(document.status, ['issued', 'paid', 'cancelled']),
          isNull(document.deletedAt),
        ),
      )
    if (!doc) return null
    const lines = await db
      .select()
      .from(documentLine)
      .where(
        and(
          eq(documentLine.organizationId, doc.organizationId),
          eq(documentLine.documentId, doc.id),
        ),
      )
      .orderBy(asc(documentLine.position))
    return { doc, lines, original: await loadOriginal(db, doc.organizationId, doc) }
  },

  /** Records the first view only (timeline "Zobrazena"); serialized per document so concurrent opens add one entry. */
  async markViewed(db: Db, doc: typeof document.$inferSelect) {
    await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`viewed:${doc.id}`}))`)
      const [seen] = await tx
        .select({ id: activity.id })
        .from(activity)
        .where(
          and(
            eq(activity.organizationId, doc.organizationId),
            eq(activity.entityType, 'document'),
            eq(activity.entityId, doc.id),
            eq(activity.action, 'viewed'),
          ),
        )
        .limit(1)
      if (seen) return
      await tx.insert(activity).values({
        organizationId: doc.organizationId,
        entityType: 'document',
        entityId: doc.id,
        action: 'viewed',
      })
    })
  },

  async paidAmount(db: Db, doc: typeof document.$inferSelect) {
    const rows = await db
      .select({ amount: payment.amount })
      .from(payment)
      .where(and(eq(payment.organizationId, doc.organizationId), eq(payment.documentId, doc.id)))
    return rows.map((r) => r.amount)
  },
}
