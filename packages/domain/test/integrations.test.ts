import { describe, expect, it } from 'vitest'
import { lookupByIco, normalizeAresSubject, registryNoteFromVr } from '../src/integrations/ares.ts'
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
      registryNote: null,
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
      ico: '1', name: 'X', dic: null, address: { street: 'Židenice 5/2a', city: 'Brno', zip: '06100', country: 'CZ' }, vatPayer: false, legalForm: null, registryNote: null,
    })
    expect(normalizeAresSubject({}).address).toEqual({ street: '', city: '', zip: '', country: 'CZ' })
    expect(normalizeAresSubject({ dic: 'CZ1', seznamRegistraci: { stavZdrojeDph: 'NEAKTIVNI' } }).vatPayer).toBe(false)
  })

  it('prefills the registry note: živnostenský rejstřík for sole traders, spisová značka from VR for companies', async () => {
    expect(normalizeAresSubject({ pravniForma: '101' }).registryNote).toBe('Fyzická osoba zapsaná v živnostenském rejstříku.')
    const vr = { zaznamy: [{ rejstrik: 'OR', primarniZaznam: true, spisovaZnacka: [{ datumVymazu: '2020-01-01', soud: 'KSBR', oddil: 'C', vlozka: 1 }, { soud: 'MSPH', oddil: 'B', vlozka: 8573 }] }] }
    expect(registryNoteFromVr(vr)).toBe('Zapsána v obchodním rejstříku vedeném Městským soudem v Praze, oddíl B, vložka 8573.')
    expect(registryNoteFromVr({ zaznamy: [{ rejstrik: 'SR', spisovaZnacka: [{ soud: 'MSPH', oddil: 'L', vlozka: 1 }] }] })).toBeNull()
    const m = mockFetch((url) => (url.includes('-vr/') ? { body: JSON.stringify(vr) } : { body: JSON.stringify({ ico: '27082440', seznamRegistraci: { stavZdrojeVr: 'AKTIVNI' } }) }))
    const s = await lookupByIco('27082440', { fetch: m.fetch, withRegistryNote: true })
    expect(s?.registryNote).toContain('vložka 8573')
    // VR down: the lookup still succeeds, without a note
    const down = mockFetch((url) => (url.includes('-vr/') ? { status: 500, body: '' } : { body: JSON.stringify({ ico: '27082440', seznamRegistraci: { stavZdrojeVr: 'AKTIVNI' } }) }))
    expect((await lookupByIco('27082440', { fetch: down.fetch, withRegistryNote: true }))?.registryNote).toBeNull()
  })
})
