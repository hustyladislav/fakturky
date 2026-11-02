import { readFileSync } from 'node:fs'
import { type DbHandle, schema } from '@fakturky/db'
import { generateIsdoc } from '@fakturky/domain'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { clientFor, createTestDb, seedOrg } from '../testing'
import { contactsFromCsv, invoicesFromCsv, normalizeDate, parseCsv } from './csv'
import { parseIsdoc } from './isdoc'

const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')
const subjects = JSON.parse(fixture('fakturoid-subjects.json'))
const invoices = JSON.parse(fixture('fakturoid-invoices.json'))

/** Recorded Fakturoid API responses; asserts the auth flow and never leaks credentials into URLs. */
function fakturoidFetch(calls: { url: string; headers: Record<string, string> }[] = []) {
  return async (input: string, init?: RequestInit) => {
    const headers = Object.fromEntries(
      Object.entries((init?.headers ?? {}) as Record<string, string>),
    )
    calls.push({ url: input, headers })
    if (input.endsWith('/oauth/token')) {
      const expected = `Basic ${Buffer.from('cid:csecret').toString('base64')}`
      if (headers.authorization !== expected) return new Response('{}', { status: 401 })
      return Response.json({ access_token: 'tok', token_type: 'Bearer', expires_in: 7200 })
    }
    if (headers.authorization !== 'Bearer tok') return new Response('{}', { status: 401 })
    if (input.includes('/accounts/acme/subjects.json')) return Response.json(subjects)
    if (input.includes('/accounts/acme/invoices.json')) return Response.json(invoices)
    return new Response('{}', { status: 404 })
  }
}

let handle: DbHandle
beforeAll(async () => {
  handle = await createTestDb()
})
afterAll(() => handle.close())

const principal = (organizationId: string) => ({
  userId: 'user-1',
  organizationId,
  via: 'session' as const,
})
const creds = { accountSlug: 'acme', clientId: 'cid', clientSecret: 'csecret' }

describe('Fakturoid import', () => {
  test('dry run reports what would happen and persists nothing', async () => {
    const org = await seedOrg(handle, 'fk-dry')
    const api = clientFor(handle, principal(org), { fetch: fakturoidFetch() })
    const out = await api.import.fakturoid({ ...creds, dryRun: true })
    expect(out).toMatchObject({
      dryRun: true,
      contacts: { created: 2 },
      documents: { created: 4, failed: 0 },
    })
    expect(out.issues.some((i) => i.ref.startsWith('2023-0023') && i.level === 'skipped')).toBe(
      true,
    )
    expect(
      await handle.db.select().from(schema.contact).where(eq(schema.contact.organizationId, org)),
    ).toHaveLength(0)
    expect(
      await handle.db.select().from(schema.document).where(eq(schema.document.organizationId, org)),
    ).toHaveLength(0)
  })

  test('imports contacts and invoices with original numbers, payments and flag; is idempotent', async () => {
    const org = await seedOrg(handle, 'fk-real')
    await handle.db.insert(schema.businessProfile).values({
      organizationId: org,
      legalName: 'Dodavatel s.r.o.',
      vatStatus: 'payer',
    })
    const calls: { url: string; headers: Record<string, string> }[] = []
    const api = clientFor(handle, principal(org), { fetch: fakturoidFetch(calls) })

    const out = await api.import.fakturoid(creds)
    expect(out.contacts).toEqual({ created: 2, skipped: 0 })
    expect(out.documents).toEqual({ created: 4, skipped: 0, failed: 0 })
    expect(calls[0]?.headers['user-agent']).toContain('import')
    expect(calls.every((c) => !c.url.includes('csecret'))).toBe(true)

    const list = await api.documents.list({ filter: 'all' })
    const byNumber = Object.fromEntries(list.map((d) => [d.number, d]))
    expect(Object.keys(byNumber).sort()).toEqual([
      '2023-0003',
      '2023-0021',
      '2023-0022',
      '2023-0024',
    ])
    expect(byNumber['2023-0021']).toMatchObject({
      status: 'issued',
      importedFrom: 'fakturoid',
      total: '11000.0000',
      customerName: 'Apple Czech s.r.o.',
    })
    expect(byNumber['2023-0022']).toMatchObject({ status: 'paid', paidAmount: '12100.00' })
    expect(byNumber['2023-0003']).toMatchObject({ type: 'proforma' })
    expect(byNumber['2023-0024']).toMatchObject({
      status: 'cancelled',
      currency: 'EUR',
      exchangeRate: '24.500000',
    })

    const detail = await api.documents.get({ id: byNumber['2023-0021']?.id ?? '' })
    expect(detail.lines).toHaveLength(2)
    expect(detail.customerSnapshot).toMatchObject({ ico: '28897501' })
    expect(detail.vatRecap.map((r) => r.vatRate).sort()).toEqual(['15', '21'])

    // Series counters continue after the imported numbers (default pattern {YYYY}-{NNNN}).
    const counters = await handle.db
      .select()
      .from(schema.numberSeriesCounter)
      .where(eq(schema.numberSeriesCounter.organizationId, org))
    expect(counters.find((c) => c.period === '2023')?.nextValue).toBe(25)

    const again = await api.import.fakturoid(creds)
    expect(again.contacts).toEqual({ created: 0, skipped: 2 })
    expect(again.documents).toMatchObject({ created: 0, skipped: 4 })
  })

  test('rejects wrong credentials without echoing them, and bad slugs', async () => {
    const org = await seedOrg(handle, 'fk-bad')
    const api = clientFor(handle, principal(org), { fetch: fakturoidFetch() })
    const err = await api.import
      .fakturoid({ ...creds, clientSecret: 'wrong-secret' })
      .catch((e: Error) => e)
    expect(err).toMatchObject({ code: 'BAD_REQUEST' })
    expect((err as Error).message).not.toContain('wrong-secret')
    await expect(api.import.fakturoid({ ...creds, accountSlug: '../x' })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    })
  })

  test('is tenant-isolated', async () => {
    const a = await seedOrg(handle, 'fk-iso-a')
    const b = await seedOrg(handle, 'fk-iso-b')
    await clientFor(handle, principal(a), { fetch: fakturoidFetch() }).import.fakturoid(creds)
    expect(await clientFor(handle, principal(b)).documents.list({ filter: 'all' })).toHaveLength(0)
    // Same source ids in another org are not treated as duplicates.
    const out = await clientFor(handle, principal(b), { fetch: fakturoidFetch() }).import.fakturoid(
      creds,
    )
    expect(out.issues).toEqual(
      expect.not.arrayContaining([expect.objectContaining({ level: 'failed' })]),
    )
    expect(out.documents.created).toBe(4)
  })
})

describe('CSV import', () => {
  test('parser handles BOM, quotes, delimiter detection and Czech dates', () => {
    expect(parseCsv('﻿a;b\r\n"x;y";"say ""hi"""\r\n')).toEqual([
      ['a', 'b'],
      ['x;y', 'say "hi"'],
    ])
    expect(parseCsv('a,b\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
    expect(normalizeDate('5. 2. 2024')).toBe('2024-02-05')
    expect(normalizeDate('2024-02-05T10:00:00')).toBe('2024-02-05')
    expect(normalizeDate('nonsense')).toBeNull()
  })

  test('contacts CSV maps Czech headers', () => {
    const [first, second] = contactsFromCsv(fixture('contacts.csv'))
    expect(first).toMatchObject({
      name: 'Novák, s.r.o.',
      ico: '27082440',
      emails: ['fakturace@novak.cz'],
    })
    expect(second).toMatchObject({ name: 'Jan Svoboda', ico: null })
  })

  test('invoices CSV groups rows into documents; end-to-end import', async () => {
    const parsed = invoicesFromCsv(fixture('invoices.csv'))
    expect(parsed.documents).toHaveLength(2)
    expect(parsed.documents[0]?.lines).toHaveLength(2)
    expect(parsed.documents[0]?.lines[1]?.unitPrice).toBe('500.50')

    const org = await seedOrg(handle, 'csv-org')
    const api = clientFor(handle, principal(org))
    const contacts = await api.import.file({
      format: 'csv',
      kind: 'contacts',
      content: fixture('contacts.csv'),
    })
    expect(contacts.contacts.created).toBe(2)
    const out = await api.import.file({
      format: 'csv',
      kind: 'invoices',
      content: fixture('invoices.csv'),
    })
    expect(out.documents).toMatchObject({ created: 2, failed: 0 })
    const list = await api.documents.list({ filter: 'all' })
    expect(list.find((d) => d.number === '2024-0001')).toMatchObject({
      status: 'paid',
      importedFrom: 'csv',
      customerName: 'Novák s.r.o.', // invoice-time name, not the contact's current one
    })
    // Existing contact reused, not duplicated.
    expect(
      await handle.db.select().from(schema.contact).where(eq(schema.contact.organizationId, org)),
    ).toHaveLength(2)
  })

  test('reports unparseable rows instead of failing the batch', async () => {
    const org = await seedOrg(handle, 'csv-bad')
    const api = clientFor(handle, principal(org))
    const out = await api.import.file({
      format: 'csv',
      kind: 'invoices',
      content: 'number;issue_date;description;unit_price\nX1;not-a-date;a;1\nX2;2024-01-01;b;5\n',
    })
    expect(out.documents).toMatchObject({ created: 1, failed: 1 })
    expect(out.issues).toContainEqual(expect.objectContaining({ ref: 'X1', level: 'failed' }))
  })
})

describe('ISDOC import', () => {
  test('round-trips an ISDOC generated by this app', async () => {
    const xml = generateIsdoc({
      uuid: '3f2b8c1e-9a4d-4b7e-8c55-1d2e3f4a5b6c',
      number: '2025-0007',
      type: 'invoice',
      issueDate: '2025-03-01',
      taxableDate: '2025-03-01',
      dueDate: '2025-03-15',
      currency: 'CZK',
      vatPayer: true,
      supplier: {
        name: 'Dodavatel s.r.o.',
        ico: '27082440',
        dic: 'CZ27082440',
        street: 'Hlavní 1',
        city: 'Brno',
        zip: '60200',
      },
      customer: {
        name: 'Odběratel a.s.',
        ico: '12345678',
        street: 'Dlouhá 5',
        city: 'Praha',
        zip: '11000',
      },
      lines: [
        { description: 'Práce', quantity: '2', unitPrice: '1000', vatRate: '21', unit: 'hod' },
      ],
      totals: {
        subtotal: '2000.00',
        vatTotal: '420.00',
        total: '2420.00',
        subtotalCzk: '2000.00',
        vatTotalCzk: '420.00',
        totalCzk: '2420.00',
        totalBeforeRounding: '2420.00',
        rounding: '0.00',
        recap: [{ vatRate: '21', base: '2000.00', vat: '420.00', total: '2420.00' }],
        lines: [
          {
            base: '2000.00',
            vat: '420.00',
            total: '2420.00',
            vatRate: '21',
            vatTreatment: 'standard',
          },
        ],
      },
      payment: { method: 'bank_transfer', dueDate: '2025-03-15', variableSymbol: '20250007' },
    } as never)
    const parsed = parseIsdoc(xml)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.document).toMatchObject({
      number: '2025-0007',
      type: 'invoice',
      issueDate: '2025-03-01',
      customer: { name: 'Odběratel a.s.', ico: '12345678' },
    })
    expect(parsed.document.lines[0]).toMatchObject({
      description: 'Práce',
      quantity: '2',
      unit: 'hod',
      vatRate: '21',
    })

    const org = await seedOrg(handle, 'isdoc-org')
    const out = await clientFor(handle, principal(org)).import.file({
      format: 'isdoc',
      content: xml,
    })
    expect(out.documents.created).toBe(1)
  })

  test('rejects non-ISDOC input and credit notes', () => {
    expect(parseIsdoc('<html/>')).toMatchObject({ ok: false })
    expect(parseIsdoc('<Invoice><DocumentType>2</DocumentType><ID>X</ID></Invoice>')).toMatchObject(
      { ok: false },
    )
  })
})

describe('review hardening', () => {
  test('Fakturoid tax documents and corrections are not imported as invoices', async () => {
    const { mapInvoice } = await import('./fakturoid')
    expect(mapInvoice({ document_type: 'tax_document', number: 'D1', lines: [] })).toBeNull()
    expect(mapInvoice({ document_type: 'correction', number: 'K1', lines: [] })).toBeNull()
  })

  test('CSV rows with malformed amounts are rejected, not imported with altered values', () => {
    const { documents, problems } = invoicesFromCsv(
      'number;issue_date;description;quantity;unit_price;vat_rate\nA1;2024-01-01;ok;1;100;21\nA2;2024-01-01;bad;1;abc;21\nA3;2024-01-01;bad2;x;5;0\n',
    )
    expect(documents.map((d) => d.number)).toEqual(['A1'])
    expect(problems.map((p) => p.number).sort()).toEqual(['A2', 'A3'])
    expect(problems.find((p) => p.number === 'A2')?.message).toContain('unit price')
  })

  test('ISDOC unit price is derived with Decimal arithmetic', () => {
    const xml = `<Invoice><DocumentType>1</DocumentType><ID>X</ID><IssueDate>2025-01-01</IssueDate>
      <InvoiceLines><InvoiceLine><InvoicedQuantity>3</InvoicedQuantity><LineExtensionAmount>0.025</LineExtensionAmount>
      <ClassifiedTaxCategory><Percent>0</Percent></ClassifiedTaxCategory><Item><Description>d</Description></Item></InvoiceLine></InvoiceLines></Invoice>`
    const parsed = parseIsdoc(xml)
    if (!parsed.ok) throw new Error('parse failed')
    expect(parsed.document.lines[0]?.unitPrice.startsWith('0.00833333333333333333')).toBe(true)
  })

  test('ISDOC reverse-charge invoices keep their treatment', () => {
    const xml = `<Invoice><DocumentType>1</DocumentType><ID>R1</ID><IssueDate>2025-01-01</IssueDate>
      <InvoiceLines><InvoiceLine><InvoicedQuantity>1</InvoicedQuantity><LineExtensionAmount>100</LineExtensionAmount>
      <ClassifiedTaxCategory><Percent>0</Percent></ClassifiedTaxCategory>
      <VATNote>Daň odvede zákazník (režim přenesení daňové povinnosti, § 92a zákona o DPH)</VATNote>
      <Item><Description>d</Description></Item></InvoiceLine></InvoiceLines></Invoice>`
    const parsed = parseIsdoc(xml)
    if (!parsed.ok) throw new Error('parse failed')
    expect(parsed.document.reverseCharge).toBe(true)
  })

  test('imported proformas never carry VAT', async () => {
    const org = await seedOrg(handle, 'proforma-vat')
    const api = clientFor(handle, principal(org))
    await api.import.file({
      format: 'csv',
      kind: 'invoices',
      content:
        'number;type;issue_date;description;unit_price;vat_rate\nZ1;proforma;2024-01-01;Záloha;1000;21\n',
    })
    const [doc] = await api.documents.list({ filter: 'all' })
    expect(doc).toMatchObject({
      type: 'proforma',
      vatTotal: '0.0000',
      total: '1000.0000',
      vatMode: 'none',
    })
  })
})

describe('review hardening 2', () => {
  test('impossible calendar dates are rejected; an invalid date rejects every row of the invoice', () => {
    expect(normalizeDate('2024-02-30')).toBeNull()
    expect(normalizeDate('31. 4. 2024')).toBeNull()
    expect(normalizeDate('29. 2. 2024')).toBe('2024-02-29')
    const { documents, problems } = invoicesFromCsv(
      'number;issue_date;description;unit_price\nB1;2024-99-99;a;1\nB1;2024-01-01;b;2\n',
    )
    expect(documents).toHaveLength(0)
    expect(problems).toHaveLength(1)
  })

  test('ISDOC keeps payment method, payment-receipt type and the full domestic bank account', () => {
    const xml = `<Invoice><DocumentType>5</DocumentType><ID>P1</ID><IssueDate>2025-01-01</IssueDate>
      <InvoiceLines><InvoiceLine><InvoicedQuantity>1</InvoicedQuantity><LineExtensionAmount>100</LineExtensionAmount>
      <ClassifiedTaxCategory><Percent>21</Percent></ClassifiedTaxCategory><Item><Description>d</Description></Item></InvoiceLine></InvoiceLines>
      <PaymentMeans><Payment><PaymentMeansCode>48</PaymentMeansCode><Details><PaymentDueDate>2025-01-15</PaymentDueDate>
      <ID>123456789</ID><BankCode>0800</BankCode><Name>ČS</Name><IBAN>CZ6508000000000123456789</IBAN><BIC>GIBACZPX</BIC></Details></Payment></PaymentMeans></Invoice>`
    const parsed = parseIsdoc(xml)
    if (!parsed.ok) throw new Error('parse failed')
    expect(parsed.document).toMatchObject({
      type: 'payment_receipt',
      paymentMethod: 'card',
      bank: { accountNumber: '123456789', bankCode: '0800', bic: 'GIBACZPX' },
    })
  })

  test('foreign source rounding keeps totalCzk consistent; snapshot keeps the invoice-time customer; OSS is kept', async () => {
    const org = await seedOrg(handle, 'review2')
    const api = clientFor(handle, principal(org), { fetch: fakturoidFetch() })
    // The contact already exists under a newer name.
    await api.contacts.create({ name: 'Nová Firma GmbH (nový název)', ico: '99999999' })
    const { mapInvoice } = await import('./fakturoid')
    const row = {
      ...invoices[4],
      id: 90,
      number: '2023-0090',
      status: 'sent',
      oss: 'service',
      total: '100.5',
      lines: [
        { name: 'S', quantity: '1', unit_price: '100', vat_rate: 0, unit_price_without_vat: '100' },
      ],
    }
    const mapped = mapInvoice(row)
    expect(mapped).toMatchObject({ oss: true, bank: { accountNumber: '1234', bankCode: '2010' } })
    const { importRepo } = await import('../repositories/import')
    const out = await importRepo.run(
      handle.db,
      org,
      'u',
      'fakturoid',
      {
        contacts: [],
        documents: mapped
          ? [
              {
                ...mapped,
                customer: { ...mapped.customer, ico: '99999999', name: 'Nová Firma GmbH' },
              },
            ]
          : [],
      },
      { dryRun: false },
    )
    expect(out.documents.created).toBe(1)
    const [doc] = await handle.db
      .select()
      .from(schema.document)
      .where(eq(schema.document.organizationId, org))
    expect(doc?.total).toBe('100.5000')
    expect(doc?.totalCzk).toBe('2462.2500')
    expect(doc?.customerSnapshot).toMatchObject({ name: 'Nová Firma GmbH' })
  })
})

describe('review hardening 3', () => {
  test('a CSV line with an amount but no description rejects the invoice', () => {
    const { documents, problems } = invoicesFromCsv(
      'number;issue_date;description;unit_price\nC1;2024-01-01;ok;100\nC1;2024-01-01;;50\n',
    )
    expect(documents).toHaveLength(0)
    expect(problems[0]?.message).toContain('no description')
  })

  test('Fakturoid advances / partial payments are reflected via remaining_amount', async () => {
    const { mapInvoice } = await import('./fakturoid')
    const base = {
      document_type: 'final_invoice',
      number: 'F1',
      issued_on: '2024-03-01',
      status: 'sent',
      total: '1000.0',
      lines: [{ name: 'x', unit_price: '1000', vat_rate: 0, unit_price_without_vat: '1000' }],
    }
    const withAdvance = mapInvoice({
      ...base,
      remaining_amount: '400.0',
      paid_advances: [{ id: 1 }],
    })
    expect(withAdvance?.payments).toEqual([{ paidOn: '2024-03-01', amount: '600.00' }])
    expect(mapInvoice({ ...base, remaining_amount: '1000.0' })?.payments).toEqual([])
    const partlyPaid = mapInvoice({
      ...base,
      remaining_amount: '250.0',
      payments: [{ paid_on: '2024-03-05', amount: '500.0' }],
    })
    expect(partlyPaid?.payments).toEqual([
      { paidOn: '2024-03-05', amount: '500.0' },
      { paidOn: '2024-03-01', amount: '250.00' },
    ])
  })
})
