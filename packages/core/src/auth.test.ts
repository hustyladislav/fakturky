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
})
