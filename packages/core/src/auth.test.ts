import { schema } from '@fakturky/db'
import { eq } from 'drizzle-orm'
import { afterAll, expect, test } from 'vitest'
import { createAuth, resolvePrincipal } from './auth'
import { createTestDb } from './testing'

const handle = await createTestDb()
afterAll(() => handle.close())

test('sign-up creates org + business profile; session resolves to a principal', async () => {
  const auth = createAuth({
    db: handle.db,
    secret: 'test-secret-test-secret-test-secret-123',
    baseURL: 'http://localhost:3000',
  })
  const res = await auth.api.signUpEmail({
    body: { name: 'Jan Novák', email: 'jan@example.com', password: 'hunter2hunter2' },
    asResponse: true,
  })
  expect(res.status).toBe(200)
  const cookie = res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ')

  const [profile] = await handle.db.select().from(schema.businessProfile)
  expect(profile?.legalName).toBe('Jan Novák')

  const principal = await resolvePrincipal(auth, handle.db, new Headers({ cookie }))
  expect(principal).toMatchObject({ via: 'session', organizationId: profile?.organizationId })
  expect(await resolvePrincipal(auth, handle.db, new Headers())).toBeNull()
  const members = await handle.db
    .select()
    .from(schema.member)
    .where(eq(schema.member.role, 'owner'))
  expect(members).toHaveLength(1)

  // Removing the membership must revoke access even though the session still names the org.
  await handle.db.delete(schema.member)
  expect(await resolvePrincipal(auth, handle.db, new Headers({ cookie }))).toBeNull()
})

test('API key authenticates as its organization and can be revoked', async () => {
  const auth = createAuth({
    db: handle.db,
    secret: 'test-secret-test-secret-test-secret-123',
    baseURL: 'http://localhost:3000',
  })
  const res = await auth.api.signUpEmail({
    body: { name: 'Eva Svobodová', email: 'eva@example.com', password: 'hunter2hunter2' },
    asResponse: true,
  })
  const cookie = res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ')
  const headers = new Headers({ cookie })
  const principal = await resolvePrincipal(auth, handle.db, headers)
  if (!principal) throw new Error('expected principal')

  const created = await auth.api.createApiKey({
    headers,
    body: { name: 'test', organizationId: principal.organizationId },
  })
  expect(created.key.startsWith('fk_')).toBe(true)

  const viaKey = await resolvePrincipal(
    auth,
    handle.db,
    new Headers({ authorization: `Bearer ${created.key}` }),
  )
  expect(viaKey).toMatchObject({ via: 'apiKey', organizationId: principal.organizationId })
  expect(
    await resolvePrincipal(auth, handle.db, new Headers({ authorization: 'Bearer fk_nope' })),
  ).toBeNull()

  await auth.api.deleteApiKey({ headers, body: { keyId: created.id } })
  expect(
    await resolvePrincipal(
      auth,
      handle.db,
      new Headers({ authorization: `Bearer ${created.key}` }),
    ),
  ).toBeNull()
})
