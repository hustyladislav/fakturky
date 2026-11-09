import type { DbHandle } from '@fakturky/db'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { clientFor, createTestDb, seedOrg } from '../testing'

let handle: DbHandle
beforeAll(async () => {
  handle = await createTestDb()
})
afterAll(() => handle.close())

test('whoami reports the caller organization and credential type', async () => {
  const orgId = await seedOrg(handle, 'whoami-org')
  const api = clientFor(handle, { userId: 'u', organizationId: orgId, via: 'apiKey' })
  expect(await api.account.whoami({})).toEqual({
    organizationId: orgId,
    organizationName: 'whoami-org',
    via: 'apiKey',
  })
  await expect(clientFor(handle, null).account.whoami({})).rejects.toMatchObject({
    code: 'UNAUTHORIZED',
  })
})
