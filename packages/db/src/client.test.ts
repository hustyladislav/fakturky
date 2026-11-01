import { sql } from 'drizzle-orm'
import { afterAll, expect, test } from 'vitest'
import { createDb } from './client'
import { migrate } from './migrate'
import { organization } from './schema'

const handle = await createDb()
afterAll(() => handle.close())

test('migrations apply on PGlite and org insert works', async () => {
  await migrate(handle)
  const [row] = await handle.db
    .insert(organization)
    .values({ id: 'org_a', name: 'A', slug: 'a' })
    .returning()
  expect(row?.id).toBe('org_a')
  const r = await handle.db.execute(sql`select count(*)::int as n from organization`)
  expect((r as { rows: unknown[] }).rows[0]).toMatchObject({ n: 1 })
})
