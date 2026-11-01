import type { DbHandle } from '@fakturky/db'
import { afterAll, afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest'
import { clientFor, createTestDb, seedOrg } from '../testing'
import { resetUpstreamGuard } from '../upstream-guard'

let handle: DbHandle
let orgId: string
beforeAll(async () => {
  handle = await createTestDb()
  orgId = await seedOrg(handle, 'lookup-org')
})
afterAll(() => handle.close())
beforeEach(() => resetUpstreamGuard())
afterEach(() => vi.unstubAllGlobals())

const api = () => clientFor(handle, { userId: 'u', organizationId: orgId, via: 'session' })

const ares = {
  ico: '27082440',
  obchodniJmeno: 'Alza.cz a.s.',
  sidlo: { nazevObce: 'Praha', psc: 17000, kodStatu: 'CZ' },
}

test('ARES lookups hit the upstream once per IČO (cache) and only on the fixed host', async () => {
  const fetchMock = vi.fn(async () => Response.json(ares))
  vi.stubGlobal('fetch', fetchMock)
  const a = await api().lookup.ares({ ico: '27082440' })
  const b = await api().lookup.ares({ ico: ' 27082440 ' })
  expect(a?.name).toBe('Alza.cz a.s.')
  expect(b).toEqual(a)
  expect(fetchMock).toHaveBeenCalledTimes(1)
  const calls = fetchMock.mock.calls as unknown as [string][]
  expect(new URL(calls[0]?.[0] ?? '').host).toBe('ares.gov.cz')
})

test('the IČO is validated before anything is fetched (no URL smuggling)', async () => {
  const fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  for (const ico of [
    '../../etc/passwd',
    '27082440/../x',
    '1234567890123456',
    'http://evil.test',
    '12345678?x=1',
  ]) {
    await expect(api().lookup.ares({ ico })).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  }
  expect(fetchMock).not.toHaveBeenCalled()
})

test('lookups are rate limited per organization', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('', { status: 404 })),
  )
  const codes: string[] = []
  for (let i = 0; i < 32; i++) {
    try {
      await api().lookup.ares({ ico: '27082440' })
      codes.push('ok')
    } catch (e) {
      codes.push((e as { code: string }).code)
    }
  }
  expect(codes.slice(0, 30).every((c) => c === 'ok')).toBe(true)
  expect(codes.slice(30)).toEqual(['TOO_MANY_REQUESTS', 'TOO_MANY_REQUESTS'])
})
