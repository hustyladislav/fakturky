import { schema } from '@fakturky/db'
import { eq } from 'drizzle-orm'
import { afterAll, expect, test } from 'vitest'
import { createAuth, resolvePrincipal } from './auth'
import { createTestDb } from './testing'

const handle = await createTestDb()
afterAll(() => handle.close())

const secret = 'test-secret-test-secret-test-secret-123'

async function signUp(auth: ReturnType<typeof createAuth>, email: string) {
  const res = await auth.api.signUpEmail({
    body: { name: email.split('@')[0] ?? 'x', email, password: 'hunter2hunter2' },
    asResponse: true,
  })
  const cookie = res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ')
  const headers = new Headers({ cookie })
  const principal = await resolvePrincipal(auth, handle.db, headers)
  if (!principal) throw new Error('expected principal')
  return { res, headers, principal }
}

test('API keys are stored hashed and cannot be minted or removed across organizations', async () => {
  const auth = createAuth({ db: handle.db, secret, baseURL: 'http://localhost:3000' })
  const a = await signUp(auth, 'key-a@example.com')
  const b = await signUp(auth, 'key-b@example.com')
  const key = await auth.api.createApiKey({
    headers: a.headers,
    body: { name: 'a', organizationId: a.principal.organizationId },
  })

  const rows = await handle.db.select().from(schema.apikey).where(eq(schema.apikey.id, key.id))
  expect(rows[0]?.key).toBeTruthy()
  expect(rows[0]?.key).not.toBe(key.key)
  expect(JSON.stringify(rows)).not.toContain(key.key)

  // B cannot create a key for A's organization, nor delete A's key.
  await expect(
    auth.api.createApiKey({
      headers: b.headers,
      body: { name: 'evil', organizationId: a.principal.organizationId },
    }),
  ).rejects.toThrow()
  await expect(
    auth.api.deleteApiKey({ headers: b.headers, body: { keyId: key.id } }),
  ).rejects.toThrow()
  expect(
    await resolvePrincipal(auth, handle.db, new Headers({ 'x-api-key': key.key })),
  ).toMatchObject({ organizationId: a.principal.organizationId })
})

test('over https the session cookie is Secure, HttpOnly and SameSite=Lax', async () => {
  const auth = createAuth({ db: handle.db, secret, baseURL: 'https://app.example.com' })
  const { res } = await signUp(auth, 'cookie@example.com')
  const session = res.headers.getSetCookie().find((c) => c.includes('session_token'))
  expect(session).toMatch(/Secure/i)
  expect(session).toMatch(/HttpOnly/i)
  expect(session).toMatch(/SameSite=Lax/i)
})

test('password reset revokes existing sessions; rate limits are database-backed', async () => {
  const auth = createAuth({ db: handle.db, secret, baseURL: 'http://localhost:3000' })
  // Config assertion: the option that revokes sessions is on (behaviour is Better Auth's).
  expect((await auth.$context).options.rateLimit?.storage).toBe('database')
  expect((await auth.$context).options.emailAndPassword?.revokeSessionsOnPasswordReset).toBe(true)
})
