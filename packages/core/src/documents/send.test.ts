import { type DbHandle, schema } from '@fakturky/db'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { MailError, type SendInvoiceArgs } from '../context'
import { documentsRepo } from './repo'
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
  // §29 ZDPH: a tax invoice needs the customer's address (field-level error); a consumer without IČO/DIČ is fine.
  await expect(api.documents.issue({ id: incomplete.id })).rejects.toMatchObject({
    code: 'PRECONDITION_FAILED',
    data: { fields: ['customer.address'] },
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
  // A second full credit note would refund twice; the corrected invoice cannot also be cancelled.
  const again = await api.documents.createCreditNote({ id: inv.id, reason: 'Znovu' })
  await expect(api.documents.issue({ id: again.id })).rejects.toMatchObject({ code: 'CONFLICT' })
  await expect(api.documents.cancel({ id: inv.id })).rejects.toMatchObject({ code: 'CONFLICT' })
  const unpaid = await api.documents.list({ filter: 'unpaid' })
  expect(unpaid.some((d) => d.id === cn.id)).toBe(false)
  const dash = await api.dashboard.summary({})
  expect(dash.monthTurnover).toBe('0.00')
})

test('a credit note settles the invoice balance and asks for no payment; cancelling it reopens the invoice', async () => {
  const org = await seedOrg(handle, 'cn-balance')
  await handle.db
    .insert(schema.businessProfile)
    .values({ organizationId: org, legalName: 'Neplátce' })
  const api = clientFor(handle, { userId: 'u', organizationId: org, via: 'session' })
  const c = await api.contacts.create({ name: 'Odběratel' })
  const inv = await api.documents.issue({
    id: (
      await api.documents.createDraft({
        contactId: c.id,
        lines: [{ description: 'Práce', quantity: '1', unitPrice: '1000' }],
      })
    ).id,
  })
  const cn = await api.documents.issue({
    id: (await api.documents.createCreditNote({ id: inv.id, reason: 'Storno služby' })).id,
  })
  const after = await api.documents.get({ id: inv.id })
  expect(after.status).toBe('paid')
  expect(after.remaining).toBe('0.00')
  expect(after.payments.map((p) => [p.method, p.note, p.amount])).toEqual([
    ['credit_note', cn.number, '1000.0000'],
  ])
  expect((await api.documents.list({ filter: 'unpaid' })).some((d) => d.id === inv.id)).toBe(false)
  // Related documents are linked both ways and the list can be narrowed by type.
  expect((await api.documents.get({ id: cn.id })).parent).toMatchObject({ id: inv.id })
  expect(after.related.map((r) => r.id)).toEqual([cn.id])
  expect((await api.documents.list({ type: 'credit_note' })).map((d) => d.id)).toEqual([cn.id])
  // The credit note is exported without a payment request (no due date, bank details or QR).
  const { toDocumentForExport } = await import('./export')
  const found = await documentsRepo.forExport(handle.db, org, cn.id)
  expect(toDocumentForExport(found!.doc, found!.lines).payment).toBeNull()

  await api.documents.cancel({ id: cn.id })
  const reopened = await api.documents.get({ id: inv.id })
  expect(reopened.status).toBe('issued')
  expect(reopened.remaining).toBe('1000.00')
  expect(reopened.payments).toHaveLength(0)
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
    code: 'PRECONDITION_FAILED',
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
      {
        description: 'Služba osvobozená',
        quantity: '1',
        unitPrice: '500',
        vatTreatment: 'exempt',
        vatNote: '§ 51 odst. 1 zákona o DPH',
      },
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

test('exempt lines need a legal basis; EU reverse charge needs the customer VAT ID', async () => {
  const org = await seedOrg(handle, 'vat-basis')
  await handle.db
    .insert(schema.businessProfile)
    .values({ organizationId: org, legalName: 'Plátce', vatStatus: 'payer' })
  const api = clientFor(handle, { userId: 'u', organizationId: org, via: 'session' })
  const c = await api.contacts.create({
    name: 'CZ klient',
    ico: '12345678',
    address: { street: 'A 1', city: 'Praha', zip: '11000' },
  })
  const exempt = await api.documents.createDraft({
    contactId: c.id,
    lines: [{ description: 'Pojištění', quantity: '1', unitPrice: '100', vatTreatment: 'exempt' }],
  })
  await expect(api.documents.issue({ id: exempt.id })).rejects.toMatchObject({
    data: { fields: ['line.vatNote'] },
  })
  await api.documents.updateDraft({
    id: exempt.id,
    patch: {
      lines: [
        {
          description: 'Pojištění',
          quantity: '1',
          unitPrice: '100',
          vatTreatment: 'exempt',
          vatNote: '§ 55 zákona o DPH',
          vatRate: '0',
          discountPercent: '0',
        },
      ],
    },
  })
  expect((await api.documents.issue({ id: exempt.id })).lines[0]?.vatNote).toBe('§ 55 zákona o DPH')

  const eu = await api.documents.createDraft({
    contactId: c.id,
    lines: [
      { description: 'Služba', quantity: '1', unitPrice: '100', vatTreatment: 'eu_reverse_charge' },
    ],
  })
  await expect(api.documents.issue({ id: eu.id })).rejects.toMatchObject({
    data: { fields: ['customer.vatId', 'customer.country'] },
  })
  await api.contacts.update({ id: c.id, patch: { icDph: 'DE123456789' } })
  // A Czech customer cannot be invoiced under the EU reverse charge.
  await expect(api.documents.issue({ id: eu.id })).rejects.toMatchObject({
    data: { fields: ['customer.country'] },
  })
  await api.contacts.update({ id: c.id, patch: { country: 'DE' } })
  const issuedEu = await api.documents.issue({ id: eu.id })
  expect(issuedEu.status).toBe('issued')
  expect(issuedEu.customerSnapshot).toMatchObject({ country: 'DE' })
})

test('rounding to whole units is a separate line; foreign currency keeps CZK VAT', async () => {
  const org = await seedOrg(handle, 'rounding')
  await handle.db
    .insert(schema.businessProfile)
    .values({ organizationId: org, legalName: 'Plátce', vatStatus: 'payer' })
  const api = clientFor(handle, { userId: 'u', organizationId: org, via: 'session' })
  const c = await api.contacts.create({
    name: 'K',
    ico: '12345678',
    address: { street: 'A 1', city: 'Praha', zip: '11000' },
  })
  const d = await api.documents.createDraft({
    contactId: c.id,
    roundTotal: true,
    lines: [{ description: 'x', quantity: '1', unitPrice: '100.40', vatRate: '21' }],
  })
  // 100,40 + 21,08 = 121,48 → 121, rounding −0,48
  expect(d.total).toBe('121.0000')
  expect(d.rounding).toBe('-0.4800')
  const issued = await api.documents.issue({ id: d.id })
  expect(issued.total).toBe('121.0000')
  const view = await clientFor(handle, null).public.invoice({ token: issued.publicToken as string })
  expect(view.rounding).toBe('-0.4800')
  expect(view.total).toBe('121.0000')
  const off = await api.documents.updateDraft({
    id: (await api.documents.duplicate({ id: issued.id })).id,
    patch: { roundTotal: false },
  })
  expect(off.rounding).toBe('0.0000')
  expect(off.total).toBe('121.4800')
})

test('appearance: accent colour, private logo/signature validated by content, included in the export', async () => {
  const org = await seedOrg(handle, 'look-a')
  const other = await seedOrg(handle, 'look-b')
  for (const id of [org, other]) {
    await handle.db
      .insert(schema.businessProfile)
      .values({ organizationId: id, legalName: 'Firma' })
  }
  const api = clientFor(handle, { userId: 'u', organizationId: org, via: 'session' })
  const png =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg=='
  expect((await api.appearance.get({})).logo).toBeNull()
  await expect(api.appearance.update({ accentColor: 'red' })).rejects.toBeTruthy()
  expect(
    (await api.appearance.update({ accentColor: '#112233', showBrand: false })).accentColor,
  ).toBe('#112233')
  await expect(
    api.appearance.setAsset({
      kind: 'logo',
      dataBase64: Buffer.from('<svg onload=alert(1)>').toString('base64') + 'AAAA',
    }),
  ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  const withLogo = await api.appearance.setAsset({ kind: 'logo', dataBase64: png })
  expect(withLogo.logo?.startsWith('data:image/png;base64,')).toBe(true)
  // Another organization never sees it.
  const theirs = await clientFor(handle, {
    userId: 'u',
    organizationId: other,
    via: 'session',
  }).appearance.get({})
  expect(theirs.logo).toBeNull()
  expect(theirs.accentColor).toBeNull()
  const exported = JSON.parse((await api.exports.organization({})).json)
  expect(exported.images[0]).toMatchObject({ kind: 'logo', contentType: 'image/png' })
  // A truncated PNG with a valid signature is rejected as damaged.
  const truncated = Buffer.from(png, 'base64').subarray(0, 20).toString('base64')
  await expect(
    api.appearance.setAsset({ kind: 'signature', dataBase64: truncated }),
  ).rejects.toMatchObject({
    data: { fields: ['image.corrupt'] },
  })
  // Documents keep the look they were issued with, even after settings change.
  const c = await api.contacts.create({ name: 'K' })
  const draft = await api.documents.createDraft({
    contactId: c.id,
    lines: [{ description: 'x', quantity: '1', unitPrice: '1' }],
  })
  const issued = await api.documents.issue({ id: draft.id })
  await api.appearance.update({ accentColor: '#ff0000', showBrand: true })
  await api.appearance.deleteAsset({ kind: 'logo' })
  const view = await clientFor(handle, null).public.invoice({ token: issued.publicToken as string })
  expect(view.appearance.accentColor).toBe('#112233')
  expect(view.appearance.showBrand).toBe(false)
  expect(view.appearance.logo?.startsWith('data:image/png')).toBe(true)
  expect((await api.appearance.get({})).logo).toBeNull()
})

test('VAT payer advance: proforma → paid → tax receipt → final invoice deducting base and VAT', async () => {
  const org = await seedOrg(handle, 'advance-payer')
  await handle.db
    .insert(schema.businessProfile)
    .values({ organizationId: org, legalName: 'Plátce', vatStatus: 'payer' })
  const api = clientFor(handle, { userId: 'u', organizationId: org, via: 'session' })
  const c = await api.contacts.create({
    name: 'K',
    ico: '12345678',
    address: { street: 'A 1', city: 'Praha', zip: '11000' },
  })
  const pf = await api.documents.issue({
    id: (
      await api.documents.createDraft({
        type: 'proforma',
        contactId: c.id,
        lines: [{ description: 'Projekt', quantity: '1', unitPrice: '10000', vatRate: '21' }],
      })
    ).id,
  })
  await api.documents.markPaid({ id: pf.id })
  // The final invoice needs the receipt first.
  await expect(api.documents.createFinalInvoice({ id: pf.id })).rejects.toMatchObject({
    code: 'PRECONDITION_FAILED',
  })
  const rDraft = await api.documents.createPaymentReceipt({ id: pf.id, vatRate: '21' })
  expect(rDraft.type).toBe('payment_receipt')
  expect(rDraft.total).toBe('10000.0000') // the advance is VAT-inclusive
  expect(rDraft.vatTotal).toBe('1735.5400') // 10 000 × 21 / 121
  await expect(api.documents.createPaymentReceipt({ id: pf.id })).rejects.toMatchObject({
    code: 'CONFLICT',
  })
  const receipt = await api.documents.issue({ id: rDraft.id })
  expect(receipt.number).toMatch(/^P\d{4}-0001$/)
  expect(receipt.status).toBe('paid') // documents a payment already received
  await expect(api.documents.markUnpaid({ id: pf.id })).rejects.toMatchObject({ code: 'CONFLICT' })

  const fin = await api.documents.createFinalInvoice({ id: pf.id })
  // Work (gross 12 100 for the full 10 000 net) minus the receipt (8 264,46 net + 1 735,54 VAT).
  expect(fin.lines.map((l) => l.vatRate)).toEqual(['21.00', '21.00'])
  const issued = await api.documents.issue({ id: fin.id })
  expect(issued.status).toBe('issued')
  expect(Number(issued.total)).toBeCloseTo(2100, 2) // 12 100 − 10 000: the VAT-exclusive remainder is billed
})

test('a receipt can split the advance over 21 % and 12 %; the final invoice deducts each rate', async () => {
  const org = await seedOrg(handle, 'advance-mixed')
  await handle.db
    .insert(schema.businessProfile)
    .values({ organizationId: org, legalName: 'Plátce', vatStatus: 'payer' })
  const api = clientFor(handle, { userId: 'u', organizationId: org, via: 'session' })
  const c = await api.contacts.create({
    name: 'K',
    ico: '12345678',
    address: { street: 'A 1', city: 'Praha', zip: '11000' },
  })
  const pf = await api.documents.issue({
    id: (
      await api.documents.createDraft({
        type: 'proforma',
        contactId: c.id,
        lines: [{ description: 'Dílo', quantity: '1', unitPrice: '10000' }],
      })
    ).id,
  })
  await api.documents.markPaid({ id: pf.id })
  // The split must add up to the money received.
  await expect(
    api.documents.createPaymentReceipt({
      id: pf.id,
      allocations: [
        { vatRate: '21', amount: '6000' },
        { vatRate: '12', amount: '3000' },
      ],
    }),
  ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  const r = await api.documents.createPaymentReceipt({
    id: pf.id,
    allocations: [
      { vatRate: '21', amount: '6050' },
      { vatRate: '12', amount: '3950' },
    ],
  })
  expect(r.lines.map((l) => l.vatRate)).toEqual(['21.00', '12.00'])
  expect(r.total).toBe('10000.0000')
  expect(r.vatTotal).toBe('1473.2100') // 6 050 × 21/121 + 3 950 × 12/112
  await api.documents.issue({ id: r.id })
  const fin = await api.documents.createFinalInvoice({ id: pf.id })
  const deductions = fin.lines.filter((l) => Number(l.unitPrice) < 0)
  expect(deductions.map((l) => l.vatRate)).toEqual(['21.00', '12.00'])
})

test('tax receipt keeps the received gross, uses the payment date as tax point, cannot be created directly', async () => {
  const org = await seedOrg(handle, 'receipt-fix')
  await handle.db
    .insert(schema.businessProfile)
    .values({ organizationId: org, legalName: 'Plátce', vatStatus: 'payer' })
  const api = clientFor(handle, { userId: 'u', organizationId: org, via: 'session' })
  const c = await api.contacts.create({
    name: 'K',
    ico: '12345678',
    address: { street: 'A 1', city: 'Praha', zip: '11000' },
  })
  await expect(
    api.documents.createDraft({ type: 'payment_receipt', contactId: c.id, lines: [] }),
  ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  const pf = await api.documents.issue({
    id: (
      await api.documents.createDraft({
        type: 'proforma',
        contactId: c.id,
        lines: [{ description: 'Záloha', quantity: '1', unitPrice: '100.06' }],
      })
    ).id,
  })
  await api.documents.markPaid({ id: pf.id, paidOn: '2026-01-05' })
  const r = await api.documents.createPaymentReceipt({ id: pf.id, vatRate: '21' })
  expect(r.total).toBe('100.0600')
  expect(r.taxableDate).toBe('2026-01-05')
  const issued = await api.documents.issue({ id: r.id })
  const xml = (await api.documents.isdoc({ id: issued.id })).xml
  expect(xml).not.toContain('<PaymentMeans>')
})

test('CZK cash drafts round by default (explicit choice wins); a receipt needs a single payment date', async () => {
  const org = await seedOrg(handle, 'cash-round')
  await handle.db
    .insert(schema.businessProfile)
    .values({ organizationId: org, legalName: 'Plátce', vatStatus: 'payer' })
  const api = clientFor(handle, { userId: 'u', organizationId: org, via: 'session' })
  const c = await api.contacts.create({
    name: 'K',
    ico: '12345678',
    address: { street: 'A 1', city: 'Praha', zip: '11000' },
  })
  const line = [{ description: 'x', quantity: '1', unitPrice: '100.40', vatRate: '21' }]
  expect(
    (await api.documents.createDraft({ contactId: c.id, paymentMethod: 'cash', lines: line }))
      .roundTotal,
  ).toBe(true)
  expect((await api.documents.createDraft({ contactId: c.id, lines: line })).roundTotal).toBe(false)
  expect(
    (
      await api.documents.createDraft({
        contactId: c.id,
        paymentMethod: 'cash',
        roundTotal: false,
        lines: line,
      })
    ).roundTotal,
  ).toBe(false)

  const pf = await api.documents.issue({
    id: (
      await api.documents.createDraft({
        type: 'proforma',
        contactId: c.id,
        lines: [{ description: 'Z', quantity: '1', unitPrice: '1000' }],
      })
    ).id,
  })
  await api.documents.markPaid({ id: pf.id, amount: '400', paidOn: '2026-01-05' })
  await api.documents.markPaid({ id: pf.id, amount: '600', paidOn: '2026-02-03' })
  await expect(api.documents.createPaymentReceipt({ id: pf.id })).rejects.toMatchObject({
    code: 'CONFLICT',
  })
})

test('payments: invalid amount, impossible or future date and overpayment are client errors', async () => {
  const org = await seedOrg(handle, 'pay-validation')
  await handle.db
    .insert(schema.businessProfile)
    .values({ organizationId: org, legalName: 'Neplátce' })
  const api = clientFor(handle, { userId: 'u', organizationId: org, via: 'session' })
  const c = await api.contacts.create({ name: 'Klient' })
  const inv = await api.documents.issue({
    id: (
      await api.documents.createDraft({
        contactId: c.id,
        lines: [{ description: 'x', quantity: '1', unitPrice: '1000' }],
      })
    ).id,
  })
  await expect(api.documents.markPaid({ id: inv.id, amount: 'abc' })).rejects.toMatchObject({
    code: 'BAD_REQUEST',
  })
  await expect(
    api.documents.markPaid({ id: inv.id, amount: '1', paidOn: '2026-13-45' }),
  ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  await expect(
    api.documents.markPaid({ id: inv.id, amount: '1', paidOn: '2999-01-01' }),
  ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  await expect(api.documents.markPaid({ id: inv.id, amount: '1000.01' })).rejects.toMatchObject({
    code: 'BAD_REQUEST',
  })
  const paid = await api.documents.markPaid({ id: inv.id, amount: '1 000,00' })
  expect(paid.status).toBe('paid')
})

test('a VAT payer can issue a tax invoice to a consumer without IČO/DIČ (address is enough)', async () => {
  const org = await seedOrg(handle, 'consumer-a')
  await handle.db
    .insert(schema.businessProfile)
    .values({ organizationId: org, legalName: 'Plátce', vatStatus: 'payer' })
  const api = clientFor(handle, { userId: 'u', organizationId: org, via: 'session' })
  const consumer = await api.contacts.create({
    name: 'Marie Svobodová',
    address: { street: 'Dlouhá 5', city: 'České Budějovice', zip: '37001' },
  })
  await expect(
    api.documents.issue({
      id: (
        await api.documents.createDraft({
          contactId: consumer.id,
          lines: [{ description: 'x', quantity: '1', unitPrice: '1', vatRate: '21' }],
        })
      ).id,
    }),
  ).resolves.toMatchObject({ status: 'issued' })
})
