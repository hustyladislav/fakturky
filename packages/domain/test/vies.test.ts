import { describe, expect, it } from 'vitest'
import { checkVatId } from '../src/integrations/vies.ts'
import { fixture, mockFetch } from './helpers.ts'

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
