import { type DbHandle, schema } from '@fakturky/db'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { clientFor, createTestDb, seedOrg } from '../testing'

let handle: DbHandle
beforeAll(async () => {
  handle = await createTestDb()
})
afterAll(() => handle.close())

const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg=='

test('a draft follows the current look; issuing freezes the look of that moment', async () => {
  const org = await seedOrg(handle, 'look-timing')
  await handle.db.insert(schema.businessProfile).values({ organizationId: org, legalName: 'Firma' })
  const api = clientFor(handle, { userId: 'u', organizationId: org, via: 'session' })
  const c = await api.contacts.create({ name: 'K' })

  await api.appearance.update({ accentColor: '#111111', showBrand: true })
  const draft = await api.documents.createDraft({
    contactId: c.id,
    lines: [{ description: 'x', quantity: '1', unitPrice: '1' }],
  })
  // Settings change while it is still a draft: colour, brand line and a logo that did not exist before.
  await api.appearance.update({ accentColor: '#222222', showBrand: false })
  await api.appearance.setAsset({ kind: 'logo', dataBase64: PNG })
  const asDraft = await api.documents.get({ id: draft.id })
  expect(asDraft.look).toMatchObject({ accentColor: '#222222', showBrand: false })
  expect(asDraft.look.logo?.startsWith('data:image/png')).toBe(true)

  const issued = await api.documents.issue({ id: draft.id })
  expect(issued.look).toMatchObject({ accentColor: '#222222', showBrand: false })
  expect(issued.look.logo?.startsWith('data:image/png')).toBe(true)

  // Settings change again after issue: the document and its public page keep the issue-time look.
  await api.appearance.update({ accentColor: '#333333', showBrand: true })
  await api.appearance.deleteAsset({ kind: 'logo' })
  const later = await api.documents.get({ id: draft.id })
  expect(later.look).toMatchObject({ accentColor: '#222222', showBrand: false })
  expect(later.look.logo?.startsWith('data:image/png')).toBe(true)
  const view = await clientFor(handle, null).public.invoice({ token: issued.publicToken as string })
  expect(view.appearance).toMatchObject({ accentColor: '#222222', showBrand: false })
  expect(view.appearance.logo?.startsWith('data:image/png')).toBe(true)
})

test('a draft made with a logo is issued without it once the logo is removed', async () => {
  const org = await seedOrg(handle, 'look-removed')
  await handle.db.insert(schema.businessProfile).values({ organizationId: org, legalName: 'Firma' })
  const api = clientFor(handle, { userId: 'u', organizationId: org, via: 'session' })
  const c = await api.contacts.create({ name: 'K' })
  await api.appearance.setAsset({ kind: 'logo', dataBase64: PNG })
  const draft = await api.documents.createDraft({
    contactId: c.id,
    lines: [{ description: 'x', quantity: '1', unitPrice: '1' }],
  })
  await api.appearance.deleteAsset({ kind: 'logo' })
  expect((await api.documents.get({ id: draft.id })).look.logo).toBeNull()
  expect((await api.documents.issue({ id: draft.id })).look.logo).toBeNull()
})

test('a draft that still carries a stored look ignores it and replaces it at issue', async () => {
  const org = await seedOrg(handle, 'look-stale')
  await handle.db.insert(schema.businessProfile).values({ organizationId: org, legalName: 'Firma' })
  const api = clientFor(handle, { userId: 'u', organizationId: org, via: 'session' })
  const c = await api.contacts.create({ name: 'K' })
  const draft = await api.documents.createDraft({
    contactId: c.id,
    lines: [{ description: 'x', quantity: '1', unitPrice: '1' }],
  })
  // Drafts made before the look moved to issue time have one stored.
  await handle.db
    .update(schema.document)
    .set({
      appearance: {
        accentColor: '#aaaaaa',
        showBrand: false,
        logoAssetId: null,
        signatureAssetId: null,
      },
    })
    .where(eq(schema.document.id, draft.id))
  await api.appearance.update({ accentColor: '#222222', showBrand: true })

  const live = { accentColor: '#222222', showBrand: true }
  expect((await api.documents.get({ id: draft.id })).look).toMatchObject(live)
  expect((await api.documents.issue({ id: draft.id })).look).toMatchObject(live)
  const [row] = await handle.db
    .select({ appearance: schema.document.appearance })
    .from(schema.document)
    .where(eq(schema.document.id, draft.id))
  expect(row?.appearance).toMatchObject(live)
})
