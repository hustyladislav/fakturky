import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { fetchFioTransactions, parseFioJson } from '../src/bank/index.ts'
import { IntegrationError } from '../src/integrations/fetch.ts'

const body = JSON.parse(
  readFileSync(new URL('./fixtures/bank/fio-api.json', import.meta.url), 'utf8'),
)
const TOKEN = 'abcdefghijklmnopqrstuvwxyz0123456789ABCD'

describe('Fio API', () => {
  test('maps the JSON columns', () => {
    const s = parseFioJson(body)
    expect(s.info).toMatchObject({ iban: 'CZ8720100000002400123455', accountId: '2400123455' })
    expect(s.transactions).toEqual([
      {
        bookedOn: '2026-01-05',
        amount: '12100.00',
        currency: 'CZK',
        variableSymbol: '20260001',
        constantSymbol: '308',
        specificSymbol: null,
        counterpartyAccount: '1234567890/0800',
        counterpartyName: 'Novák Jan s.r.o.',
        message: 'Platba faktury',
        externalId: '11111111',
      },
      {
        bookedOn: '2026-01-07',
        amount: '-350.50',
        currency: 'CZK',
        variableSymbol: null,
        constantSymbol: null,
        specificSymbol: null,
        counterpartyAccount: null,
        counterpartyName: 'Nákup: Albert',
        message: 'Nákup: Albert',
        externalId: '11111112',
      },
    ])
  })

  test('requests the period URL and never leaks the token in errors', async () => {
    const calls: string[] = []
    const ok = await fetchFioTransactions(TOKEN, '2026-01-01', '2026-01-31', {
      fetch: async (url) => {
        calls.push(url)
        return Response.json(body)
      },
    })
    expect(calls).toEqual([
      `https://fioapi.fio.cz/v1/rest/periods/${TOKEN}/2026-01-01/2026-01-31/transactions.json`,
    ])
    expect(ok.transactions).toHaveLength(2)

    for (const status of [409, 500, 422, 503]) {
      const err = await fetchFioTransactions(TOKEN, '2026-01-01', '2026-01-31', {
        fetch: async () => new Response('', { status }),
      }).catch((e) => e)
      expect(err).toBeInstanceOf(IntegrationError)
      expect(err.status).toBe(status)
      expect(err.message).not.toContain(TOKEN)
    }
    const failed = await fetchFioTransactions(TOKEN, '2026-01-01', '2026-01-31', {
      fetch: async () => {
        throw new Error(`boom ${TOKEN}`)
      },
    }).catch((e) => e)
    expect(failed).toBeInstanceOf(IntegrationError)
    expect(failed.message).not.toContain(TOKEN)
  })

  test('rejects malformed tokens before any request', async () => {
    let called = false
    await expect(
      fetchFioTransactions('../x', '2026-01-01', '2026-01-02', {
        fetch: async () => {
          called = true
          return Response.json(body)
        },
      }),
    ).rejects.toBeInstanceOf(IntegrationError)
    expect(called).toBe(false)
  })
})
