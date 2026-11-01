import { describe, expect, it } from 'vitest'
import { lookupByIco, normalizeAresSubject } from '../src/integrations/ares.ts'
import { IntegrationError } from '../src/integrations/fetch.ts'
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

  it('normalizes sparse records', () => {
    expect(normalizeAresSubject({ ico: '1', obchodniJmeno: 'X', sidlo: { nazevObce: 'Brno', nazevCastiObce: 'Židenice', cisloDomovni: 5, psc: 6100, cisloOrientacni: 2, cisloOrientacniPismeno: 'a' } })).toEqual({
      ico: '1', name: 'X', dic: null, address: { street: 'Židenice 5/2a', city: 'Brno', zip: '06100', country: 'CZ' }, vatPayer: false, legalForm: null,
    })
    expect(normalizeAresSubject({}).address).toEqual({ street: '', city: '', zip: '', country: 'CZ' })
    expect(normalizeAresSubject({ dic: 'CZ1', seznamRegistraci: { stavZdrojeDph: 'NEAKTIVNI' } }).vatPayer).toBe(false)
  })
})
