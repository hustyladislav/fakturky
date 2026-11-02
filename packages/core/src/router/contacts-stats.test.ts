import { type DbHandle, schema } from '@fakturky/db'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { clientFor, createTestDb, seedOrg } from '../testing'

let handle: DbHandle
beforeAll(async () => {
  handle = await createTestDb()
})
afterAll(() => handle.close())

test('contact stats: invoiced, outstanding, overdue, last invoice; per-contact filter; list by contact', async () => {
  const org = await seedOrg(handle, 'contact-stats')
  await handle.db.insert(schema.businessProfile).values({
    organizationId: org,
    legalName: 'Dodavatel s.r.o.',
    ico: '27082440',
    vatStatus: 'non_payer',
  })
  const api = clientFor(handle, { userId: 'u', organizationId: org, via: 'session' as const })
  const a = await api.contacts.create({ name: 'Alfa s.r.o.' })
  const b = await api.contacts.create({ name: 'Beta s.r.o.' })
  const mk = async (contactId: string, unitPrice: string, extra: Record<string, unknown> = {}) =>
    api.documents.issue({
      id: (
        await api.documents.createDraft({
          contactId,
          lines: [{ description: 'Práce', quantity: '1', unitPrice }],
          ...extra,
        })
      ).id,
    })
  const paid = await mk(a.id, '300')
  await api.documents.markPaid({ id: paid.id })
  await mk(a.id, '200')
  await mk(a.id, '500', { issueDate: '2020-01-01', dueDate: '2020-01-15' })
  await api.documents.createDraft({
    contactId: a.id,
    lines: [{ description: 'Koncept', quantity: '1', unitPrice: '999' }],
  })

  const all = await api.contacts.stats({})
  expect(all).toHaveLength(1)
  expect(all[0]).toMatchObject({
    contactId: a.id,
    invoiced: '1000.00',
    outstanding: '700.00',
    overdue: '500.00',
    documentCount: 3,
  })
  expect(all[0]?.lastInvoiceDate).toBe(paid.issueDate)
  expect(await api.contacts.stats({ contactId: b.id })).toEqual([])

  const mine = await api.documents.list({ contactId: a.id })
  expect(mine).toHaveLength(4)
  expect(await api.documents.list({ contactId: b.id })).toHaveLength(0)
})
