import type { Db } from '@fakturky/db'
import { schema } from '@fakturky/db'
import { Decimal, parseDecimal, toFixed } from '@fakturky/domain'
import { and, asc, desc, eq, inArray, isNull } from 'drizzle-orm'
import { toCsv } from '../csv'
import { deriveStatus } from './documents'

const { document, contact, payment } = schema

export const exportsRepo = {
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
