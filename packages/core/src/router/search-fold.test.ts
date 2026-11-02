import { type DbHandle, schema } from '@fakturky/db'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { foldText } from '../repositories/fold'
import { clientFor, createTestDb, seedOrg } from '../testing'

let handle: DbHandle
let org: string
const api = () => clientFor(handle, { userId: 'u', organizationId: org, via: 'session' })

beforeAll(async () => {
  handle = await createTestDb()
  org = await seedOrg(handle, 'fold')
  await handle.db.insert(schema.businessProfile).values({
    organizationId: org,
    legalName: 'Dodavatel s.r.o.',
    ico: '27082440',
    vatStatus: 'non_payer',
  })
  const a = api()
  const lipa = await a.contacts.create({ name: 'Studio Lípa s.r.o.', ico: '11223344' })
  const other = await a.contacts.create({ name: 'Žluťoučký kůň a.s.', ico: '55667788' })
  const big = await a.documents.createDraft({
    contactId: lipa.id,
    lines: [{ description: 'Konzultace', quantity: '1', unitPrice: '26015', vatRate: '0' }],
  })
  await a.documents.issue({ id: big.id })
  const small = await a.documents.createDraft({
    contactId: other.id,
    lines: [{ description: 'Práce', quantity: '1', unitPrice: '500', vatRate: '0' }],
  })
  await a.documents.issue({ id: small.id })
})
afterAll(() => handle.close())

describe('foldText', () => {
  test('lowercases and strips diacritics', () => {
    expect(foldText('Žluťoučký KŮŇ Łódź')).toBe('zlutoucky kun lodz')
  })
})

describe('diacritics- and case-insensitive search', () => {
  test('documents: "lipa" finds "Studio Lípa", in any case', async () => {
    for (const q of ['lipa', 'LÍPA', 'Lípa', 'studio lipa', 'lipa studio']) {
      const rows = await api().documents.list({ search: q })
      expect(
        rows.map((r) => r.customerName),
        q,
      ).toEqual(['Studio Lípa s.r.o.'])
    }
  })

  test('documents: Czech query matches ASCII-folded name', async () => {
    expect(await api().documents.list({ search: 'žlutoucky kun' })).toHaveLength(1)
    expect(await api().documents.list({ search: 'zlutoucky' })).toHaveLength(1)
  })

  test('documents: matches number, variable symbol and IČO', async () => {
    const all = await api().documents.list({})
    const d = all.find((r) => r.customerName === 'Studio Lípa s.r.o.')
    expect(d?.number).toBeTruthy()
    expect(await api().documents.list({ search: d?.number ?? '' })).toHaveLength(1)
    expect(await api().documents.list({ search: d?.variableSymbol ?? '' })).toHaveLength(1)
    expect(await api().documents.list({ search: '11223344' })).toHaveLength(1)
  })

  test('documents: matches the amount with or without thousands separator', async () => {
    for (const q of ['26015', '26 015', '26 015', '26015,00']) {
      const rows = await api().documents.list({ search: q })
      expect(
        rows.map((r) => r.customerName),
        q,
      ).toEqual(['Studio Lípa s.r.o.'])
    }
  })

  test('documents: IČO is the one printed on the issued document, not the contact today', async () => {
    const a = api()
    const c = await a.contacts.create({ name: 'Přeznačená a.s.', ico: '99887766' })
    const d = await a.documents.createDraft({
      contactId: c.id,
      lines: [{ description: 'X', quantity: '1', unitPrice: '7', vatRate: '0' }],
    })
    await a.documents.issue({ id: d.id })
    await a.contacts.update({ id: c.id, patch: { ico: '11110000' } })
    expect(await a.documents.list({ search: '99887766' })).toHaveLength(1)
    expect(await a.documents.list({ search: '11110000' })).toHaveLength(0)
  })

  test('documents: a paid row exposes the recorded payment day', async () => {
    const a = api()
    const c = await a.contacts.create({ name: 'Zaplatil Pozdě' })
    const d = await a.documents.createDraft({
      contactId: c.id,
      lines: [{ description: 'X', quantity: '1', unitPrice: '9', vatRate: '0' }],
    })
    await a.documents.issue({ id: d.id })
    await a.documents.markPaid({ id: d.id, paidOn: '2026-01-15' })
    const [row] = await a.documents.list({ search: 'Zaplatil Pozdě' })
    expect(row?.displayStatus).toBe('paid')
    expect(row?.paidOn).toBe('2026-01-15')
  })

  test('documents: LIKE wildcards are literal and stats follow the same search', async () => {
    expect(await api().documents.list({ search: '%' })).toHaveLength(0)
    expect((await api().documents.stats({ search: 'lipa' })).all.count).toBe(1)
  })

  test('contacts: diacritics-insensitive on name', async () => {
    expect((await api().contacts.list({ search: 'lipa' })).map((c) => c.name)).toEqual([
      'Studio Lípa s.r.o.',
    ])
    expect(await api().contacts.list({ search: 'ZLUTOUCKY' })).toHaveLength(1)
    expect(await api().contacts.list({ search: '5566' })).toHaveLength(1)
  })
})
