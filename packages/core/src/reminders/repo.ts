import type { Db } from '@fakturky/db'
import { schema } from '@fakturky/db'
import { todayPrague } from '@fakturky/domain'
import { and, desc, eq, isNull, lt, sql } from 'drizzle-orm'
import type { Services } from '../context'
import { documentsRepo } from '../documents/repo'

const { document, businessProfile, activity } = schema

/** Days after the due date at which the 1st, 2nd and 3rd reminder go out. */
export const REMINDER_OFFSETS = [3, 10, 17] as const

const DAY = 86_400_000
const MIN_GAP_DAYS = 5

export const remindersRepo = {
  /**
   * Cron entry point (the scheduler boundary). Only organizations that opted in (`autoRemind`) are touched; the sole cross-tenant
   * read is that list, everything after is scoped to one organization.
   */
  async runDue(db: Db, services: Services | undefined, today = todayPrague()) {
    const orgs = await db
      .select({ organizationId: businessProfile.organizationId })
      .from(businessProfile)
      .where(eq(businessProfile.autoRemind, true))
    const results: Array<{ documentId: string; sent: boolean; error?: string }> = []
    for (const { organizationId } of orgs) {
      results.push(...(await this.runForOrg(db, organizationId, services, today)))
    }
    return results
  },

  async runForOrg(db: Db, orgId: string, services: Services | undefined, today = todayPrague()) {
    const overdue = await db
      .select()
      .from(document)
      .where(
        and(
          eq(document.organizationId, orgId),
          eq(document.status, 'issued'),
          eq(document.type, 'invoice'),
          isNull(document.deletedAt),
          lt(document.dueDate, today),
        ),
      )
    const results: Array<{ documentId: string; sent: boolean; error?: string }> = []
    for (const d of overdue) {
      if (!d.dueDate) continue
      const late = Math.round((Date.parse(today) - Date.parse(d.dueDate)) / DAY)
      const due = REMINDER_OFFSETS.filter((o) => late >= o).length
      if (due === 0) continue
      // Claim the next stage under a per-document lock so overlapping runs cannot both send it.
      const claimed = await db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`remind:${d.id}`}))`)
        const prior = await tx
          .select({ createdAt: activity.createdAt })
          .from(activity)
          .where(
            and(
              eq(activity.organizationId, orgId),
              eq(activity.entityType, 'document'),
              eq(activity.entityId, d.id),
              eq(activity.action, 'reminded'),
            ),
          )
          .orderBy(desc(activity.createdAt))
        // Stages already sent, and never two reminders within MIN_GAP_DAYS (catching up after downtime).
        if (prior.length >= due) return null
        const last = prior[0]?.createdAt
        if (last && Date.now() - last.getTime() < MIN_GAP_DAYS * DAY) return null
        const [row] = await tx
          .insert(activity)
          .values({
            organizationId: orgId,
            actorId: 'system:reminders',
            entityType: 'document',
            entityId: d.id,
            action: 'reminded',
          })
          .returning({ id: activity.id })
        return row ?? null
      })
      if (!claimed) continue
      try {
        await documentsRepo.send(db, orgId, 'system:reminders', d.id, services, {
          reminder: true,
          alreadyLogged: true,
        })
        results.push({ documentId: d.id, sent: true })
      } catch (e) {
        // Release the claim so the next run retries this stage.
        await db
          .delete(activity)
          .where(and(eq(activity.organizationId, orgId), eq(activity.id, claimed.id)))
        results.push({ documentId: d.id, sent: false, error: (e as Error).message })
      }
    }
    return results
  },
}
