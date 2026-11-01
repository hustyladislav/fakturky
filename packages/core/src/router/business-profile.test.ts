import type { DbHandle } from '@fakturky/db'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { clientFor, createTestDb, seedOrg } from '../testing'

let handle: DbHandle
let orgA: string
let orgB: string
const principal = (organizationId: string) => ({
  userId: 'u1',
  organizationId,
  via: 'session' as const,
})

beforeAll(async () => {
  handle = await createTestDb()
  orgA = await seedOrg(handle, 'org-a')
  orgB = await seedOrg(handle, 'org-b')
})
afterAll(() => handle.close())

test('profile is created on first read and finishing onboarding stamps onboardedAt', async () => {
  const api = clientFor(handle, principal(orgA))
  const first = await api.businessProfile.get()
  expect(first.onboardedAt).toBeNull()
  expect(first.vatStatus).toBe('non_payer')

  const updated = await api.businessProfile.update({
    legalName: 'Jan Novák',
    ico: '12345678',
    vatStatus: 'payer',
    address: { street: 'Ulice 1', city: 'Praha', zip: '11000' },
  })
  expect(updated).toMatchObject({ legalName: 'Jan Novák', vatStatus: 'payer' })
  expect(updated.onboardedAt).toBeInstanceOf(Date)
  expect(updated.defaultCurrency).toBe('CZK')
})

test('tenant isolation: each org has its own profile', async () => {
  const a = clientFor(handle, principal(orgA))
  const b = clientFor(handle, principal(orgB))
  await a.businessProfile.update({ legalName: 'A s.r.o.' })
  const bProfile = await b.businessProfile.get()
  expect(bProfile.legalName).not.toBe('A s.r.o.')
  expect(bProfile.organizationId).toBe(orgB)
})

test('lookupIco rejects an invalid IČO without calling ARES', async () => {
  const api = clientFor(handle, principal(orgA))
  await expect(api.businessProfile.lookupIco({ ico: '12345678' })).rejects.toMatchObject({
    code: 'BAD_REQUEST',
  })
})
