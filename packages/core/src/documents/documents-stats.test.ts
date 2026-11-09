import { type DbHandle, schema } from '@fakturky/db'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { clientFor, createTestDb, seedOrg } from '../testing'

let handle: DbHandle
beforeAll(async () => {
  handle = await createTestDb()
})
afterAll(() => handle.close())

test('stats buckets (counts + CZK sums), search narrowing and list sorting', async () => {
  const org = await seedOrg(handle, 'doc-stats')
  await handle.db.insert(schema.businessProfile).values({
    organizationId: org,
    legalName: 'Dodavatel s.r.o.',
    ico: '27082440',
    vatStatus: 'non_payer',
  })
  const api = clientFor(handle, { userId: 'u', organizationId: org, via: 'session' as const })
  const c = await api.contacts.create({ name: 'Zeta s.r.o.' })
  const mk = (unitPrice: string, extra: Record<string, unknown> = {}) =>
    api.documents.createDraft({
      contactId: c.id,
      lines: [{ description: 'Práce', quantity: '1', unitPrice }],
      ...extra,
    })
  const paid = await api.documents.issue({ id: (await mk('300')).id })
  await api.documents.markPaid({ id: paid.id })
  const open = await api.documents.issue({ id: (await mk('200')).id })
  const late = await api.documents.issue({
    id: (await mk('500', { issueDate: '2020-01-01', dueDate: '2020-01-15' })).id,
  })
  await mk('100') // stays a draft

  const s = await api.documents.stats({})
  expect(s.all.count).toBe(4)
  expect(s.draft).toEqual({ count: 1, sum: '100.00' })
  expect(s.paid).toEqual({ count: 1, sum: '300.00' })
  expect(s.unpaid).toEqual({ count: 2, sum: '700.00' })
  expect(s.overdue).toEqual({ count: 1, sum: '500.00' })
  expect(s.all.sum).toBe('1000.00')
  expect((await api.documents.stats({ search: 'nenalezeno' })).all.count).toBe(0)

  const byTotal = await api.documents.list({ sort: 'total', dir: 'desc' })
  expect(byTotal.map((d) => d.id).slice(0, 3)).toEqual([late.id, paid.id, open.id])
  const byDate = await api.documents.list({ sort: 'issueDate', dir: 'asc' })
  expect(byDate[0]?.id).toBe(late.id)
})
