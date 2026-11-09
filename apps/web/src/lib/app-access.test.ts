import { QueryClient } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { forgetAppAccessIfUnauthorized, recheckAppAccess, requireAppAccess } from '@/lib/app-access'
import { getAppAccessFn } from '@/server/session'

vi.mock('@/server/session', () => ({ getAppAccessFn: vi.fn() }))

const ask = vi.mocked(getAppAccessFn)
const user = { id: 'u1', name: 'Jana', email: 'jana@example.cz' }
const pass = { user, onboarded: true }
const redirectTarget = (client: QueryClient) =>
  requireAppAccess(client).then(
    () => null,
    (e: { options: { to: string } }) => e.options.to,
  )

describe('requireAppAccess', () => {
  let client: QueryClient

  beforeEach(() => {
    ask.mockReset()
    client = new QueryClient()
  })
  afterEach(() => vi.useRealTimers())

  it('asks the server once for any number of page switches', async () => {
    ask.mockResolvedValue(pass)
    expect(await requireAppAccess(client)).toEqual(user)
    expect(await requireAppAccess(client)).toEqual(user)
    expect(ask).toHaveBeenCalledOnce()
  })

  it('asks again once the last check is older than five minutes', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    ask.mockResolvedValue(pass)
    await requireAppAccess(client)
    vi.setSystemTime(Date.now() + 5 * 60_000 + 1)
    await requireAppAccess(client)
    expect(ask).toHaveBeenCalledTimes(2)
  })

  it('sends a signed-out visitor to the login page and does not remember it', async () => {
    ask.mockResolvedValueOnce(null).mockResolvedValueOnce(pass)
    expect(await redirectTarget(client)).toBe('/prihlaseni')
    expect(await requireAppAccess(client)).toEqual(user)
  })

  it('lets a user in right after onboarding, though the last answer was "not yet"', async () => {
    ask.mockResolvedValueOnce({ user, onboarded: false }).mockResolvedValueOnce(pass)
    expect(await redirectTarget(client)).toBe('/onboarding')
    expect(await requireAppAccess(client)).toEqual(user)
  })
})

describe('recheckAppAccess', () => {
  it('replaces the remembered user with whoever is signed in now', async () => {
    const client = new QueryClient()
    const other = { id: 'u2', name: 'Petr', email: 'petr@example.cz' }
    ask.mockReset()
    ask.mockResolvedValueOnce(pass).mockResolvedValueOnce({ user: other, onboarded: true })
    await requireAppAccess(client)
    recheckAppAccess(client)
    expect(await requireAppAccess(client)).toEqual(other)
    expect(ask).toHaveBeenCalledTimes(2)
  })
})

describe('forgetAppAccessIfUnauthorized', () => {
  it('makes the next page switch ask the server after a 401', async () => {
    const client = new QueryClient()
    ask.mockReset()
    ask.mockResolvedValue(pass)
    await requireAppAccess(client)
    forgetAppAccessIfUnauthorized(client, { code: 'UNAUTHORIZED' })
    await requireAppAccess(client)
    expect(ask).toHaveBeenCalledTimes(2)
  })

  it('keeps the pass when a procedure fails for any other reason', async () => {
    const client = new QueryClient()
    ask.mockReset()
    ask.mockResolvedValue(pass)
    await requireAppAccess(client)
    forgetAppAccessIfUnauthorized(client, { code: 'NOT_FOUND' })
    await requireAppAccess(client)
    expect(ask).toHaveBeenCalledOnce()
  })
})
