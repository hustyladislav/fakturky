import type { Db } from '@fakturky/db'
import { schema } from '@fakturky/db'
import {
  type Frequency,
  firstOccurrence,
  getRate,
  nextOccurrence,
  todayPrague,
  type VatTreatment,
} from '@fakturky/domain'
import { and, asc, desc, eq, lte } from 'drizzle-orm'
import { DocumentError, documentsRepo } from '../documents/repo'

const { template, recurringRule } = schema

export { type Frequency, firstOccurrence, nextOccurrence }

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
            vatTreatment: l.vatTreatment as VatTreatment,
            vatNote: l.vatNote,
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
    // Foreign-currency drafts get the ČNB rate of the issue date so they can be issued straight away.
    let exchangeRate: string | undefined
    if (t.body.currency && t.body.currency !== 'CZK') {
      exchangeRate = await getRate(t.body.currency, issueDate ?? todayPrague())
        .then((r) => r.rate)
        .catch(() => undefined)
    }
    return documentsRepo.createDraft(db, orgId, actorId, {
      type: t.documentType === 'proforma' ? 'proforma' : 'invoice',
      roundTotal: false,
      contactId: t.body.contactId ?? null,
      currency: t.body.currency,
      exchangeRate,
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
        vatTreatment: (l.vatTreatment ?? 'standard') as VatTreatment,
        vatNote: l.vatNote ?? null,
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
    patch: {
      active?: boolean
      autoIssue?: boolean
      autoSend?: boolean
      frequency?: Frequency
      dayOfMonth?: number
      nextRunOn?: string
    },
  ) {
    const set: typeof patch = { ...patch }
    // A new day of the month moves the next run to its next occurrence unless a date was given.
    if (patch.dayOfMonth !== undefined && patch.nextRunOn === undefined) {
      set.nextRunOn = firstOccurrence(todayPrague(), patch.dayOfMonth)
    }
    const [row] = await db
      .update(recurringRule)
      .set(set)
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
   * Cron entry point. The only cross-tenant read is the list of organizations that have due rules;
   * everything after that runs scoped to a single organization.
   */
  async runDue(db: Db, today = todayPrague(), onIssued?: RunHook) {
    const orgs = await db
      .selectDistinct({ organizationId: recurringRule.organizationId })
      .from(recurringRule)
      .where(and(eq(recurringRule.active, true), lte(recurringRule.nextRunOn, today)))
      .limit(500)
    const results: RunResult[] = []
    for (const { organizationId } of orgs) {
      results.push(...(await this.runDueForOrg(db, organizationId, today, onIssued)))
    }
    return results
  },

  /**
   * A rule is claimed by advancing `nextRunOn` with a compare-and-set (no double runs on overlap);
   * if generating the draft fails the claim is rolled back so the next run retries that occurrence.
   */
  async runDueForOrg(db: Db, orgId: string, today = todayPrague(), onIssued?: RunHook) {
    const due = await db
      .select()
      .from(recurringRule)
      .where(
        and(
          eq(recurringRule.organizationId, orgId),
          eq(recurringRule.active, true),
          lte(recurringRule.nextRunOn, today),
        ),
      )
      .orderBy(asc(recurringRule.nextRunOn))
      .limit(200)
    const results: RunResult[] = []
    for (const rule of due) {
      const next = nextOccurrence(rule.nextRunOn, rule.frequency, rule.dayOfMonth)
      const claimWhere = (on: string) =>
        and(
          eq(recurringRule.organizationId, orgId),
          eq(recurringRule.id, rule.id),
          eq(recurringRule.nextRunOn, on),
        )
      const advanced = next > today ? next : nextOccurrence(today, rule.frequency, rule.dayOfMonth)
      const [claimed] = await db
        .update(recurringRule)
        .set({ nextRunOn: advanced })
        .where(claimWhere(rule.nextRunOn))
        .returning({ id: recurringRule.id })
      if (!claimed) continue
      let draftId: string | undefined
      try {
        const draft = await templatesRepo.use(db, orgId, 'system:recurring', rule.templateId, today)
        if (!draft) throw new Error('draft not created')
        draftId = draft.id
      } catch (e) {
        await db
          .update(recurringRule)
          .set({ nextRunOn: rule.nextRunOn })
          .where(claimWhere(advanced))
        results.push({ ruleId: rule.id, error: (e as Error).message })
        continue
      }
      if (!rule.autoIssue) {
        results.push({ ruleId: rule.id, documentId: draftId, issued: false })
        continue
      }
      try {
        await documentsRepo.issue(db, orgId, 'system:recurring', draftId)
        await onIssued?.(orgId, draftId, rule.autoSend)
        results.push({ ruleId: rule.id, documentId: draftId, issued: true })
      } catch (e) {
        // The draft stays for manual review; the occurrence is not repeated.
        results.push({ ruleId: rule.id, documentId: draftId, error: (e as Error).message })
      }
    }
    return results
  },
}

type RunHook = (orgId: string, documentId: string, autoSend: boolean) => Promise<void>
type RunResult = { ruleId: string; documentId?: string; issued?: boolean; error?: string }
