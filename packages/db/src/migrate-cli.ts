import { createDb } from './client.ts'
import { migrate } from './migrate.ts'

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL
if (!url) {
  console.log('[db:migrate] no DATABASE_URL_UNPOOLED/DATABASE_URL set, skipping')
  process.exit(0)
}
const handle = await createDb({ url })
await migrate(handle)
await handle.close()
console.log('[db:migrate] done')
