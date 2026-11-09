import type { Db } from '@fakturky/db'
import { bankMatchingRepo } from './bank/matching'
import { bankRepo } from './bank/repo'
import type { Services } from './context'
import { documentsRepo } from './documents/repo'
import { remindersRepo } from './reminders/repo'
import { recurringRepo } from './templates/repo'

/**
 * Scheduled work across every organization: the only callers without a principal. Each job reads the list of
 * organizations to touch, then scopes everything else to one tenant. The host only authorises and schedules.
 */
export const jobs = {
  /** Issues invoices from recurring rules that are due, and mails those set to auto-send. */
  async recurring(db: Db, services: Services | undefined) {
    const results = await recurringRepo.runDue(
      db,
      undefined,
      async (orgId, documentId, autoSend) => {
        if (!autoSend) return
        try {
          await documentsRepo.send(db, orgId, 'system:recurring', documentId, services)
        } catch (e) {
          // The invoice stays issued; the missing mail is visible in its history (no "sent" entry).
          console.warn(`[recurring] auto-send failed for ${documentId}: ${(e as Error).message}`)
        }
      },
    )
    return { processed: results.length, results }
  },

  /** Sends the next overdue reminder for organizations that opted in. */
  async reminders(db: Db, services: Services | undefined) {
    const results = await remindersRepo.runDue(db, services)
    return { processed: results.length, sent: results.filter((r) => r.sent).length }
  },

  /** Pulls new Fio transactions for every connected account, then matches them to invoices. */
  async bankSync(db: Db, _services: Services | undefined) {
    const results = await bankRepo.syncAllFio(db)
    const matched = await bankMatchingRepo.autoMatchAll(db)
    return {
      matched,
      accounts: results.length,
      imported: results.reduce((n, r) => n + r.imported, 0),
      failed: results.filter((r) => r.error).length,
    }
  },
}

export type JobName = keyof typeof jobs
