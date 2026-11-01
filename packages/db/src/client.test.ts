import { sql } from 'drizzle-orm'
import { afterAll, expect, test } from 'vitest'
import { createDb } from './client'
import { migrate } from './migrate'
import { organization } from './schema'

const handle = await createDb()
afterAll(() => handle.close())

test('migrations apply on PGlite and uuid v7 ids are generated', async () => {
  await migrate(handle)
  const [row] = await handle.db.insert(organization).values({ name: 'A', slug: 'a' }).returning()
  expect(row?.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-/)
  const r = await handle.db.execute(sql`select count(*)::int as n from organization`)
  expect((r as { rows: unknown[] }).rows[0]).toMatchObject({ n: 1 })
})
