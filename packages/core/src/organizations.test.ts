import { schema } from '@fakturky/db'
import { afterAll, expect, test } from 'vitest'
import { ensureOrganization } from './organizations'
import { createTestDb } from './testing'

const handle = await createTestDb()
afterAll(() => handle.close())

test('ensureOrganization creates the org mirror + business profile once', async () => {
  let calls = 0
  const org = {
    id: 'org_123',
    slug: 'acme',
    name: async () => {
      calls++
      return 'Acme'
    },
  }
  await ensureOrganization(handle.db, org)
  await ensureOrganization(handle.db, org)
  expect(calls).toBe(1)
  const [profile] = await handle.db.select().from(schema.businessProfile)
  expect(profile).toMatchObject({ organizationId: 'org_123', legalName: 'Acme' })
})
