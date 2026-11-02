import { type DbHandle, schema } from '@fakturky/db'
import { eq } from 'drizzle-orm'
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
  const bare = await api.contacts.create({ name: 'Bez údajů' })
  const incomplete = await api.documents.createDraft({
    contactId: bare.id,
    lines: [{ description: 'x', quantity: '1', unitPrice: '1', vatRate: '21' }],
  })
  // §29 ZDPH: a tax invoice needs the customer's address and IČO/DIČ (field-level error).
  await expect(api.documents.issue({ id: incomplete.id })).rejects.toMatchObject({
    code: 'PRECONDITION_FAILED',
    data: { fields: ['customer.address', 'customer.taxId'] },
  })
  const c = await api.contacts.create({
    name: 'Odběratel',
    ico: '12345678',
    address: { street: 'Hlavní 1', city: 'Praha', zip: '11000' },
  })
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
  // The generic path cannot create credit notes; duplicating one is refused too.
  await expect(
    api.documents.createDraft({ type: 'credit_note', contactId: c.id, lines: [] }),
  ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  // VAT treatment follows the corrected invoice even if the supplier is no longer a payer.
  await handle.db
    .update(schema.businessProfile)
    .set({ vatStatus: 'non_payer' })
    .where(eq(schema.businessProfile.organizationId, org))
  const cn = await api.documents.issue({ id: draft.id })
  expect(cn.vatMode).not.toBe('none')
  expect(cn.total).toBe('-2420.0000')
  await expect(api.documents.duplicate({ id: cn.id })).rejects.toMatchObject({ code: 'CONFLICT' })
  expect((await api.documents.get({ id: cn.id })).displayStatus).toBe('issued')
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

test('proforma → paid → final invoice with the advance deducted; settled on issue', async () => {
  const org = await seedOrg(handle, 'pf-a')
  await handle.db
    .insert(schema.businessProfile)
    .values({ organizationId: org, legalName: 'Neplátce' })
  const api = clientFor(handle, { userId: 'u', organizationId: org, via: 'session' })
  const c = await api.contacts.create({ name: 'Klient' })
  const pf = await api.documents.issue({
    id: (
      await api.documents.createDraft({
        type: 'proforma',
        contactId: c.id,
        lines: [{ description: 'Záloha na projekt', quantity: '1', unitPrice: '5000' }],
      })
    ).id,
  })
  expect(pf.number).toMatch(/^Z\d{4}-0001$/)
  await expect(api.documents.createFinalInvoice({ id: pf.id })).rejects.toMatchObject({
    code: 'CONFLICT',
  })
  await api.documents.markPaid({ id: pf.id })
  const draft = await api.documents.createFinalInvoice({ id: pf.id })
  expect(draft.type).toBe('invoice')
  expect(draft.total).toBe('0.0000') // lines 5000 − advance 5000
  expect(draft.lines.at(-1)?.unitPrice).toBe('-5000.0000')
  await expect(api.documents.createFinalInvoice({ id: pf.id })).rejects.toMatchObject({
    code: 'CONFLICT',
  })
  await expect(api.documents.markUnpaid({ id: pf.id })).rejects.toMatchObject({ code: 'CONFLICT' })
  const issued = await api.documents.issue({ id: draft.id })
  expect(issued.status).toBe('paid')
  await expect(api.documents.markUnpaid({ id: issued.id })).rejects.toMatchObject({
    code: 'CONFLICT',
  })
  expect((await api.documents.get({ id: pf.id })).activity.map((a) => a.action)).toContain(
    'final_invoice_created',
  )

  const payer = await seedOrg(handle, 'pf-b')
  await handle.db
    .insert(schema.businessProfile)
    .values({ organizationId: payer, legalName: 'Plátce', vatStatus: 'payer' })
  const p = clientFor(handle, { userId: 'u', organizationId: payer, via: 'session' })
  const pc = await p.contacts.create({ name: 'K' })
  const ppf = await p.documents.issue({
    id: (
      await p.documents.createDraft({
        type: 'proforma',
        contactId: pc.id,
        lines: [{ description: 'x', quantity: '1', unitPrice: '100' }],
      })
    ).id,
  })
  await p.documents.markPaid({ id: ppf.id })
  await expect(p.documents.createFinalInvoice({ id: ppf.id })).rejects.toMatchObject({
    code: 'CONFLICT',
  })
})

test('VAT payers use regimes instead of 0 %; regime legal text reaches the public view', async () => {
  const org = await seedOrg(handle, 'vat-regime')
  await handle.db
    .insert(schema.businessProfile)
    .values({ organizationId: org, legalName: 'Plátce', vatStatus: 'payer' })
  const api = clientFor(handle, { userId: 'u', organizationId: org, via: 'session' })
  const c = await api.contacts.create({
    name: 'Odběratel',
    ico: '12345678',
    address: { street: 'Hlavní 1', city: 'Praha', zip: '11000' },
  })
  await expect(
    api.documents.createDraft({
      contactId: c.id,
      lines: [{ description: 'x', quantity: '1', unitPrice: '100', vatRate: '0' }],
    }),
  ).rejects.toMatchObject({ code: 'BAD_REQUEST', data: { fields: ['line.vatRate'] } })
  const draft = await api.documents.createDraft({
    contactId: c.id,
    lines: [
      { description: 'Služba 21', quantity: '1', unitPrice: '1000', vatRate: '21' },
      { description: 'Služba osvobozená', quantity: '1', unitPrice: '500', vatTreatment: 'exempt' },
    ],
  })
  expect(draft.total).toBe('1710.0000') // 1000 + 210 VAT + 500 exempt
  expect(draft.vatRecap.map((r) => r.vatTreatment).sort()).toEqual(['exempt', 'standard'])
  const issued = await api.documents.issue({ id: draft.id })
  const view = await clientFor(handle, null).public.invoice({ token: issued.publicToken as string })
  expect(view.recap.find((r) => r.vatTreatment === 'exempt')?.note).toBe('Osvobozeno od DPH')
  const dup = await api.documents.duplicate({ id: issued.id })
  expect(dup.lines.map((l) => l.vatTreatment).sort()).toEqual(['exempt', 'standard'])
})
