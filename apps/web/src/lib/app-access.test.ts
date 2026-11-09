import { ORPCError } from '@orpc/client'
import { QueryClient } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  recheckAppAccess,
  reportIfSessionRefused,
  requireAppAccess,
  SESSION_REFUSED_EVENT,
} from '@/lib/app-access'
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

describe('reportIfSessionRefused', () => {
  const heard = vi.fn()

  beforeEach(() => {
    heard.mockReset()
    vi.stubGlobal('window', new EventTarget())
    window.addEventListener(SESSION_REFUSED_EVENT, heard)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('announces a call the server refused for lack of a session', () => {
    reportIfSessionRefused(new ORPCError('UNAUTHORIZED'))
    expect(heard).toHaveBeenCalledOnce()
  })

  it.each([
    ['another API error', new ORPCError('NOT_FOUND')],
    ['a network failure', new TypeError('fetch failed')],
    ['a rejection without an error', null],
  ])('stays quiet for %s', (_, error) => {
    reportIfSessionRefused(error)
    expect(heard).not.toHaveBeenCalled()
  })
})
