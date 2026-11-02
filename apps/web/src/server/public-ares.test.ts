import { resetUpstreamGuard } from '@fakturky/core/upstream-guard'
import { beforeEach, expect, test, vi } from 'vitest'

const lookup = vi.fn()
vi.mock('@fakturky/domain', async (orig) => ({
  ...(await orig<typeof import('@fakturky/domain')>()),
  lookupByIco: (...args: unknown[]) => lookup(...args),
}))

const { publicAresLookup } = await import('./public-ares')

const subject = {
  ico: '27082440',
  name: 'Firma s.r.o.',
  dic: 'CZ27082440',
  address: { street: 'Dlouhá 1', city: 'Praha', zip: '110 00', country: 'CZ' },
  vatPayer: true,
  legalForm: '112',
  registryNote: 'tajná poznámka',
}
const ip = (v: string) => new Headers({ 'x-forwarded-for': v })

beforeEach(() => {
  resetUpstreamGuard()
  lookup.mockReset()
})

test('rejects a bad checksum before calling ARES', async () => {
  const r = await publicAresLookup(ip('1.1.1.1'), '12345678')
  expect(r.status).toBe(400)
  expect(lookup).not.toHaveBeenCalled()
})

test('returns only registry data, never the registry note', async () => {
  lookup.mockResolvedValue(subject)
  const r = await publicAresLookup(ip('1.1.1.2'), '27082440')
  expect(r.status).toBe(200)
  expect(r.body).toEqual({
    ico: '27082440',
    name: 'Firma s.r.o.',
    dic: 'CZ27082440',
    address: subject.address,
    vatPayer: true,
  })
})

test('unknown IČO is a 404, an upstream failure a 502', async () => {
  lookup.mockResolvedValueOnce(null)
  expect((await publicAresLookup(ip('1.1.1.3'), '27082440')).status).toBe(404)
  resetUpstreamGuard()
  lookup.mockRejectedValueOnce(new Error('down'))
  expect((await publicAresLookup(ip('1.1.1.3'), '27082440')).status).toBe(502)
})

test('one address gets 8 lookups a minute, then 429; another address is unaffected', async () => {
  lookup.mockResolvedValue(subject)
  for (let i = 0; i < 8; i++) {
    expect((await publicAresLookup(ip('2.2.2.2'), '27082440')).status).toBe(200)
  }
  const limited = await publicAresLookup(ip('2.2.2.2'), '27082440')
  expect(limited.status).toBe(429)
  expect(limited.retryAfter).toBe(60)
  expect((await publicAresLookup(ip('3.3.3.3'), '27082440')).status).toBe(200)
})
