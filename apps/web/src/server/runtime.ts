import { createDb, type Db, type DbHandle, migrate } from '@fakturky/db'

let handle: Promise<DbHandle> | undefined

/** Lazily-initialised database. PGlite fallback when no DATABASE_URL (local dev). */
export function getDb(): Promise<Db> {
  handle ??= (async () => {
    const url = process.env.DATABASE_URL
    const h = await createDb({ url, pgliteDir: url ? undefined : '.data/pglite' })
    if (h.kind === 'pglite') await migrate(h)
    return h
  })().catch((error) => {
    handle = undefined
    throw error
  })
  return handle.then((h) => h.db)
}
