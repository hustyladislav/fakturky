import { fileURLToPath } from 'node:url'
import type { DbHandle } from './client'

export const migrationsFolder = fileURLToPath(new URL('../migrations', import.meta.url))

/** Apply the committed SQL migrations to whichever driver the handle uses. */
export async function migrate(handle: DbHandle): Promise<void> {
  if (handle.kind === 'neon') {
    const { migrate } = await import('drizzle-orm/neon-serverless/migrator')
    await migrate(handle.db as never, { migrationsFolder })
  } else {
    const { migrate } = await import('drizzle-orm/pglite/migrator')
    await migrate(handle.db as never, { migrationsFolder })
  }
}
