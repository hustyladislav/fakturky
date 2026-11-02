import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import type { DbHandle } from '@fakturky/db'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { bankRepo } from '../repositories/bank'
import { clientFor, createTestDb, seedOrg } from '../testing'

const fixture = (name: string) =>
  readFileSync(new URL(`../../../domain/test/fixtures/bank/${name}`, import.meta.url), 'utf8')

const TOKEN = 'abcdefghijklmnopqrstuvwxyz0123456789ABCD'

let handle: DbHandle
let org: string
let api: ReturnType<typeof clientFor>
let accountId: string

beforeAll(async () => {
  process.env.ENCRYPTION_KEY = randomBytes(32).toString('base64')
  handle = await createTestDb()
  org = await seedOrg(handle, 'bank-org')
  api = clientFor(handle, { userId: 'u', organizationId: org, via: 'session' })
  accountId = (await api.bankAccounts.create({ label: 'Fio', account: '2400123455/2010' })).id
})
afterAll(() => handle.close())

describe('statement import', () => {
  test('imports a Fio CSV once, re-import is a no-op, debits are not "unmatched"', async () => {
    const first = await api.bank.importStatement({
      bankAccountId: accountId,
      content: fixture('fio.csv'),
    })
    expect(first).toMatchObject({ format: 'fio-csv', imported: 4, duplicates: 0 })
    const again = await api.bank.importStatement({
      bankAccountId: accountId,
      content: fixture('fio.csv'),
    })
    expect(again).toMatchObject({ imported: 0, duplicates: 4 })

    const all = await api.bank.list({})
    expect(all.total).toBe(4)
    expect(all.counts).toEqual({ unmatched: 3, matched: 0, ignored: 0 })
    const unmatched = await api.bank.list({ status: 'unmatched' })
    expect(unmatched.items.map((t) => t.amount).sort()).toEqual(['1000.00', '12100.00', '500.00'])
    const search = await api.bank.list({ search: 'novák' })
    expect(search.items).toHaveLength(1)
  })

  test('rows without a bank id are fingerprinted; identical rows in one file stay distinct', async () => {
    const csv = 'Datum;Objem;Měna;VS\n10.02.2026;50,00;CZK;1\n10.02.2026;50,00;CZK;1\n'
    const r1 = await api.bank.importStatement({ bankAccountId: accountId, content: csv })
    expect(r1.imported).toBe(2)
    const r2 = await api.bank.importStatement({ bankAccountId: accountId, content: csv })
    expect(r2).toMatchObject({ imported: 0, duplicates: 2 })
  })

  test('a CAMT statement for another IBAN is refused', async () => {
    const other = await api.bankAccounts.create({ label: 'Other', account: '19-2000145399/0800' })
    await expect(
      api.bank.importStatement({ bankAccountId: other.id, content: fixture('camt053.xml') }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    const ok = await api.bank.importStatement({
      bankAccountId: accountId,
      content: fixture('camt053.xml'),
    })
    expect(ok).toMatchObject({ format: 'camt053', imported: 4 })
  })

  test('garbage and unknown accounts are client errors', async () => {
    await expect(
      api.bank.importStatement({ bankAccountId: accountId, content: 'hello\nworld\n' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    await expect(
      api.bank.importStatement({ bankAccountId: 'nope', content: fixture('fio.csv') }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  test('mapped generic CSV', async () => {
    const r = await api.bank.importStatement({
      bankAccountId: accountId,
      content: fixture('generic.csv'),
      mapping: { date: 'Kdy', amount: 'Kolik', counterpartyName: 'Od koho' },
    })
    expect(r).toMatchObject({ format: 'generic-csv', imported: 2 })
  })
})

describe('Fio sync', () => {
  const body = JSON.parse(fixture('fio-api.json'))
  const okFetch = async () => Response.json(body)

  test('token is stored encrypted and never returned', async () => {
    const acc = await api.bankAccounts.setFioToken({ id: accountId, token: TOKEN })
    expect(acc.fioConnected).toBe(true)
    const dump = JSON.stringify(await api.bankAccounts.list({}))
    expect(dump).not.toContain(TOKEN)
    expect(dump).not.toContain('v1.')
    const rows = await handle.db.select().from((await import('@fakturky/db')).schema.bankAccount)
    const row = rows.find((r) => r.id === accountId)
    expect(row?.fioTokenEncrypted).toBeTruthy()
    expect(row?.fioTokenEncrypted).not.toContain(TOKEN)
    const json = JSON.parse(
      await (await import('../repositories/exports')).exportsRepo.organizationJson(handle.db, org),
    )
    expect(JSON.stringify(json)).not.toContain('fioTokenEncrypted')
  })

  test('rejects malformed tokens', async () => {
    await expect(
      api.bankAccounts.setFioToken({ id: accountId, token: '../etc/passwd' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  test('syncs, is idempotent and enforces one request per 30 seconds', async () => {
    const t0 = new Date('2026-03-01T10:00:00Z')
    const urls: string[] = []
    const fetchSpy = async (url: string) => {
      urls.push(url)
      return okFetch()
    }
    const r = await bankRepo.syncFio(handle.db, org, accountId, { fetch: fetchSpy, now: t0 })
    expect(r).toMatchObject({ imported: 2, duplicates: 0, from: '2026-01-30', to: '2026-03-01' })
    expect(urls[0]).toContain(`/periods/${TOKEN}/2026-01-30/2026-03-01/transactions.json`)

    await expect(
      bankRepo.syncFio(handle.db, org, accountId, {
        fetch: fetchSpy,
        now: new Date(t0.getTime() + 10_000),
      }),
    ).rejects.toMatchObject({ code: 'TOO_MANY_REQUESTS' })
    expect(urls).toHaveLength(1)

    const later = await bankRepo.syncFio(handle.db, org, accountId, {
      fetch: fetchSpy,
      now: new Date(t0.getTime() + 31_000),
    })
    expect(later).toMatchObject({ imported: 0, duplicates: 2, from: '2026-02-26' }) // resumes 3 days before
  })

  test('a token of another account is refused and the error is recorded', async () => {
    const wrong = JSON.parse(fixture('fio-api.json'))
    wrong.accountStatement.info.iban = 'CZ6508000000192000145399'
    await expect(
      bankRepo.syncFio(handle.db, org, accountId, {
        fetch: async () => Response.json(wrong),
        now: new Date('2026-03-02T10:00:00Z'),
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    const acc = (await api.bankAccounts.list({})).find((a) => a.id === accountId)
    expect(acc?.fioLastError).toMatch(/different bank account/)
  })

  test('Fio errors surface without the token; cron sweep reports per account', async () => {
    const results = await bankRepo.syncAllFio(handle.db, {
      fetch: async () => new Response('', { status: 500 }),
      now: new Date('2026-03-03T10:00:00Z'),
    })
    expect(results).toHaveLength(1)
    expect(results[0]?.error).toMatch(/token/i)
    expect(JSON.stringify(results)).not.toContain(TOKEN)
  })

  test('disconnecting removes the token', async () => {
    const acc = await api.bankAccounts.setFioToken({ id: accountId, token: null })
    expect(acc.fioConnected).toBe(false)
    await expect(api.bank.syncFio({ id: accountId })).rejects.toMatchObject({
      code: 'PRECONDITION_FAILED',
    })
  })
})
