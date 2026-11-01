import { type Db, schema } from '@fakturky/db'

/**
 * Make sure the local mirror of a Clerk organization (and its empty business profile) exists.
 * Idempotent; called by the transport adapter when a request carries an organization id.
 */
export async function ensureOrganization(
  db: Db,
  org: { id: string; name: () => Promise<string>; slug?: string | null },
): Promise<void> {
  const existing = await db.query.organization.findFirst({
    where: (o, { eq }) => eq(o.id, org.id),
    columns: { id: true },
  })
  if (existing) return
  const name = await org.name()
  await db.transaction(async (tx) => {
    await tx
      .insert(schema.organization)
      .values({ id: org.id, name, slug: org.slug ?? null })
      .onConflictDoNothing()
    await tx
      .insert(schema.businessProfile)
      .values({ organizationId: org.id, legalName: name })
      .onConflictDoNothing()
  })
}
