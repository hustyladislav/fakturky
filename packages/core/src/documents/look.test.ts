import { type DbHandle, schema } from '@fakturky/db'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { clientFor, createTestDb, seedOrg } from '../testing'

let handle: DbHandle
beforeAll(async () => {
  handle = await createTestDb()
})
afterAll(() => handle.close())

test('a draft follows the current look; issuing freezes the look of that moment', async () => {
  const org = await seedOrg(handle, 'look-timing')
  await handle.db.insert(schema.businessProfile).values({ organizationId: org, legalName: 'Firma' })
  const api = clientFor(handle, { userId: 'u', organizationId: org, via: 'session' })
  const c = await api.contacts.create({ name: 'K' })

  await api.appearance.update({ accentColor: '#111111' })
  const draft = await api.documents.createDraft({
    contactId: c.id,
    lines: [{ description: 'x', quantity: '1', unitPrice: '1' }],
  })
  await api.appearance.update({ accentColor: '#222222' })
  expect((await api.documents.get({ id: draft.id })).look.accentColor).toBe('#222222')

  const issued = await api.documents.issue({ id: draft.id })
  expect(issued.look.accentColor).toBe('#222222')

  await api.appearance.update({ accentColor: '#333333' })
  expect((await api.documents.get({ id: draft.id })).look.accentColor).toBe('#222222')
  const view = await clientFor(handle, null).public.invoice({ token: issued.publicToken as string })
  expect(view.appearance.accentColor).toBe('#222222')
})
