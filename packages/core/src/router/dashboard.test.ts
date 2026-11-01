import { type DbHandle, schema } from '@fakturky/db'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { clientFor, createTestDb, seedOrg } from '../testing'

let handle: DbHandle
beforeAll(async () => {
  handle = await createTestDb()
})
afterAll(() => handle.close())

const principal = (organizationId: string) => ({
  userId: 'u',
  organizationId,
  via: 'session' as const,
})

test('summary: turnover, unpaid, overdue, VAT limit for non-payers; tenant scoped', async () => {
  const org = await seedOrg(handle, 'dash-a')
  const other = await seedOrg(handle, 'dash-b')
  await handle.db
    .insert(schema.businessProfile)
    .values({ organizationId: org, legalName: 'X', vatStatus: 'non_payer' })
  const api = clientFor(handle, principal(org))
  const c = await api.contacts.create({ name: 'Odběratel' })
  const line = { description: 'Práce', quantity: '1', unitPrice: '1000' }
  const a = await api.documents.issue({
    id: (await api.documents.createDraft({ contactId: c.id, lines: [line] })).id,
  })
  const b = await api.documents.issue({
    id: (
      await api.documents.createDraft({
        contactId: c.id,
        issueDate: '2020-01-01',
        dueDate: '2020-01-10',
        lines: [{ ...line, unitPrice: '500' }],
      })
    ).id,
  })
  await api.documents.markPaid({ id: a.id })

  const s = await api.dashboard.summary({})
  expect(s.monthTurnover).toBe('1000.00')
  expect(s.unpaid).toBe('500.00')
  expect(s.overdue).toBe('500.00')
  expect(s.overdueCount).toBe(1)
  expect(s.vatLimit?.turnover).toBe('1000.00')
  expect(s.vatLimit?.limit).toBe('2000000')
  expect(s.months).toHaveLength(6)
  expect(b.id).toBeTruthy()

  const empty = await clientFor(handle, principal(other)).dashboard.summary({})
  expect(empty.monthTurnover).toBe('0.00')
})
