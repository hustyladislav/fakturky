import type { Db } from '@fakturky/db'
import { schema } from '@fakturky/db'
import { and, asc, eq, ilike, isNull, or, sql } from 'drizzle-orm'
import type { ContactInput } from '../schemas/contact'

const { contact } = schema

/** Every function takes `orgId` and scopes by it. No exceptions. */
export const contactsRepo = {
  async list(
    db: Db,
    orgId: string,
    opts: { search?: string; includeArchived?: boolean; limit: number; offset: number },
  ) {
    const term = opts.search?.trim()
    const where = and(
      eq(contact.organizationId, orgId),
      opts.includeArchived ? undefined : isNull(contact.archivedAt),
      term
        ? or(
            ilike(contact.name, `%${term}%`),
            ilike(sql`coalesce(${contact.ico}, '')`, `%${term}%`),
          )
        : undefined,
    )
    return db
      .select()
      .from(contact)
      .where(where)
      .orderBy(asc(contact.name), asc(contact.id))
      .limit(opts.limit)
      .offset(opts.offset)
  },

  async get(db: Db, orgId: string, id: string) {
    const [row] = await db
      .select()
      .from(contact)
      .where(and(eq(contact.organizationId, orgId), eq(contact.id, id)))
    return row ?? null
  },

  async create(db: Db, orgId: string, input: ContactInput) {
    const [row] = await db
      .insert(contact)
      .values({ ...input, organizationId: orgId })
      .returning()
    if (!row) throw new Error('insert returned no row')
    return row
  },

  async update(db: Db, orgId: string, id: string, input: Partial<ContactInput>) {
    const [row] = await db
      .update(contact)
      .set(input)
      .where(and(eq(contact.organizationId, orgId), eq(contact.id, id)))
      .returning()
    return row ?? null
  },

  async archive(db: Db, orgId: string, id: string) {
    const [row] = await db
      .update(contact)
      .set({ archivedAt: new Date() })
      .where(and(eq(contact.organizationId, orgId), eq(contact.id, id)))
      .returning()
    return row ?? null
  },
}
