import { createDb, type DbHandle, migrate, schema } from '@fakturky/db'
import { createRouterClient } from '@orpc/server'
import type { Principal, Services } from './context'
import { router } from './router'

/** Fresh in-memory PGlite database with all migrations applied. */
export async function createTestDb(): Promise<DbHandle> {
  const handle = await createDb()
  await migrate(handle)
  return handle
}

export async function seedOrg(handle: DbHandle, slug: string): Promise<string> {
  const [org] = await handle.db
    .insert(schema.organization)
    .values({ name: slug, slug })
    .returning({ id: schema.organization.id })
  if (!org) throw new Error('seed failed')
  return org.id
}

export function clientFor(handle: DbHandle, principal: Principal | null, services?: Services) {
  return createRouterClient(router, { context: { db: handle.db, principal, services } })
}
