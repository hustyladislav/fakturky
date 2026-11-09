import { type DbHandle, schema } from '@fakturky/db'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { clientFor, createTestDb, seedOrg } from '../testing'

let handle: DbHandle
beforeAll(async () => {
  handle = await createTestDb()
})
afterAll(() => handle.close())

async function seed(slug: string) {
  const org = await seedOrg(handle, slug)
  await handle.db.insert(schema.businessProfile).values({
    organizationId: org,
    legalName: 'Dodavatel s.r.o.',
    ico: '27082440',
    vatStatus: 'non_payer',
  })
  const api = clientFor(handle, { userId: 'u', organizationId: org, via: 'session' as const })
  const c = await api.contacts.create({ name: 'Zeta s.r.o.' })
  const mk = async (unitPrice: string, issueDate: string, taxableDate?: string) => {
    const d = await api.documents.createDraft({
      contactId: c.id,
      issueDate,
      dueDate: '2027-01-31',
      taxableDate,
      lines: [{ description: 'Práce', quantity: '1', unitPrice }],
    })
    return api.documents.issue({ id: d.id })
  }
  return { org, api, c, mk }
}

const OCT = { from: '2026-10-01', to: '2026-10-31' }

test('period ends are inclusive and the DUZP wins over the issue date', async () => {
  const { api, mk } = await seed('period-bounds')
  const first = await mk('100', '2026-10-01')
  const last = await mk('200', '2026-10-31')
  const before = await mk('400', '2026-09-30')
  const after = await mk('800', '2026-11-01')
  // Issued in October, taxable supply in September: belongs to September.
  const earlierDuzp = await mk('1600', '2026-10-15', '2026-09-28')
  // Issued in September, taxable supply in October: belongs to October.
  const laterDuzp = await mk('3200', '2026-09-29', '2026-10-02')

  const ids = (await api.documents.list({ ...OCT })).map((d) => d.id)
  expect(ids.sort()).toEqual([first.id, last.id, laterDuzp.id].sort())
  expect(ids).not.toContain(before.id)
  expect(ids).not.toContain(after.id)
  expect(ids).not.toContain(earlierDuzp.id)

  const stats = await api.documents.stats({ ...OCT })
  expect(stats.all).toEqual({ count: 3, sum: '3500.00' })

  // Open-ended periods
  expect((await api.documents.list({ from: '2026-10-31' })).map((d) => d.id).sort()).toEqual(
    [last.id, after.id].sort(),
  )
  expect((await api.documents.list({ to: '2026-09-30' })).map((d) => d.id).sort()).toEqual(
    [before.id, earlierDuzp.id].sort(),
  )
  expect(await api.documents.list({})).toHaveLength(6)
  expect((await api.documents.stats({})).all.count).toBe(6)
})

test('a period drops drafts', async () => {
  const { api, c, mk } = await seed('period-drafts')
  const issued = await mk('100', '2026-10-10')
  const draft = await api.documents.createDraft({
    contactId: c.id,
    issueDate: '2026-10-12',
    dueDate: '2026-10-30',
    lines: [{ description: 'Koncept', quantity: '1', unitPrice: '50' }],
  })

  expect((await api.documents.list({})).map((d) => d.id)).toContain(draft.id)
  expect((await api.documents.list({ ...OCT })).map((d) => d.id)).toEqual([issued.id])
  const stats = await api.documents.stats({ ...OCT })
  expect(stats.draft).toEqual({ count: 0, sum: '0.00' })
  expect(stats.all.count).toBe(1)
})

test('the CSV export follows the same period, type and file name', async () => {
  const { api, c, mk } = await seed('period-export')
  const inOct = await mk('100', '2026-10-10')
  const outside = await mk('200', '2026-11-10')
  await api.documents.createDraft({
    contactId: c.id,
    issueDate: '2026-10-12',
    dueDate: '2026-10-30',
    lines: [{ description: 'Koncept', quantity: '1', unitPrice: '50' }],
  })

  const all = await api.exports.documents({})
  expect(all.filename).toBe('doklady.csv')
  expect(all.csv).toContain(inOct.number)
  expect(all.csv).toContain(outside.number)

  const oct = await api.exports.documents({ ...OCT })
  expect(oct.filename).toBe('doklady-2026-10.csv')
  expect(oct.csv).toContain(inOct.number)
  expect(oct.csv).not.toContain(outside.number)
  // header + exactly one document, no draft
  expect(oct.csv.trim().split('\n')).toHaveLength(2)

  const none = await api.exports.documents({ ...OCT, type: 'proforma' })
  expect(none.csv.trim().split('\n')).toHaveLength(1)
  expect((await api.exports.documents({ from: '2026-10-01', to: '2026-12-31' })).filename).toBe(
    'doklady-2026-10-01_2026-12-31.csv',
  )
})

test('an impossible date is rejected at the boundary', async () => {
  const { api } = await seed('period-invalid')
  await expect(api.documents.list({ from: '2026-02-31' })).rejects.toThrow()
  await expect(api.exports.documents({ to: 'yesterday' })).rejects.toThrow()
})
