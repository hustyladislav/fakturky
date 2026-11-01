import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import * as schema from './schema'

export type Schema = typeof schema
export type Db = PgDatabase<PgQueryResultHKT, Schema>

export type DbHandle = {
  db: Db
  kind: 'neon' | 'pglite'
  close: () => Promise<void>
}

export type CreateDbOptions = {
  /** Postgres connection string. When empty, falls back to PGlite. */
  url?: string
  /** PGlite data directory (e.g. `.data/pglite`); in-memory when omitted. */
  pgliteDir?: string
}

/**
 * Neon serverless (WebSocket pool, supports transactions) when a URL is given;
 * PGlite otherwise (tests / local dev without Docker).
 */
export async function createDb(options: CreateDbOptions = {}): Promise<DbHandle> {
  if (options.url) {
    const [{ Pool }, { drizzle }] = await Promise.all([
      import('@neondatabase/serverless'),
      import('drizzle-orm/neon-serverless'),
    ])
    const pool = new Pool({ connectionString: options.url })
    return { db: drizzle(pool, { schema }) as unknown as Db, kind: 'neon', close: () => pool.end() }
  }
  const [{ PGlite }, { drizzle }] = await Promise.all([
    import('@electric-sql/pglite'),
    import('drizzle-orm/pglite'),
  ])
  const client = new PGlite(options.pgliteDir)
  return {
    db: drizzle(client, { schema }) as unknown as Db,
    kind: 'pglite',
    close: () => client.close(),
  }
}
