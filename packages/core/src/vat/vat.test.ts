import { type DbHandle, schema } from '@fakturky/db'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { clientFor, createTestDb, seedOrg } from '../testing'

let handle: DbHandle
beforeAll(async () => {
  handle = await createTestDb()
})
afterAll(() => handle.close())

const principal = (organizationId: string) => ({
  userId: 'u',
  organizationId,
  via: 'session' as const,
})

const ADDR = { street: 'Hlavní 1', city: 'Brno', zip: '60200', country: 'CZ' }
const March = { year: 2026, month: 3 }

async function payerOrg(slug: string, withFiling = true) {
  const org = await seedOrg(handle, slug)
  await handle.db.insert(schema.businessProfile).values({
    organizationId: org,
    legalName: 'Jan Novák',
    ico: '12345678',
    dic: 'CZ7001011234',
    vatStatus: 'payer',
    address: { street: 'Dlouhá 12/3', city: 'Praha', zip: '11000', country: 'CZ' },
    ...(withFiling
      ? {
          vatFiling: {
            taxOfficeCode: '451',
            period: 'monthly' as const,
            subjectType: 'F' as const,
          },
        }
      : {}),
  })
  return { org, api: clientFor(handle, principal(org)) }
}

async function issue(
  api: ReturnType<typeof clientFor>,
  contactId: string,
  taxableDate: string,
  lines: Array<Record<string, unknown>>,
  extra: Record<string, unknown> = {},
) {
  const draft = await api.documents.createDraft({
    contactId,
    issueDate: taxableDate,
    taxableDate,
    lines: lines as never,
    ...extra,
  })
  return api.documents.issue({ id: draft.id })
}

test('report: aggregates a payer’s issued documents of the period into DPH / KH / SH rows', async () => {
  const { api } = await payerOrg('vat-a')
  const cz = await api.contacts.create({ address: ADDR, name: 'Alfa s.r.o.', dic: 'CZ12345678' })
  const consumer = await api.contacts.create({ address: ADDR, name: 'Jan Spotřebitel' })
  const de = await api.contacts.create({
    address: ADDR,
    name: 'Berlin GmbH',
    country: 'DE',
    icDph: 'DE123456789',
  })

  // 12 100 incl. VAT → KH A.4
  await issue(api, cz.id, '2026-03-05', [
    { description: 'Vývoj', quantity: '1', unitPrice: '10000', vatRate: '21' },
  ])
  // 1 210 incl. VAT, consumer → KH A.5
  await issue(api, consumer.id, '2026-03-10', [
    { description: 'Konzultace', quantity: '1', unitPrice: '1000', vatRate: '21' },
  ])
  // EU service in EUR 40 × 25.01
  await issue(
    api,
    de.id,
    '2026-03-20',
    [{ description: 'Service', quantity: '1', unitPrice: '40', vatTreatment: 'eu_reverse_charge' }],
    { currency: 'EUR', exchangeRate: '25.01' },
  )
  // outside the period
  await issue(api, cz.id, '2026-04-02', [
    { description: 'Duben', quantity: '1', unitPrice: '99999', vatRate: '21' },
  ])
  // a draft is never reported
  await api.documents.createDraft({
    contactId: cz.id,
    issueDate: '2026-03-15',
    taxableDate: '2026-03-15',
    lines: [{ description: 'Koncept', quantity: '1', unitPrice: '5000', vatRate: '21' }],
  })

  const r = await api.vat.report(March)
  expect(r.documentCount).toBe(3)
  expect(r.range).toEqual({ from: '2026-03-01', to: '2026-03-31' })
  expect(r.dp3['1']).toEqual({ base: '11000.00', vat: '2310.00' })
  expect(r.dp3['21']?.base).toBe('1000.40')
  expect(r.kh.a4).toHaveLength(1)
  expect(r.kh.a4[0]).toMatchObject({ dicOdb: '12345678', base21: '10000.00', vat21: '2100.00' })
  expect(r.kh.a5).toMatchObject({ base21: '1000.00', vat21: '210.00' })
  expect(r.sh).toEqual([
    {
      country: 'DE',
      vatNumber: '123456789',
      code: '3',
      count: 1,
      valueCzk: '1000.40',
      valueWhole: '1001',
    },
  ])
  expect(r.dp3Figures).toMatchObject({ r62: '2310', r64: '2310' })
  expect(r.filing).toEqual({ ready: true, missing: [] })
  expect(r.disclaimer).toContain('nenahrazuje daňového poradce')
  // drill-down data
  const rows = r.contributions.filter((c) => c.rowKey === 'dp3.1')
  expect(rows).toHaveLength(2)
  for (const c of rows) expect(r.documents[c.documentId]?.customerName).toBeTruthy()
})

test('report: manual input VAT flows into the summary rows', async () => {
  const { api } = await payerOrg('vat-b')
  const c = await api.contacts.create({ address: ADDR, name: 'Alfa', dic: 'CZ12345678' })
  await issue(api, c.id, '2026-03-05', [
    { description: 'X', quantity: '1', unitPrice: '10000', vatRate: '21' },
  ])
  const r = await api.vat.report({
    ...March,
    inputVat: { r40Base: '20000', r40Deduction: '4200' },
  })
  expect(r.dp3Figures).toMatchObject({ r62: '2100', r63: '4200', r64: '0', r65: '2100' })
})

test('report: a quarter covers three months', async () => {
  const { api } = await payerOrg('vat-q')
  const c = await api.contacts.create({ address: ADDR, name: 'Alfa', dic: 'CZ12345678' })
  for (const d of ['2026-01-05', '2026-02-05', '2026-03-05', '2026-04-05']) {
    await issue(api, c.id, d, [
      { description: 'X', quantity: '1', unitPrice: '100', vatRate: '21' },
    ])
  }
  const r = await api.vat.report({ year: 2026, quarter: 1 })
  expect(r.documentCount).toBe(3)
  expect(r.range).toEqual({ from: '2026-01-01', to: '2026-03-31' })
})

test('report: month and quarter are mutually exclusive', async () => {
  const { api } = await payerOrg('vat-x')
  await expect(api.vat.report({ year: 2026, month: 3, quarter: 1 })).rejects.toThrow()
  await expect(api.vat.report({ year: 2026 })).rejects.toThrow()
})

test('only VAT payers get reports', async () => {
  const org = await seedOrg(handle, 'vat-np')
  await handle.db
    .insert(schema.businessProfile)
    .values({ organizationId: org, legalName: 'Neplátce', vatStatus: 'non_payer' })
  const api = clientFor(handle, principal(org))
  await expect(api.vat.report(March)).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' })
  await expect(api.vat.exportXml({ ...March, kind: 'kh' })).rejects.toMatchObject({
    code: 'PRECONDITION_FAILED',
  })
})

test('exportXml: generates the three files; refuses without filing details', async () => {
  const { api } = await payerOrg('vat-e')
  const cz = await api.contacts.create({ address: ADDR, name: 'Alfa s.r.o.', dic: 'CZ12345678' })
  await issue(api, cz.id, '2026-03-05', [
    { description: 'Vývoj', quantity: '1', unitPrice: '10000', vatRate: '21' },
  ])
  const kh = await api.vat.exportXml({ ...March, kind: 'kh' })
  expect(kh.filename).toBe('kontrolni-hlaseni-2026-03.xml')
  expect(kh.xml).toContain('<DPHKH1 verzePis=')
  expect(kh.xml).toContain('dic_odb="12345678"')
  expect(kh.xml).toContain('dic="7001011234"')
  expect(kh.xml).toContain('c_ufo="451"')
  const dp3 = await api.vat.exportXml({ year: 2026, quarter: 1, kind: 'dp3' })
  expect(dp3.filename).toBe('priznani-dph-2026-Q1.xml')
  expect(dp3.xml).toContain('obrat23="10000"')
  const sh = await api.vat.exportXml({ ...March, kind: 'sh' })
  expect(sh.xml).toContain('<DPHSHV')

  const bare = await payerOrg('vat-nofiling', false)
  await expect(bare.api.vat.exportXml({ ...March, kind: 'kh' })).rejects.toMatchObject({
    code: 'PRECONDITION_FAILED',
  })
  // the preview still works and says what is missing
  const preview = await bare.api.vat.report(March)
  expect(preview.filing).toEqual({ ready: false, missing: ['vatFiling'] })
})

test('quarterly legal entity gets a KH advisory', async () => {
  const org = await seedOrg(handle, 'vat-p')
  await handle.db.insert(schema.businessProfile).values({
    organizationId: org,
    legalName: 'Firma s.r.o.',
    dic: 'CZ25596641',
    vatStatus: 'payer',
    vatFiling: { taxOfficeCode: '461', period: 'quarterly', subjectType: 'P' },
  })
  const r = await clientFor(handle, principal(org)).vat.report({ year: 2026, quarter: 1 })
  expect(r.advisories).toContain('kh_monthly_for_legal_entity')
  expect(r.filingPeriod).toBe('quarterly')
})

test('tenant isolation: another payer never sees these documents in a report or export', async () => {
  const a = await payerOrg('vat-iso-a')
  const b = await payerOrg('vat-iso-b')
  const c = await a.api.contacts.create({
    address: ADDR,
    name: 'TAJNY-ODBERATEL',
    dic: 'CZ12345678',
  })
  await issue(a.api, c.id, '2026-03-05', [
    { description: 'X', quantity: '1', unitPrice: '10000', vatRate: '21' },
  ])
  const mine = await a.api.vat.report(March)
  expect(mine.documentCount).toBe(1)
  const theirs = await b.api.vat.report(March)
  expect(theirs.documentCount).toBe(0)
  expect(JSON.stringify(theirs)).not.toContain('TAJNY')
  const xml = await b.api.vat.exportXml({ ...March, kind: 'kh' })
  expect(xml.xml).not.toContain('VetaA4')
})
