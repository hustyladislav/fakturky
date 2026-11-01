import type { DbHandle } from '@fakturky/db'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { clientFor, createTestDb, seedOrg } from '../testing'

let handle: DbHandle
let orgA: string
let orgB: string

const principal = (organizationId: string) => ({
  userId: 'user-1',
  organizationId,
  via: 'session' as const,
})

beforeAll(async () => {
  handle = await createTestDb()
  orgA = await seedOrg(handle, 'org-a')
  orgB = await seedOrg(handle, 'org-b')
})
afterAll(() => handle.close())

describe('contacts', () => {
  test('rejects unauthenticated calls', async () => {
    await expect(clientFor(handle, null).contacts.list({})).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    })
  })

  test('create / get / list / update / archive', async () => {
    const api = clientFor(handle, principal(orgA))
    const created = await api.contacts.create({ name: 'Acme s.r.o.', ico: '12345678' })
    expect(created.organizationId).toBe(orgA)
    expect((await api.contacts.get({ id: created.id })).name).toBe('Acme s.r.o.')
    expect(await api.contacts.list({ search: 'acme' })).toHaveLength(1)

    const updated = await api.contacts.update({ id: created.id, patch: { name: 'Acme a.s.' } })
    expect(updated.name).toBe('Acme a.s.')

    await api.contacts.archive({ id: created.id })
    expect(await api.contacts.list({})).toHaveLength(0)
    expect(await api.contacts.list({ includeArchived: true })).toHaveLength(1)
  })

  test('tenant isolation: org B cannot see or touch org A contacts', async () => {
    const a = clientFor(handle, principal(orgA))
    const b = clientFor(handle, principal(orgB))
    const mine = await a.contacts.create({ name: 'Secret client' })

    expect(await b.contacts.list({ includeArchived: true })).toEqual([])
    await expect(b.contacts.get({ id: mine.id })).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(
      b.contacts.update({ id: mine.id, patch: { name: 'Hacked' } }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(b.contacts.archive({ id: mine.id })).rejects.toMatchObject({ code: 'NOT_FOUND' })

    const still = await a.contacts.get({ id: mine.id })
    expect(still.name).toBe('Secret client')
    expect(still.archivedAt).toBeNull()
  })

  test('partial update leaves omitted fields untouched', async () => {
    const api = clientFor(handle, principal(orgA))
    const c = await api.contacts.create({
      name: 'Keep',
      country: 'SK',
      emails: ['a@example.com'],
      address: { city: 'Brno' },
    })
    const u = await api.contacts.update({ id: c.id, patch: { name: 'Keep 2' } })
    expect(u).toMatchObject({ country: 'SK', emails: ['a@example.com'], address: { city: 'Brno' } })
  })

  test('list input accepts query-string values', async () => {
    const api = clientFor(handle, principal(orgA))
    const rows = await api.contacts.list({ limit: '1' as never, includeArchived: 'true' as never })
    expect(rows).toHaveLength(1)
  })
})
