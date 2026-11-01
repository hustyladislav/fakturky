import type { Db } from '@fakturky/db'
import { schema } from '@fakturky/db'
import { Decimal, parseDecimal, toFixed } from '@fakturky/domain'
import { and, asc, desc, eq, inArray, isNull } from 'drizzle-orm'
import { toCsv } from '../csv'
import { deriveStatus } from './documents'

const {
  document,
  documentLine,
  contact,
  payment,
  bankAccount,
  businessProfile,
  template,
  recurringRule,
  numberSeries,
  numberSeriesCounter,
  activity,
} = schema

export const exportsRepo = {
  /**
   * Everything the organization owns, as one JSON document (GDPR-style portability / backup).
   * Bearer secrets (public link tokens, API keys, sessions) are deliberately left out.
   */
  async organizationJson(db: Db, orgId: string) {
    // One repeatable-read snapshot so headers, lines and payments are mutually consistent.
    const snap = await db.transaction(
      async (tx) => ({
        profile: await tx
          .select()
          .from(businessProfile)
          .where(eq(businessProfile.organizationId, orgId)),
        accounts: await tx.select().from(bankAccount).where(eq(bankAccount.organizationId, orgId)),
        contacts: await tx.select().from(contact).where(eq(contact.organizationId, orgId)),
        docs: await tx
          .select()
          .from(document)
          .where(and(eq(document.organizationId, orgId), isNull(document.deletedAt)))
          .orderBy(asc(document.createdAt)),
        lines: await tx.select().from(documentLine).where(eq(documentLine.organizationId, orgId)),
        payments: await tx.select().from(payment).where(eq(payment.organizationId, orgId)),
        history: await tx
          .select()
          .from(activity)
          .where(and(eq(activity.organizationId, orgId), eq(activity.entityType, 'document')))
          .orderBy(asc(activity.createdAt)),
        templates: await tx.select().from(template).where(eq(template.organizationId, orgId)),
        rules: await tx.select().from(recurringRule).where(eq(recurringRule.organizationId, orgId)),
        series: await tx.select().from(numberSeries).where(eq(numberSeries.organizationId, orgId)),
        counters: await tx
          .select()
          .from(numberSeriesCounter)
          .where(eq(numberSeriesCounter.organizationId, orgId)),
      }),
      { isolationLevel: 'repeatable read', accessMode: 'read only' },
    )
    const { profile, accounts, contacts, docs, lines, payments, templates, rules, series } = snap
    const group = <T extends { documentId: string }>(rows: T[]) => {
      const m = new Map<string, T[]>()
      for (const r of rows) m.set(r.documentId, [...(m.get(r.documentId) ?? []), r])
      return m
    }
    const linesBy = group(lines)
    const paymentsBy = group(payments)
    const historyBy = new Map<string, (typeof snap.history)[number][]>()
    for (const h of snap.history) {
      if (h.entityId) historyBy.set(h.entityId, [...(historyBy.get(h.entityId) ?? []), h])
    }
    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        format: 'fakturky-export/1',
        businessProfile: profile[0] ?? null,
        bankAccounts: accounts,
        contacts,
        documents: docs.map(({ publicToken: _token, ...d }) => ({
          ...d,
          lines: (linesBy.get(d.id) ?? []).sort((a, b) => a.position - b.position),
          payments: paymentsBy.get(d.id) ?? [],
          activity: historyBy.get(d.id) ?? [],
        })),
        templates,
        recurringRules: rules,
        numberSeries: series,
        numberSeriesCounters: snap.counters,
      },
      null,
      2,
    )
  },

  async documentsCsv(db: Db, orgId: string) {
    const rows = await db
      .select()
      .from(document)
      .where(and(eq(document.organizationId, orgId), isNull(document.deletedAt)))
      .orderBy(desc(document.issueDate), desc(document.createdAt))
    const paid = new Map<string, Decimal>()
    if (rows.length > 0) {
      const pays = await db
        .select({ documentId: payment.documentId, amount: payment.amount })
        .from(payment)
        .where(
          and(
            eq(payment.organizationId, orgId),
            inArray(
              payment.documentId,
              rows.map((r) => r.id),
            ),
          ),
        )
      for (const p of pays) {
        paid.set(
          p.documentId,
          (paid.get(p.documentId) ?? new Decimal(0)).plus(parseDecimal(p.amount)),
        )
      }
    }
    return toCsv(
      [
        'Číslo',
        'Typ',
        'Stav',
        'Odběratel',
        'IČO',
        'Vystaveno',
        'DUZP',
        'Splatnost',
        'Měna',
        'Základ',
        'DPH',
        'Celkem',
        'Celkem CZK',
        'VS',
        'Zaplaceno dne',
        'Uhrazená částka',
      ],
      rows.map((d) => [
        d.number,
        d.type,
        deriveStatus(d, paid.get(d.id) ?? new Decimal(0)),
        d.customerSnapshot?.name,
        d.customerSnapshot?.ico,
        d.issueDate,
        d.taxableDate,
        d.dueDate,
        d.currency,
        d.subtotal,
        d.vatTotal,
        d.total,
        d.totalCzk,
        d.variableSymbol,
        d.paidAt?.toISOString().slice(0, 10),
        toFixed(paid.get(d.id) ?? new Decimal(0), 2),
      ]),
    )
  },

  async contactsCsv(db: Db, orgId: string) {
    const rows = await db
      .select()
      .from(contact)
      .where(and(eq(contact.organizationId, orgId), isNull(contact.archivedAt)))
      .orderBy(asc(contact.name))
    return toCsv(
      ['Název', 'IČO', 'DIČ', 'IČ DPH', 'Ulice', 'Město', 'PSČ', 'Země', 'E-mail', 'Telefon'],
      rows.map((c) => [
        c.name,
        c.ico,
        c.dic,
        c.icDph,
        c.address.street,
        c.address.city,
        c.address.zip,
        c.country,
        c.emails.join(', '),
        c.phone,
      ]),
    )
  },
}
