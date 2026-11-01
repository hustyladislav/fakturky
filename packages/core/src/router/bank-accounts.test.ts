import type { DbHandle } from '@fakturky/db'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { clientFor, createTestDb, seedOrg } from '../testing'

let handle: DbHandle
let orgA: string
let orgB: string
const principal = (organizationId: string) => ({
  userId: 'user-1',
  organizationId,
  via: 'session' as const,
})

beforeAll(async () => {
  handle = await createTestDb()
  orgA = await seedOrg(handle, 'ba-a')
  orgB = await seedOrg(handle, 'ba-b')
})
afterAll(() => handle.close())

describe('bank accounts', () => {
  test('Czech account is converted to IBAN + BIC', async () => {
    const api = clientFor(handle, principal(orgA))
    const a = await api.bankAccounts.create({ label: 'Hlavní', account: '19-2000145399/0800' })
    expect(a.iban).toBe('CZ6508000000192000145399')
    expect(a.bic).toBe('GIBACZPX')
    expect(a.bankCode).toBe('0800')
    expect(a.isDefault).toBe(true)
    expect(a.defaultForCurrency).toBe(true)
  })

  test('accepts a foreign IBAN and rejects garbage', async () => {
    const api = clientFor(handle, principal(orgA))
    const r = await api.bankAccounts.create({
      label: 'Revolut',
      currency: 'eur',
      account: 'LT12 1000 0111 0100 1000',
      bic: 'revolt21',
    })
    expect(r).toMatchObject({ iban: 'LT121000011101001000', bic: 'REVOLT21', currency: 'EUR' })
    expect(r.defaultForCurrency).toBe(true)
    expect(r.isDefault).toBe(false)
    await expect(
      api.bankAccounts.create({ label: 'Bad', account: '124/0800' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    await expect(api.bankAccounts.create({ label: 'Bad', account: 'XX00' })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    })
  })

  test('default per currency and archive promotion', async () => {
    const api = clientFor(handle, principal(orgB))
    const a = await api.bankAccounts.create({ label: 'A', account: '19-2000145399/0800' })
    const second = await api.bankAccounts.create({ label: 'B', account: '123/0800' })
    expect(second.defaultForCurrency).toBe(false)
    const set = await api.bankAccounts.setDefault({ id: second.id })
    expect(set.defaultForCurrency).toBe(true)
    const list = await api.bankAccounts.list({})
    expect(list.find((x) => x.id === a.id)?.defaultForCurrency).toBe(false)
    await api.bankAccounts.delete({ id: second.id })
    const after = await api.bankAccounts.list({})
    expect(after).toHaveLength(1)
    expect(after[0]?.defaultForCurrency).toBe(true)
  })

  test('tenant isolation', async () => {
    const a = clientFor(handle, principal(orgA))
    const b = clientFor(handle, principal(orgB))
    const mine = (await a.bankAccounts.list({}))[0]
    if (!mine) throw new Error('missing')
    await expect(
      b.bankAccounts.update({ id: mine.id, patch: { label: 'x' } }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(b.bankAccounts.setDefault({ id: mine.id })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
    await expect(b.bankAccounts.delete({ id: mine.id })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
    expect((await b.bankAccounts.list({})).some((x) => x.id === mine.id)).toBe(false)
  })
})
