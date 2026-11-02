import type { Db } from '@fakturky/db'
import { schema } from '@fakturky/db'
import { and, desc, eq, isNull } from 'drizzle-orm'
import { contactsRepo } from './contacts'
import { documentsRepo } from './documents'
import { foldText } from './fold'

const { contact } = schema

/** Prefix of the name beats a word prefix, which beats a plain substring. */
function rank(name: string, term: string): number {
  const n = foldText(name)
  const t = foldText(term)
  if (n.startsWith(t)) return 0
  if (n.split(/[\s.,-]+/).some((w) => w.startsWith(t))) return 1
  return 2
}

export const searchRepo = {
  /** One round trip for the command palette: documents and contacts, or the most recent of both without a query. */
  async global(db: Db, orgId: string, opts: { query: string; limit: number }) {
    const term = opts.query.trim()
    const [documents, contacts] = await Promise.all([
      documentsRepo.list(db, orgId, {
        filter: 'all',
        search: term || undefined,
        sort: term ? 'issueDate' : 'recent',
        limit: opts.limit,
        offset: 0,
      }),
      term
        ? contactsRepo.list(db, orgId, { search: term, limit: 200, offset: 0 })
        : db
            .select()
            .from(contact)
            .where(and(eq(contact.organizationId, orgId), isNull(contact.archivedAt)))
            .orderBy(desc(contact.updatedAt), desc(contact.id))
            .limit(opts.limit),
    ])
    const firstWords = term.split(/\s+/)[0] ?? term
    const ranked = term
      ? [...contacts].sort((a, b) => rank(a.name, firstWords) - rank(b.name, firstWords))
      : contacts
    return {
      documents: documents.map((d) => ({
        id: d.id,
        number: d.number,
        type: d.type,
        status: d.status,
        displayStatus: d.displayStatus,
        customerName: d.customerName,
        variableSymbol: d.variableSymbol,
        total: d.total,
        currency: d.currency,
        dueDate: d.dueDate,
        issueDate: d.issueDate,
        viaAssistant: d.viaAssistant ?? false,
      })),
      contacts: ranked.slice(0, opts.limit).map((c) => ({ id: c.id, name: c.name, ico: c.ico })),
    }
  },
}
