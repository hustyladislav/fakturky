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
  // Org plugin endpoints go through joined queries (member + user, organization + members).
  const headers = new Headers({ cookie })
  const full = await auth.api.getFullOrganization({
    headers,
    query: { organizationId: profile?.organizationId },
  })
  expect(full?.members).toHaveLength(1)
  expect(full?.members[0]?.user.email).toBe('jan@example.com')
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

test('magic link sign-up: link is delivered, verifying creates user + org + business profile', async () => {
  const sent: { email: string; url: string }[] = []
  const auth = createAuth({
    db: handle.db,
    secret: 'test-secret-test-secret-test-secret-123',
    baseURL: 'http://localhost:3000',
    sendMagicLink: async (m) => {
      sent.push(m)
    },
  })
  await auth.api.signInMagicLink({
    body: { email: 'eva@example.com', callbackURL: '/' },
    headers: new Headers(),
  })
  expect(sent).toHaveLength(1)

  const res = await auth.handler(new Request(sent[0]?.url ?? '', { redirect: 'manual' }))
  expect(res.status).toBeLessThan(400)

  const [user] = await handle.db
    .select()
    .from(schema.user)
    .where(eq(schema.user.email, 'eva@example.com'))
  expect(user).toMatchObject({ email: 'eva@example.com', name: 'eva' })
  const [profile] = await handle.db
    .select()
    .from(schema.businessProfile)
    .where(eq(schema.businessProfile.legalName, 'eva'))
  expect(profile).toBeDefined()
})
