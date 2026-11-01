import { createTestDb, seedOrg } from '@fakturky/core/testing'
import { type DbHandle, schema } from '@fakturky/db'
import { afterAll, afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest'
import { handleAgentRequest } from './handler'

let handle: DbHandle
let orgId: string
let userId: string
beforeAll(async () => {
  handle = await createTestDb()
  orgId = await seedOrg(handle, 'agent-handler')
  const [user] = await handle.db
    .insert(schema.user)
    .values({ name: 'T', email: 'handler@example.test', emailVerified: true })
    .returning({ id: schema.user.id })
  userId = user?.id ?? ''
})
afterAll(() => handle.close())

beforeEach(() => {
  vi.stubEnv('AI_GATEWAY_API_KEY', 'test-key')
})
afterEach(() => vi.unstubAllEnvs())

const body = {
  threadId: 't1',
  runId: 'r1',
  state: {},
  messages: [{ id: 'm1', role: 'user', content: 'Ahoj' }],
  tools: [],
  context: [],
  forwardedProps: {},
}
const request = () =>
  new Request('http://localhost/api/agent', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
const ctx = (via: 'session' | 'apiKey') => ({
  db: handle.db,
  principal: { userId, organizationId: orgId, via },
})

test('requires a signed-in session', async () => {
  expect((await handleAgentRequest(request(), { db: handle.db, principal: null })).status).toBe(401)
  // API keys belong to REST/MCP, not to the interactive assistant.
  expect((await handleAgentRequest(request(), ctx('apiKey'))).status).toBe(401)
})

test('answers 503 when the gateway is not configured', async () => {
  vi.stubEnv('AI_GATEWAY_API_KEY', '')
  vi.stubEnv('VERCEL_OIDC_TOKEN', '')
  expect((await handleAgentRequest(request(), ctx('session'))).status).toBe(503)
})

test('an exhausted budget becomes a friendly Czech error stream and costs nothing', async () => {
  vi.stubEnv('AI_MONTHLY_BUDGET_USD', '0')
  const res = await handleAgentRequest(request(), ctx('session'))
  expect(res.status).toBe(200)
  const text = await res.text()
  expect(text).toContain('RUN_ERROR')
  expect(text).toContain('assistant_limit_global')
  expect(await handle.db.select().from(schema.aiUsage)).toHaveLength(0)
})

test('rejects oversized bodies before parsing', async () => {
  const res = await handleAgentRequest(
    new Request('http://localhost/api/agent', {
      method: 'POST',
      headers: { 'content-length': String(10 * 1024 * 1024) },
      body: '{}',
    }),
    ctx('session'),
  )
  expect(res.status).toBe(413)
})

test('the body cap holds without a Content-Length header (streamed body)', async () => {
  const big = new Uint8Array(600 * 1024).fill(32)
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(big)
      controller.close()
    },
  })
  const res = await handleAgentRequest(
    new Request('http://localhost/api/agent', {
      method: 'POST',
      body: stream,
      duplex: 'half',
    } as RequestInit),
    ctx('session'),
  )
  expect(res.status).toBe(413)
})

test('malformed bodies are 400', async () => {
  const res = await handleAgentRequest(
    new Request('http://localhost/api/agent', { method: 'POST', body: '{"nope"' }),
    ctx('session'),
  )
  expect(res.status).toBe(400)
})
