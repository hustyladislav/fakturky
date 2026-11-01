import { describe, expect, it } from 'vitest'
import { fetchCnbDaily, getRate, parseCnbDaily } from '../src/integrations/cnb.ts'
import { IntegrationError } from '../src/integrations/fetch.ts'
import { fixture, mockFetch } from './helpers.ts'

describe('ČNB', () => {
  const friday = fixture('cnb-2026-10-30.txt')

  it('parses the daily file', () => {
    const d = parseCnbDaily(friday)
    expect(d.date).toBe('2026-10-30')
    expect(d.serial).toBe(209)
    expect(d.rates.USD).toMatchObject({ amount: 1, rate: '21.814', perUnit: '21.814' })
    expect(d.rates.THB).toMatchObject({ amount: 100, rate: '64.672', perUnit: '0.64672' })
    expect(Object.keys(d.rates).length).toBeGreaterThan(20)
  })

  it('rejects malformed input', () => {
    expect(() => parseCnbDaily('garbage')).toThrow(IntegrationError)
    expect(() => parseCnbDaily('30.10.2026 #1\nzemě|měna|množství|kód|kurz\nUSA|dolar|1')).toThrow(/Malformed/)
  })

  it('weekend request returns the Friday publication (recorded)', async () => {
    const { fetch, calls } = mockFetch(() => ({ body: fixture('cnb-weekend-request-2026-10-31.txt') }))
    const r = await getRate('usd', '2026-10-31', { fetch })
    expect(r).toEqual({ currency: 'USD', rate: '21.814', date: '2026-10-30' })
    expect(calls).toHaveLength(1)
    expect(calls[0]?.url).toContain('date=31.10.2026')
  })

  it('CZK short-circuits; unknown currency throws', async () => {
    const { fetch, calls } = mockFetch(() => ({ body: friday }))
    expect(await getRate('CZK', '2026-10-30', { fetch })).toEqual({ currency: 'CZK', rate: '1', date: '2026-10-30' })
    expect(calls).toHaveLength(0)
    await expect(getRate('XXX', '2026-10-30', { fetch })).rejects.toMatchObject({ code: 'invalid_input' })
  })

  it('steps back when a day is unavailable', async () => {
    let n = 0
    const { fetch, calls } = mockFetch(() => (n++ < 2 ? { status: 500, body: '' } : { body: friday }))
    const r = await getRate('GBP', '2026-11-01', { fetch })
    expect(r.rate).toBe('29.229')
    expect(calls.map((c) => c.url.split('date=')[1])).toEqual(['01.11.2026', '31.10.2026', '30.10.2026'])
  })

  it('gives up after a week', async () => {
    const { fetch, calls } = mockFetch(() => ({ status: 503, body: '' }))
    await expect(getRate('USD', '2026-11-01', { fetch })).rejects.toBeInstanceOf(IntegrationError)
    expect(calls).toHaveLength(7)
  })

  it('fetchCnbDaily surfaces http errors', async () => {
    const { fetch } = mockFetch(() => ({ status: 404, body: '' }))
    await expect(fetchCnbDaily('2026-10-30', { fetch })).rejects.toMatchObject({ status: 404 })
  })
})
