import { type DbHandle, schema } from '@fakturky/db'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { MailError, type SendInvoiceArgs } from '../context'
import { clientFor, createTestDb, seedOrg } from '../testing'

let handle: DbHandle
beforeAll(async () => {
  handle = await createTestDb()
})
afterAll(() => handle.close())

test('send e-mails the PDF + public link, records history, maps delivery failures', async () => {
  const org = await seedOrg(handle, 'send-a')
  await handle.db
    .insert(schema.businessProfile)
    .values({ organizationId: org, legalName: 'Dodavatel', email: 'fakturace@dodavatel.cz' })
  const sent: SendInvoiceArgs[] = []
  let failWith: MailError | null = null
  const services = {
    publicBaseUrl: 'https://example.test',
    renderPdf: async () => new Uint8Array([37, 80, 68, 70]),
    sendInvoice: async (a: SendInvoiceArgs) => {
      if (failWith) throw failWith
      sent.push(a)
    },
  }
  const principal = { userId: 'u', organizationId: org, via: 'session' as const }
  const api = clientFor(handle, principal, services)
  const line = [{ description: 'x', quantity: '1', unitPrice: '100' }]
  const withMail = await api.contacts.create({ name: 'A', emails: ['klient@example.com'] })
  const noMail = await api.contacts.create({ name: 'B' })

  const inv = await api.documents.issue({
    id: (await api.documents.createDraft({ contactId: withMail.id, lines: line })).id,
  })
  const out = await api.documents.send({ id: inv.id, message: 'Díky!' })
  expect(sent[0]).toMatchObject({
    to: 'klient@example.com',
    replyTo: 'fakturace@dodavatel.cz',
    number: inv.number,
    isReminder: false,
    message: 'Díky!',
  })
  expect(sent[0]?.publicUrl).toBe(`https://example.test/f/${inv.publicToken}`)
  expect(out.activity.map((a) => a.action)).toContain('sent')

  failWith = new MailError('EMAIL_RESTRICTED')
  await expect(api.documents.send({ id: inv.id })).rejects.toMatchObject({
    code: 'SERVICE_UNAVAILABLE',
    data: { reason: 'EMAIL_RESTRICTED' },
  })
  failWith = null

  const bare = await api.documents.issue({
    id: (await api.documents.createDraft({ contactId: noMail.id, lines: line })).id,
  })
  await expect(api.documents.send({ id: bare.id })).rejects.toMatchObject({
    code: 'PRECONDITION_FAILED',
  })
  await api.documents.send({ id: bare.id, to: 'x@example.com' })

  const draft = await api.documents.createDraft({ contactId: withMail.id, lines: line })
  await expect(api.documents.send({ id: draft.id })).rejects.toMatchObject({ code: 'NOT_FOUND' })
  await expect(clientFor(handle, principal).documents.send({ id: inv.id })).rejects.toMatchObject({
    data: { reason: 'EMAIL_NOT_CONFIGURED' },
  })
  const other = clientFor(
    handle,
    { ...principal, organizationId: await seedOrg(handle, 'send-b') },
    services,
  )
  await expect(other.documents.send({ id: inv.id })).rejects.toMatchObject({ code: 'NOT_FOUND' })

  await api.documents.markPaid({ id: bare.id })
  await expect(api.documents.send({ id: bare.id, reminder: true })).rejects.toMatchObject({
    code: 'CONFLICT',
  })
})

test('credit note reverses an invoice, numbered in its own series, exported with the original', async () => {
  const org = await seedOrg(handle, 'cn-a')
  await handle.db
    .insert(schema.businessProfile)
    .values({ organizationId: org, legalName: 'Plátce', vatStatus: 'payer' })
  const api = clientFor(handle, { userId: 'u', organizationId: org, via: 'session' })
  const c = await api.contacts.create({ name: 'Odběratel' })
  const inv = await api.documents.issue({
    id: (
      await api.documents.createDraft({
        contactId: c.id,
        lines: [{ description: 'Práce', quantity: '2', unitPrice: '1000', vatRate: '21' }],
      })
    ).id,
  })
  const draft = await api.documents.createCreditNote({ id: inv.id, reason: 'Chybná cena' })
  expect(draft.type).toBe('credit_note')
  expect(draft.total).toBe('-2420.0000')
  expect(draft.introText).toBe('Chybná cena')
  const cn = await api.documents.issue({ id: draft.id })
  expect(cn.number).toMatch(/^D\d{4}-0001$/)
  expect((await api.documents.isdoc({ id: cn.id })).xml).toContain(inv.number as string)
  expect((await api.documents.get({ id: inv.id })).activity.map((a) => a.action)).toContain(
    'credit_note_created',
  )
  await expect(api.documents.createCreditNote({ id: cn.id })).rejects.toMatchObject({
    code: 'CONFLICT',
  })
  await expect(api.documents.createCreditNote({ id: draft.id })).rejects.toMatchObject({
    code: 'CONFLICT',
  })
  const unpaid = await api.documents.list({ filter: 'unpaid' })
  expect(unpaid.some((d) => d.id === cn.id)).toBe(false)
  const dash = await api.dashboard.summary({})
  expect(dash.monthTurnover).toBe('0.00')
})
