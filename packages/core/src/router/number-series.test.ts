import { type DbHandle, schema } from '@fakturky/db'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { clientFor, createTestDb, seedOrg } from '../testing'

let handle: DbHandle
beforeAll(async () => {
  handle = await createTestDb()
})
afterAll(() => handle.close())

test('series defaults, pattern validation, preview, continuing numbering', async () => {
  const org = await seedOrg(handle, 'ns-a')
  await handle.db.insert(schema.businessProfile).values({ organizationId: org, legalName: 'X' })
  const api = clientFor(handle, { userId: 'u', organizationId: org, via: 'session' })
  const list = await api.numberSeries.list({})
  expect(list.map((s) => s.documentType).sort()).toEqual(['credit_note', 'invoice', 'proforma'])
  const inv = list.find((s) => s.documentType === 'invoice')
  if (!inv) throw new Error('missing')
  const year = new Date().getFullYear()
  expect(inv.nextNumber).toBe(`${year}-0001`)
  expect((await api.numberSeries.list({})).length).toBe(3) // idempotent

  await expect(api.numberSeries.update({ id: inv.id, pattern: 'FA{NNNN}' })).rejects.toMatchObject({
    code: 'BAD_REQUEST',
  })
  await expect(
    api.numberSeries.update({ id: inv.id, pattern: 'FA{YY}{NN}{NN}' }),
  ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  const changed = await api.numberSeries.update({ id: inv.id, pattern: 'FA{YY}{NNNNN}' })
  expect(changed.nextNumber).toMatch(/^FA\d{2}00001$/)

  await api.numberSeries.setNext({ id: inv.id, value: 120 })
  const c = await api.contacts.create({ name: 'K' })
  const d = await api.documents.issue({
    id: (
      await api.documents.createDraft({
        contactId: c.id,
        lines: [{ description: 'x', quantity: '1', unitPrice: '1' }],
      })
    ).id,
  })
  expect(d.number).toMatch(/^FA\d{2}00120$/)
  await expect(api.numberSeries.setNext({ id: inv.id, value: 5 })).rejects.toMatchObject({
    code: 'CONFLICT',
  })
  expect((await api.numberSeries.list({})).find((s) => s.id === inv.id)?.nextValue).toBe(121)
})
