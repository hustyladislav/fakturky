// Row access and bookkeeping every document operation shares.
import { type Db, schema } from '@fakturky/db'
import { parseDecimal } from '@fakturky/domain'
import { and, eq, isNull } from 'drizzle-orm'
import { DomainError } from '../errors'

const { document, activity, businessProfile } = schema

export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]

export type DocRow = typeof document.$inferSelect

export const scoped = (orgId: string, id: string) =>
  and(eq(document.organizationId, orgId), eq(document.id, id), isNull(document.deletedAt))

export async function logActivity(
  tx: Db | Tx,
  orgId: string,
  actorId: string | null,
  entityId: string,
  action: string,
  data?: Record<string, unknown>,
) {
  await tx
    .insert(activity)
    .values({ organizationId: orgId, actorId, entityType: 'document', entityId, action, data })
}

export async function loadProfile(db: Db | Tx, orgId: string) {
  const [p] = await db
    .select()
    .from(businessProfile)
    .where(eq(businessProfile.organizationId, orgId))
  return p ?? null
}

/** A user-supplied money string ("1500", "1 500,5"); anything else is a client error, not a 500. */
export function parseAmount(raw: string) {
  const v = raw.replace(/[\s\u00a0]/g, '').replace(',', '.')
  if (!/^-?\d+(\.\d+)?$/.test(v)) throw new DomainError('BAD_REQUEST', 'Amount is not a number')
  return parseDecimal(v)
}
