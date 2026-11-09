import { schema } from '@fakturky/db'
import { eq } from 'drizzle-orm'
import { afterAll, expect, test } from 'vitest'
import { createAuth, DEVICE_CLIENT_ID, resolvePrincipal } from '../auth'
import { createTestDb } from '../testing'
import { redeemDeviceCode } from './device'

const handle = await createTestDb()
afterAll(() => handle.close())

const baseURL = 'http://localhost:3000'
const auth = createAuth({
  db: handle.db,
  secret: 'test-secret-test-secret-test-secret-123',
  baseURL,
})

const post = (path: string, body: unknown, cookie?: string) =>
  auth.handler(
    new Request(`${baseURL}/api/auth${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: baseURL,
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    }),
  )

async function signUp(email: string) {
  const res = await auth.api.signUpEmail({
    body: { name: email, email, password: 'hunter2hunter2' },
    asResponse: true,
  })
  return res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ')
}

const start = async () =>
  (await (await post('/device/code', { client_id: DEVICE_CLIENT_ID })).json()) as {
    device_code: string
    user_code: string
    verification_uri_complete: string
  }

const claim = (userCode: string, cookie: string) =>
  auth.handler(
    new Request(`${baseURL}/api/auth/device?user_code=${userCode}`, { headers: { cookie } }),
  )

const redeem = (deviceCode: string) =>
  redeemDeviceCode(auth, handle.db, { deviceCode, clientId: DEVICE_CLIENT_ID })

async function rewindPoll(deviceCode: string) {
  await handle.db
    .update(schema.deviceCode)
    .set({ lastPolledAt: null })
    .where(eq(schema.deviceCode.deviceCode, deviceCode))
}

test('an unknown client cannot start the flow', async () => {
  expect((await post('/device/code', { client_id: 'someone-else' })).ok).toBe(false)
})

test('the code points at our approval page', async () => {
  const { verification_uri_complete: url, user_code: code } = await start()
  expect(url).toContain(`/pripojit?user_code=${code}`)
})

test('approval yields one API key for the approver, and no session is left behind', async () => {
  const cookie = await signUp('approve@example.com')
  const { device_code: deviceCode, user_code: userCode } = await start()

  expect(await redeem(deviceCode)).toEqual({
    ok: false,
    status: 400,
    error: 'authorization_pending',
  })
  await rewindPoll(deviceCode)

  await claim(userCode, cookie)
  expect((await post('/device/approve', { userCode }, cookie)).ok).toBe(true)

  // The plugin's own endpoint would hand out a session; only the exchange below may redeem a grant.
  const direct = await post('/device/token', {
    grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    device_code: deviceCode,
    client_id: DEVICE_CLIENT_ID,
  })
  expect(direct.status).toBe(404)

  const before = await handle.db.select().from(schema.session)
  const result = await redeem(deviceCode)
  if (!result.ok) throw new Error(result.error)
  expect(result.apiKey.startsWith('fk_')).toBe(true)
  expect(await handle.db.select().from(schema.session)).toHaveLength(before.length)

  const principal = await resolvePrincipal(
    auth,
    handle.db,
    new Headers({ authorization: `Bearer ${result.apiKey}` }),
  )
  const own = await resolvePrincipal(auth, handle.db, new Headers({ cookie }))
  expect(principal?.organizationId).toBe(own?.organizationId)
  expect(own).not.toBeNull()

  await rewindPoll(deviceCode)
  expect(await redeem(deviceCode)).toMatchObject({ ok: false, error: 'invalid_grant' })
})

test('a denied request yields no key', async () => {
  const cookie = await signUp('deny@example.com')
  const { device_code: deviceCode, user_code: userCode } = await start()
  await claim(userCode, cookie)
  expect((await post('/device/deny', { userCode }, cookie)).ok).toBe(true)
  expect(await redeem(deviceCode)).toMatchObject({ ok: false, error: 'access_denied' })
})

test('someone else cannot approve a request claimed by another user', async () => {
  const owner = await signUp('owner@example.com')
  const other = await signUp('other@example.com')
  const { user_code: userCode } = await start()
  await claim(userCode, owner)
  expect((await post('/device/approve', { userCode }, other)).ok).toBe(false)
})
