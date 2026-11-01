import { afterAll, expect, test } from 'vitest'
import { createAuth } from '../auth'
import { createTestDb } from '../testing'
import { handleMcpRequest } from './index'

const handle = await createTestDb()
afterAll(() => handle.close())

const baseURL = 'http://localhost:3000'
const auth = createAuth({
  db: handle.db,
  secret: 'test-secret-test-secret-test-secret-123',
  baseURL,
})

const rpc = (method: string, params: unknown, token?: string) =>
  new Request(`${baseURL}/mcp`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })

async function json(res: Response) {
  const text = await res.text()
  const data =
    text.startsWith('event:') || text.includes('\ndata:') ? text.match(/data: (.*)/)?.[1] : text
  return JSON.parse(data ?? 'null')
}

async function apiKeyForNewOrg(email: string) {
  const res = await auth.api.signUpEmail({
    body: { name: email, email, password: 'hunter2hunter2' },
    asResponse: true,
  })
  const headers = new Headers({
    cookie: res.headers
      .getSetCookie()
      .map((c) => c.split(';')[0])
      .join('; '),
  })
  const orgs = await auth.api.listOrganizations({ headers })
  const created = await auth.api.createApiKey({
    headers,
    body: { name: 'mcp', organizationId: orgs[0]?.id ?? '' },
  })
  return created.key
}

test('unauthenticated request gets a 401 challenge pointing at protected-resource metadata', async () => {
  const res = await handleMcpRequest(auth, handle.db, rpc('tools/list', {}))
  expect(res.status).toBe(401)
  expect(res.headers.get('www-authenticate')).toContain('/.well-known/oauth-protected-resource')
})

test('invalid API key is challenged, GET is rejected', async () => {
  const res = await handleMcpRequest(auth, handle.db, rpc('tools/list', {}, 'fk_nope'))
  expect(res.status).toBe(401)
  const get = await handleMcpRequest(auth, handle.db, new Request(`${baseURL}/mcp`))
  expect(get.status).toBe(405)
})

test('API key lists tools, calls them scoped to its organization', async () => {
  const a = await apiKeyForNewOrg('a@example.com')
  const b = await apiKeyForNewOrg('b@example.com')

  const list = await json(await handleMcpRequest(auth, handle.db, rpc('tools/list', {}, a)))
  const names: string[] = list.result.tools.map((t: { name: string }) => t.name)
  expect(names).toContain('create_contact')
  const archive = list.result.tools.find((t: { name: string }) => t.name === 'archive_contact')
  expect(archive.annotations.destructiveHint).toBe(true)

  const created = await json(
    await handleMcpRequest(
      auth,
      handle.db,
      rpc('tools/call', { name: 'create_contact', arguments: { name: 'ACME', emails: [] } }, a),
    ),
  )
  expect(created.result.isError).toBeFalsy()
  expect(created.result.structuredContent.name).toBe('ACME')

  const own = await json(
    await handleMcpRequest(
      auth,
      handle.db,
      rpc('tools/call', { name: 'list_contacts', arguments: {} }, a),
    ),
  )
  expect(own.result.structuredContent.result).toHaveLength(1)
  const other = await json(
    await handleMcpRequest(
      auth,
      handle.db,
      rpc('tools/call', { name: 'list_contacts', arguments: {} }, b),
    ),
  )
  expect(other.result.structuredContent.result).toHaveLength(0)

  const prompts = await json(await handleMcpRequest(auth, handle.db, rpc('prompts/list', {}, a)))
  expect(prompts.result.prompts.map((p: { name: string }) => p.name)).toContain('vystav_fakturu')
})
