import type { Db } from '@fakturky/db'
import { schema } from '@fakturky/db'
import { todayPrague } from '@fakturky/domain'
import { and, count, eq, isNull, lt } from 'drizzle-orm'
import type { Services } from '../context'
import { documentsRepo } from './documents'

const { document, businessProfile, activity } = schema

/** Days after the due date at which the 1st, 2nd and 3rd reminder go out. */
export const REMINDER_OFFSETS = [3, 10, 17] as const

const DAY = 86_400_000

export const remindersRepo = {
  /**
   * Cron entry point. Only organizations that opted in (`autoRemind`) are touched; the sole cross-tenant
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
          isNull(document.deletedAt),
          lt(document.dueDate, today),
        ),
      )
    const results: Array<{ documentId: string; sent: boolean; error?: string }> = []
    for (const d of overdue) {
      if (!d.dueDate) continue
      const late = Math.round((Date.parse(today) - Date.parse(d.dueDate)) / DAY)
      const [{ n } = { n: 0 }] = await db
        .select({ n: count() })
        .from(activity)
        .where(
          and(
            eq(activity.organizationId, orgId),
            eq(activity.entityType, 'document'),
            eq(activity.entityId, d.id),
            eq(activity.action, 'reminded'),
          ),
        )
      const next = REMINDER_OFFSETS[n]
      if (next === undefined || late < next) continue
      try {
        await documentsRepo.send(db, orgId, 'system:reminders', d.id, services, { reminder: true })
        results.push({ documentId: d.id, sent: true })
      } catch (e) {
        results.push({ documentId: d.id, sent: false, error: (e as Error).message })
      }
    }
    return results
  },
}
