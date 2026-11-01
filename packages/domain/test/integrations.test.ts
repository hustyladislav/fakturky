import { describe, expect, it } from 'vitest'
import { lookupByIco, normalizeAresSubject, searchByName } from '../src/integrations/ares.ts'
import { fetchCnbDaily, getRate, parseCnbDaily } from '../src/integrations/cnb.ts'
import { IntegrationError } from '../src/integrations/fetch.ts'
import { checkVatId } from '../src/integrations/vies.ts'
import { fixture, mockFetch } from './helpers.ts'

describe('ARES', () => {
  it('looks up by IČO (recorded fixture)', async () => {
    const { fetch, calls } = mockFetch(() => ({ body: fixture('ares-27082440.json') }))
    const s = await lookupByIco('27082440', { fetch })
    expect(s).toEqual({
      ico: '27082440',
      name: 'Alza.cz a.s.',
      dic: 'CZ27082440',
      address: { street: 'Jankovcova 1522/53', city: 'Praha', zip: '17000', country: 'CZ' },
      vatPayer: true,
      legalForm: '121',
    })
    expect(calls[0]?.url).toBe('https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/27082440')
  })

  it('pads short IČO, returns null on 404, throws on bad checksum/server error', async () => {
    const nf = mockFetch(() => ({ status: 404, body: '{"kod":"NENALEZENO"}' }))
    expect(await lookupByIco('19', { fetch: nf.fetch })).toBeNull()
    expect(nf.calls[0]?.url.endsWith('/00000019')).toBe(true)
    await expect(lookupByIco('12345678', { fetch: nf.fetch })).rejects.toMatchObject({ code: 'invalid_input' })
    const err = mockFetch(() => ({ status: 500, body: '' }))
    await expect(lookupByIco('27082440', { fetch: err.fetch })).rejects.toMatchObject({ code: 'http_error', status: 500 })
    const down = mockFetch(() => new Error('boom'))
    await expect(lookupByIco('27082440', { fetch: down.fetch })).rejects.toBeInstanceOf(IntegrationError)
  })

  it('searches by name (recorded fixture)', async () => {
    const { fetch, calls } = mockFetch(() => ({ body: fixture('ares-search.json') }))
    const hits = await searchByName(' Seznam.cz ', { fetch, limit: 3 })
    expect(hits.map((h) => h.ico)).toEqual(['01673408', '02238586', '06387233'])
    expect(hits[0]?.name).toBe('Seznam.cz datová centra, s.r.o.')
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({ obchodniJmeno: 'Seznam.cz', start: 0, pocet: 3 })
    expect(calls[0]?.init?.method).toBe('POST')
  })

  it('search edge cases', async () => {
    const f404 = mockFetch(() => ({ status: 404, body: '' }))
    expect(await searchByName('zzzz', { fetch: f404.fetch })).toEqual([])
    const empty = mockFetch(() => ({ body: '{}' }))
    expect(await searchByName('zzzz', { fetch: empty.fetch })).toEqual([])
    await expect(searchByName('a', { fetch: empty.fetch })).rejects.toMatchObject({ code: 'invalid_input' })
    const bad = mockFetch(() => ({ status: 400, body: '' }))
    await expect(searchByName('abcd', { fetch: bad.fetch })).rejects.toMatchObject({ code: 'http_error' })
  })

  it('normalizes sparse records', () => {
    expect(normalizeAresSubject({ ico: '1', obchodniJmeno: 'X', sidlo: { nazevObce: 'Brno', nazevCastiObce: 'Židenice', cisloDomovni: 5, psc: 6100, cisloOrientacni: 2, cisloOrientacniPismeno: 'a' } })).toEqual({
      ico: '1', name: 'X', dic: null, address: { street: 'Židenice 5/2a', city: 'Brno', zip: '06100', country: 'CZ' }, vatPayer: false, legalForm: null,
    })
    expect(normalizeAresSubject({}).address).toEqual({ street: '', city: '', zip: '', country: 'CZ' })
    expect(normalizeAresSubject({ dic: 'CZ1', seznamRegistraci: { stavZdrojeDph: 'NEAKTIVNI' } }).vatPayer).toBe(false)
  })
})

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

describe('VIES', () => {
  it('checks a valid number (recorded fixture)', async () => {
    const { fetch, calls } = mockFetch(() => ({ body: fixture('vies-cz.json') }))
    const r = await checkVatId('CZ 26168685', { fetch })
    expect(r).toMatchObject({ valid: true, countryCode: 'CZ', vatNumber: '26168685', name: 'Seznam.cz, a.s.' })
    expect(r.address).toContain('Radlická')
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({ countryCode: 'CZ', vatNumber: '26168685' })
  })

  it('maps placeholders to null and handles invalid', async () => {
    const { fetch } = mockFetch(() => ({ body: JSON.stringify({ valid: false, name: '---', address: '---', requestDate: 'x' }) }))
    expect(await checkVatId('DE123456789', { fetch })).toMatchObject({ valid: false, name: null, address: null })
  })

  it('errors', async () => {
    const { fetch } = mockFetch(() => ({ status: 500, body: '' }))
    await expect(checkVatId('CZ26168685', { fetch })).rejects.toMatchObject({ code: 'http_error' })
    await expect(checkVatId('US123', { fetch })).rejects.toMatchObject({ code: 'invalid_input' })
    const odd = mockFetch(() => ({ body: '{"actionSucceed":false}' }))
    await expect(checkVatId('CZ26168685', { fetch: odd.fetch })).rejects.toMatchObject({ code: 'bad_response' })
  })
})
