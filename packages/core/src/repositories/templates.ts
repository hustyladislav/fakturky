import type { Db } from '@fakturky/db'
import { schema } from '@fakturky/db'
import { todayPrague } from '@fakturky/domain'
import { and, asc, desc, eq, lte } from 'drizzle-orm'
import { DocumentError, documentsRepo } from './documents'

const { template, recurringRule } = schema

export type Frequency = 'monthly' | 'quarterly' | 'yearly'
const MONTHS: Record<Frequency, number> = { monthly: 1, quarterly: 3, yearly: 12 }

/** The occurrence after `from`, on `dayOfMonth` (clamped to the length of the target month). */
export function nextOccurrence(from: string, frequency: Frequency, dayOfMonth: number): string {
  const y = Number(from.slice(0, 4))
  const m = Number(from.slice(5, 7)) - 1 + MONTHS[frequency]
  const ty = y + Math.floor(m / 12)
  const tm = ((m % 12) + 12) % 12
  const last = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate()
  const day = Math.min(dayOfMonth, last)
  return `${ty}-${String(tm + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** First occurrence on or after `from` for the given day of month. */
export function firstOccurrence(from: string, dayOfMonth: number): string {
  const y = Number(from.slice(0, 4))
  const m = Number(from.slice(5, 7)) - 1
  const clamp = (yy: number, mm: number) =>
    Math.min(dayOfMonth, new Date(Date.UTC(yy, mm + 1, 0)).getUTCDate())
  const thisMonth = `${from.slice(0, 7)}-${String(clamp(y, m)).padStart(2, '0')}`
  if (thisMonth >= from) return thisMonth
  return nextOccurrence(thisMonth, 'monthly', dayOfMonth)
}

export const templatesRepo = {
  list(db: Db, orgId: string) {
    return db
      .select()
      .from(template)
      .where(eq(template.organizationId, orgId))
      .orderBy(asc(template.name), asc(template.id))
  },

  async get(db: Db, orgId: string, id: string) {
    const [row] = await db
      .select()
      .from(template)
      .where(and(eq(template.organizationId, orgId), eq(template.id, id)))
    return row ?? null
  },

  async createFromDocument(db: Db, orgId: string, name: string, documentId: string) {
    const doc = await documentsRepo.get(db, orgId, documentId)
    if (!doc) throw new DocumentError('NOT_FOUND', 'Document not found')
    const [row] = await db
      .insert(template)
      .values({
        organizationId: orgId,
        name,
        documentType: doc.type === 'proforma' ? 'proforma' : 'invoice',
        body: {
          contactId: doc.contactId,
          currency: doc.currency,
          language: doc.language as 'cs' | 'sk' | 'en',
          introText: doc.introText,
          footerText: doc.footerText,
          lines: doc.lines.map((l) => ({
            description: l.description,
            quantity: l.quantity,
            unit: l.unit,
            unitPrice: l.unitPrice,
            vatRate: l.vatRate,
            discountPercent: l.discountPercent,
          })),
        },
      })
      .returning()
    if (!row) throw new Error('insert returned no row')
    return row
  },

  async remove(db: Db, orgId: string, id: string) {
    const [row] = await db
      .delete(template)
      .where(and(eq(template.organizationId, orgId), eq(template.id, id)))
      .returning({ id: template.id })
    return row ?? null
  },

  /** New draft from a template with today's dates. */
  async use(db: Db, orgId: string, actorId: string, id: string, issueDate?: string) {
    const t = await this.get(db, orgId, id)
    if (!t) throw new DocumentError('NOT_FOUND', 'Template not found')
    return documentsRepo.createDraft(db, orgId, actorId, {
      type: t.documentType === 'proforma' ? 'proforma' : 'invoice',
      contactId: t.body.contactId ?? null,
      currency: t.body.currency,
      language: t.body.language,
      introText: t.body.introText,
      footerText: t.body.footerText,
      issueDate,
      lines: t.body.lines.map((l) => ({
        description: l.description,
        quantity: l.quantity,
        unit: l.unit ?? null,
        unitPrice: l.unitPrice,
        vatRate: l.vatRate,
        discountPercent: l.discountPercent ?? '0',
      })),
    })
  },
}

export const recurringRepo = {
  list(db: Db, orgId: string) {
    return db
      .select({ rule: recurringRule, templateName: template.name })
      .from(recurringRule)
      .innerJoin(template, eq(template.id, recurringRule.templateId))
      .where(eq(recurringRule.organizationId, orgId))
      .orderBy(asc(recurringRule.nextRunOn), desc(recurringRule.id))
      .then((rows) => rows.map((r) => ({ ...r.rule, templateName: r.templateName })))
  },

  async create(
    db: Db,
    orgId: string,
    input: {
      templateId: string
      frequency: Frequency
      dayOfMonth: number
      startOn?: string
      autoIssue: boolean
      autoSend: boolean
    },
  ) {
    if (!(await templatesRepo.get(db, orgId, input.templateId))) {
      throw new DocumentError('NOT_FOUND', 'Template not found')
    }
    const [row] = await db
      .insert(recurringRule)
      .values({
        organizationId: orgId,
        templateId: input.templateId,
        frequency: input.frequency,
        dayOfMonth: input.dayOfMonth,
        nextRunOn: firstOccurrence(input.startOn ?? todayPrague(), input.dayOfMonth),
        autoIssue: input.autoIssue,
        autoSend: input.autoSend,
      })
      .returning()
    if (!row) throw new Error('insert returned no row')
    return row
  },

  async update(
    db: Db,
    orgId: string,
    id: string,
    patch: { active?: boolean; autoIssue?: boolean; autoSend?: boolean },
  ) {
    const [row] = await db
      .update(recurringRule)
      .set(patch)
      .where(and(eq(recurringRule.organizationId, orgId), eq(recurringRule.id, id)))
      .returning()
    return row ?? null
  },

  async remove(db: Db, orgId: string, id: string) {
    const [row] = await db
      .delete(recurringRule)
      .where(and(eq(recurringRule.organizationId, orgId), eq(recurringRule.id, id)))
      .returning({ id: recurringRule.id })
    return row ?? null
  },

  /**
   * Cron entry point (cross-tenant by design; every action below is scoped to the rule's own organization).
   * A rule is claimed by advancing `nextRunOn` with a compare-and-set, so overlapping runs cannot double-create.
   */
  async runDue(
    db: Db,
    today = todayPrague(),
    onIssued?: (orgId: string, documentId: string, autoSend: boolean) => Promise<void>,
  ) {
    const due = await db
      .select()
      .from(recurringRule)
      .where(and(eq(recurringRule.active, true), lte(recurringRule.nextRunOn, today)))
      .orderBy(asc(recurringRule.nextRunOn))
      .limit(200)
    const results: Array<{
      ruleId: string
      documentId?: string
      issued?: boolean
      error?: string
    }> = []
    for (const rule of due) {
      const next = nextOccurrence(rule.nextRunOn, rule.frequency, rule.dayOfMonth)
      const [claimed] = await db
        .update(recurringRule)
        .set({
          nextRunOn: next > today ? next : nextOccurrence(today, rule.frequency, rule.dayOfMonth),
        })
        .where(and(eq(recurringRule.id, rule.id), eq(recurringRule.nextRunOn, rule.nextRunOn)))
        .returning({ id: recurringRule.id })
      if (!claimed) continue
      try {
        const draft = await templatesRepo.use(
          db,
          rule.organizationId,
          'system:recurring',
          rule.templateId,
          today,
        )
        if (!draft) throw new Error('draft not created')
        let issued = false
        if (rule.autoIssue) {
          try {
            await documentsRepo.issue(db, rule.organizationId, 'system:recurring', draft.id)
            issued = true
            await onIssued?.(rule.organizationId, draft.id, rule.autoSend)
          } catch (e) {
            results.push({ ruleId: rule.id, documentId: draft.id, error: (e as Error).message })
            continue
          }
        }
        results.push({ ruleId: rule.id, documentId: draft.id, issued })
      } catch (e) {
        results.push({ ruleId: rule.id, error: (e as Error).message })
      }
    }
    return results
  },
}
