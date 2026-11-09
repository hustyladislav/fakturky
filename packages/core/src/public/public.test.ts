import { type DbHandle, schema } from '@fakturky/db'
import { generateIsdoc } from '@fakturky/domain'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { toDocumentForExport } from '../documents/export'
import { publicDocumentsRepo } from './repo'
import { clientFor, createTestDb, seedOrg } from '../testing'

let handle: DbHandle
beforeAll(async () => {
  handle = await createTestDb()
})
afterAll(() => handle.close())

test('pdf procedures use the injected renderer', async () => {
  const org = await seedOrg(handle, 'pub-pdf')
  await handle.db.insert(schema.businessProfile).values({ organizationId: org, legalName: 'X' })
  const principal = { userId: 'u', organizationId: org, via: 'session' as const }
  const api = clientFor(handle, principal, {
    renderPdf: async (doc) => new TextEncoder().encode(`pdf:${doc.number}`),
  })
  const c = await api.contacts.create({ name: 'O' })
  const d = await api.documents.createDraft({
    contactId: c.id,
    lines: [{ description: 'x', quantity: '1', unitPrice: '10' }],
  })
  await expect(api.documents.pdf({ id: d.id })).rejects.toMatchObject({ code: 'NOT_FOUND' })
  const issued = await api.documents.issue({ id: d.id })
  const out = await api.documents.pdf({ id: issued.id })
  expect(Buffer.from(out.contentBase64, 'base64').toString()).toBe(`pdf:${issued.number}`)
  const anon = clientFor(handle, null, { renderPdf: async () => new Uint8Array([1]) })
  expect((await anon.public.pdf({ token: issued.publicToken as string })).filename).toBe(
    `${issued.number}.pdf`,
  )
  await expect(clientFor(handle, principal).documents.pdf({ id: issued.id })).rejects.toMatchObject(
    {
      code: 'NOT_IMPLEMENTED',
    },
  )
})

test('public invoice is token-gated, hides private data, records the first view', async () => {
  const org = await seedOrg(handle, 'pub-a')
  await handle.db
    .insert(schema.businessProfile)
    .values({ organizationId: org, legalName: 'Dodavatel s.r.o.', ico: '27082440' })
  const api = clientFor(handle, { userId: 'u', organizationId: org, via: 'session' })
  const c = await api.contacts.create({ name: 'Odběratel', emails: ['secret@example.com'] })
  const draft = await api.documents.createDraft({
    contactId: c.id,
    privateNote: 'TAJNÉ',
    lines: [{ description: 'Práce', quantity: '1', unitPrice: '1000' }],
  })
  // Drafts have no token: nothing to leak.
  expect(draft.publicToken).toBeNull()
  const issued = await api.documents.issue({ id: draft.id })
  const token = issued.publicToken as string

  const anon = clientFor(handle, null)
  const view = await anon.public.invoice({ token })
  expect(view.number).toBe(issued.number)
  expect(view.total).toBe('1000.0000')
  const json = JSON.stringify(view)
  expect(json).not.toContain('TAJNÉ')
  expect(json).not.toContain('secret@example.com')
  expect(json).not.toContain(org)
  expect(json).not.toContain(c.id)

  await expect(anon.public.invoice({ token: 'x'.repeat(30) })).rejects.toMatchObject({
    code: 'NOT_FOUND',
  })
  await anon.public.invoice({ token })
  const detail = await api.documents.get({ id: issued.id })
  expect(detail.activity.filter((a) => a.action === 'viewed')).toHaveLength(1)

  const found = await publicDocumentsRepo.getByToken(handle.db, token)
  if (!found) throw new Error('missing')
  const xml = generateIsdoc(toDocumentForExport(found.doc, found.lines))
  expect(xml).toContain('<ID>' + issued.number + '</ID>')
  expect(xml).not.toContain('TAJNÉ')

  const exported = await api.documents.isdoc({ id: issued.id })
  expect(exported.xml).toBe(xml)
  expect((await anon.public.isdoc({ token })).filename).toBe(`${issued.number}.isdoc`)
  await expect(api.documents.isdoc({ id: draft.id })).resolves.toBeTruthy()

  await api.documents.cancel({ id: issued.id })
  const cancelled = await anon.public.invoice({ token })
  expect(cancelled.status).toBe('cancelled')
  expect(cancelled.remaining).toBe('0.00')
})
