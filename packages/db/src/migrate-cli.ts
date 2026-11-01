// Standalone (no workspace imports) so it runs with plain `node` during the Vercel build.
import { fileURLToPath } from 'node:url'
import { Pool } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-serverless'
import { migrate } from 'drizzle-orm/neon-serverless/migrator'

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL
if (!url) {
  console.log('[db:migrate] no DATABASE_URL_UNPOOLED/DATABASE_URL set, skipping')
  process.exit(0)
}
const pool = new Pool({ connectionString: url })
await migrate(drizzle(pool), {
  migrationsFolder: fileURLToPath(new URL('../migrations', import.meta.url)),
})
await pool.end()
console.log('[db:migrate] done')
