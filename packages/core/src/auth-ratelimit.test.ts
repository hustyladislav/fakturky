import { schema } from '@fakturky/db'
import { afterAll, expect, test } from 'vitest'
import { createAuth } from './auth'
import { createTestDb } from './testing'

const handle = await createTestDb()
afterAll(() => handle.close())

test('sign-in is rate limited via the database', async () => {
  const auth = createAuth({
    db: handle.db,
    secret: 'test-secret-test-secret-test-secret-123',
    baseURL: 'http://localhost:3000',
  })
  const codes: number[] = []
  for (let i = 0; i < 8; i++) {
    const r = await auth.handler(
      new Request('http://localhost:3000/api/auth/sign-in/email', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: 'http://localhost:3000',
          'x-real-ip': '203.0.113.9',
        },
        body: JSON.stringify({ email: 'nobody@example.com', password: 'wrongwrongwrong' }),
      }),
    )
    codes.push(r.status)
  }
  // 5 attempts per minute per IP on credential sign-in, then 429
  expect(codes.slice(0, 5)).not.toContain(429)
  expect(codes.slice(5)).toEqual([429, 429, 429])
  expect((await handle.db.select().from(schema.rateLimit)).length).toBeGreaterThan(0)
})
