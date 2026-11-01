import type { Db } from '@fakturky/db'
import { schema } from '@fakturky/db'
import { and, asc, desc, eq, isNull } from 'drizzle-orm'
import { toCsv } from '../csv'

const { document, contact } = schema

export const exportsRepo = {
  async documentsCsv(db: Db, orgId: string) {
    const rows = await db
      .select()
      .from(document)
      .where(and(eq(document.organizationId, orgId), isNull(document.deletedAt)))
      .orderBy(desc(document.issueDate), desc(document.createdAt))
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
        'Zaplaceno',
      ],
      rows.map((d) => [
        d.number,
        d.type,
        d.status,
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
