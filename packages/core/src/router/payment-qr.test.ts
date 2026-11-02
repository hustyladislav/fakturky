import { type DbHandle, schema } from '@fakturky/db'
import { and, eq } from 'drizzle-orm'
import { afterAll, beforeAll, expect, test } from 'vitest'
import type { SendInvoiceArgs } from '../context'
import { clientFor, createTestDb, seedOrg } from '../testing'

let handle: DbHandle
let orgId: string
beforeAll(async () => {
  handle = await createTestDb()
  orgId = await seedOrg(handle, 'payqr')
  await handle.db
    .insert(schema.businessProfile)
    .values({ organizationId: orgId, legalName: 'Dodavatel s.r.o.', ico: '27082440' })
})
afterAll(() => handle.close())

const principal = () => ({ userId: 'u', organizationId: orgId, via: 'session' as const })
const sent: SendInvoiceArgs[] = []
const services = {
  publicBaseUrl: 'https://example.test',
  renderPdf: async () => new Uint8Array([37, 80, 68, 70]),
  sendInvoice: async (a: SendInvoiceArgs) => {
    sent.push(a)
  },
}

async function issued() {
  const api = clientFor(handle, principal(), services)
  await api.bankAccounts.create({ label: 'Fio', account: '2400123455/2010' })
  const c = await api.contacts.create({ name: 'Odběratel', emails: ['zakaznik@example.com'] })
  const d = await api.documents.createDraft({
    contactId: c.id,
    lines: [{ description: 'Práce', quantity: '1', unitPrice: '1000' }],
  })
  return { api, doc: await api.documents.issue({ id: d.id }) }
}

test('the detail and public views carry a QR for the amount still due, and none once paid', async () => {
  const { api, doc } = await issued()
  const anon = clientFor(handle, null, services)
  const token = doc.publicToken as string

  expect(doc.paymentQr?.kind).toBe('spayd')
  expect((await anon.public.invoice({ token })).qr?.kind).toBe('spayd')

  const partly = await api.documents.markPaid({ id: doc.id, amount: '400' })
  expect(partly.status).toBe('issued')
  expect(partly.paymentQr?.kind).toBe('spayd')
  const png = await anon.public.qrPng({ token })
  expect(Buffer.from(png.contentBase64, 'base64').subarray(1, 4).toString()).toBe('PNG')

  const paid = await api.documents.markPaid({ id: doc.id })
  expect(paid.status).toBe('paid')
  expect(paid.paymentQr).toBeNull()
  expect((await anon.public.invoice({ token })).qr).toBeNull()
  await expect(anon.public.qrPng({ token })).rejects.toMatchObject({ code: 'NOT_FOUND' })
})

test('the QR image request is not a view of the invoice; the e-mail links the hosted PNG', async () => {
  const { api, doc } = await issued()
  const anon = clientFor(handle, null, services)
  await anon.public.qrPng({ token: doc.publicToken as string })
  const viewed = await handle.db
    .select()
    .from(schema.activity)
    .where(and(eq(schema.activity.entityId, doc.id), eq(schema.activity.action, 'viewed')))
  expect(viewed).toHaveLength(0)

  sent.length = 0
  await api.documents.send({ id: doc.id })
  expect(sent[0]?.qrUrl).toBe(`https://example.test/f/${doc.publicToken}/qr.png`)
})

test('an account with "show QR" switched off gets no QR anywhere', async () => {
  const api = clientFor(handle, principal(), services)
  const off = await api.bankAccounts.create({
    label: 'Bez QR',
    account: '19-2000145399/0800',
    showQr: false,
  })
  const c = await api.contacts.create({ name: 'Odběratel bez QR' })
  const d = await api.documents.createDraft({
    contactId: c.id,
    bankAccountId: off.id,
    lines: [{ description: 'Práce', quantity: '1', unitPrice: '100' }],
  })
  const doc = await api.documents.issue({ id: d.id })
  expect(doc.paymentQr).toBeNull()
  expect(
    (await clientFor(handle, null).public.invoice({ token: doc.publicToken as string })).qr,
  ).toBeNull()
})
