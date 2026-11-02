import { type DbHandle, schema } from '@fakturky/db'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { clientFor, createTestDb, seedOrg } from '../testing'

let handle: DbHandle
let orgId: string
beforeAll(async () => {
  handle = await createTestDb()
  orgId = await seedOrg(handle, 'pubsec')
  await handle.db
    .insert(schema.businessProfile)
    .values({ organizationId: orgId, legalName: 'Dodavatel s.r.o.', ico: '27082440' })
})
afterAll(() => handle.close())

const principal = () => ({ userId: 'u', organizationId: orgId, via: 'session' as const })

async function issued(note = 'privátní poznámka') {
  const api = clientFor(handle, principal())
  const c = await api.contacts.create({ name: 'Odběratel', emails: ['zakaznik@example.com'] })
  const d = await api.documents.createDraft({
    contactId: c.id,
    privateNote: note,
    lines: [{ description: 'Práce', quantity: '1', unitPrice: '1000' }],
  })
  return api.documents.issue({ id: d.id })
}

test('public tokens carry 192 bits of entropy and never repeat', async () => {
  const tokens = new Set<string>()
  for (let i = 0; i < 12; i++) tokens.add((await issued()).publicToken as string)
  expect(tokens.size).toBe(12)
  for (const t of tokens) {
    expect(t).toMatch(/^[A-Za-z0-9_-]{32}$/) // 24 random bytes, base64url
  }
})

test('rotating the link revokes the old one at once; only issued documents have one', async () => {
  const api = clientFor(handle, principal())
  const anon = clientFor(handle, null)
  const doc = await issued()
  const oldToken = doc.publicToken as string
  expect((await anon.public.invoice({ token: oldToken })).number).toBe(doc.number)

  const rotated = await api.documents.rotateLink({ id: doc.id })
  expect(rotated.publicToken).toMatch(/^[A-Za-z0-9_-]{32}$/)
  expect(rotated.publicToken).not.toBe(oldToken)
  await expect(anon.public.invoice({ token: oldToken })).rejects.toMatchObject({
    code: 'NOT_FOUND',
  })
  await expect(anon.public.isdoc({ token: oldToken })).rejects.toMatchObject({ code: 'NOT_FOUND' })
  expect((await anon.public.invoice({ token: rotated.publicToken as string })).number).toBe(
    doc.number,
  )

  const draft = await api.documents.createDraft({
    lines: [{ description: 'x', quantity: '1', unitPrice: '1' }],
  })
  await expect(api.documents.rotateLink({ id: draft.id })).rejects.toMatchObject({
    code: 'CONFLICT',
  })
})

test('the public payload is an explicit allow-list (new fields must be added here on purpose)', async () => {
  const doc = await issued('TAJNÉ-123')
  const view = await clientFor(handle, null).public.invoice({ token: doc.publicToken as string })
  expect(Object.keys(view).sort()).toEqual(
    [
      'bank',
      'currency',
      'customer',
      'dueDate',
      'exchangeRate',
      'footerText',
      'introText',
      'issueDate',
      'lines',
      'number',
      'original',
      'overdue',
      'paymentMethod',
      'qr',
      'recap',
      'remaining',
      'status',
      'subtotal',
      'supplier',
      'taxableDate',
      'total',
      'type',
      'vatPayer',
      'variableSymbol',
      'vatTotal',
    ].sort(),
  )
  const json = JSON.stringify(view)
  for (const secret of ['TAJNÉ-123', 'zakaznik@example.com', orgId, doc.id, doc.contactId ?? '?']) {
    expect(json).not.toContain(secret)
  }
  expect(Object.keys(view.customer).sort()).toEqual(
    ['city', 'dic', 'ico', 'name', 'registerNote', 'street', 'zip'].sort(),
  )
})

test('deleted documents and malformed tokens are not found', async () => {
  const doc = await issued()
  await handle.db
    .update(schema.document)
    .set({ deletedAt: new Date() })
    .where(eq(schema.document.id, doc.id))
  const anon = clientFor(handle, null)
  await expect(anon.public.invoice({ token: doc.publicToken as string })).rejects.toMatchObject({
    code: 'NOT_FOUND',
  })
  for (const token of [
    '',
    'short',
    'x'.repeat(201),
    "' OR 1=1 --".padEnd(24, 'x'),
    '%'.repeat(30),
  ]) {
    await expect(anon.public.invoice({ token })).rejects.toBeDefined()
  }
})
