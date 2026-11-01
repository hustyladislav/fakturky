import { createHash, randomBytes } from 'node:crypto'
import { afterAll, expect, test, vi } from 'vitest'
import { createAuth } from '../auth'
import { createTestDb } from '../testing'
import { handleMcpRequest } from './index'

const handle = await createTestDb()
afterAll(() => handle.close())

const baseURL = 'http://localhost:3000'
const clientId = 'https://agent.example.test/client.json'
const redirectUri = 'http://localhost:8123/callback'

/** Stand-in for the public HTTPS host serving the client's metadata document. */
const metadataFetch = async (input: RequestInfo | URL) => {
  expect(String(input)).toBe(clientId)
  return Response.json({
    client_id: clientId,
    client_name: 'Test Agent',
    redirect_uris: [redirectUri],
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none',
  })
}

const auth = createAuth({
  db: handle.db,
  secret: 'test-secret-test-secret-test-secret-123',
  baseURL,
  fetchClientMetadata: metadataFetch,
})

// Token verification fetches the JWKS from the issuer URL; serve it from the in-process auth handler.
vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new Request(input, init).url
  if (!url.startsWith(baseURL)) throw new Error(`unexpected network call: ${url}`)
  return auth.handler(new Request(input, init))
})

const b64url = (buf: Buffer) => buf.toString('base64url')

async function rpc(method: string, params: unknown, token: string) {
  const res = await handleMcpRequest(
    auth,
    handle.db,
    new Request(`${baseURL}/mcp`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    }),
  )
  const text = await res.text()
  return JSON.parse(text.match(/^data: (.*)$/m)?.[1] ?? text)
}

test('discovery advertises CIMD and the MCP protected resource', async () => {
  const meta = await (
    await auth.handler(new Request(`${baseURL}/api/auth/.well-known/oauth-authorization-server`))
  ).json()
  expect(meta).toMatchObject({
    issuer: `${baseURL}/api/auth`,
    client_id_metadata_document_supported: true,
    code_challenge_methods_supported: ['S256'],
  })
  const resource = await (
    await auth.handler(new Request(`${baseURL}/.well-known/oauth-protected-resource/mcp`))
  ).json()
  expect(resource).toMatchObject({
    resource: `${baseURL}/mcp`,
    authorization_servers: [`${baseURL}/api/auth`],
  })
})

test('authorize → consent → token → MCP tools (read + destructive) end to end', async () => {
  // A signed-in user (cookie) with a contact to act on.
  const signUp = await auth.api.signUpEmail({
    body: { name: 'Oauth User', email: 'oauth@example.com', password: 'hunter2hunter2' },
    asResponse: true,
  })
  const cookie = signUp.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ')

  // 1. Authorization request (PKCE) with the CIMD client id → redirected to the consent page.
  const verifier = b64url(randomBytes(32))
  const challenge = b64url(createHash('sha256').update(verifier).digest())
  const authorize = new URL(`${baseURL}/api/auth/oauth2/authorize`)
  authorize.search = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: 'mcp:tools',
    state: 'xyz',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    resource: `${baseURL}/mcp`,
  }).toString()
  const authRes = await auth.handler(
    new Request(authorize, { headers: { cookie }, redirect: 'manual' }),
  )
  expect(authRes.status).toBe(302)
  const consentUrl = new URL(authRes.headers.get('location') ?? '', baseURL)
  expect(consentUrl.pathname).toBe('/souhlas')
  expect(consentUrl.searchParams.get('client_id')).toBe(clientId)

  // The consent page shows the client's name (resolved from its metadata document).
  const pub = await auth.handler(
    new Request(
      `${baseURL}/api/auth/oauth2/public-client?client_id=${encodeURIComponent(clientId)}`,
      {
        headers: { cookie },
      },
    ),
  )
  expect(await pub.json()).toMatchObject({ client_name: 'Test Agent' })

  // 2. The user accepts on the consent page → redirect back to the client with a code.
  const consentRes = await auth.handler(
    new Request(`${baseURL}/api/auth/oauth2/consent`, {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json', origin: baseURL },
      body: JSON.stringify({ accept: true, oauth_query: consentUrl.search.slice(1) }),
    }),
  )
  const consent = (await consentRes.json()) as { url: string }
  const callback = new URL(consent.url)
  expect(`${callback.origin}${callback.pathname}`).toBe(redirectUri)
  expect(callback.searchParams.get('state')).toBe('xyz')
  const code = callback.searchParams.get('code') ?? ''
  expect(code).not.toBe('')

  // 3. Token exchange.
  const tokenRes = await auth.handler(
    new Request(`${baseURL}/api/auth/oauth2/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        code_verifier: verifier,
        client_id: clientId,
        redirect_uri: redirectUri,
        resource: `${baseURL}/mcp`,
      }),
    }),
  )
  const token = (await tokenRes.json()) as { access_token: string; scope?: string }
  expect(tokenRes.status).toBe(200)

  // 4. MCP calls with the OAuth access token.
  const tools = await rpc('tools/list', {}, token.access_token)
  expect(tools.result.tools.length).toBeGreaterThan(5)

  const created = await rpc(
    'tools/call',
    { name: 'create_contact', arguments: { name: 'Via OAuth', emails: [] } },
    token.access_token,
  )
  expect(created.result.isError).toBeFalsy()
  const id: string = created.result.structuredContent.id

  const listed = await rpc(
    'tools/call',
    { name: 'list_contacts', arguments: {} },
    token.access_token,
  )
  expect(listed.result.structuredContent.result.map((c: { id: string }) => c.id)).toContain(id)

  const archived = await rpc(
    'tools/call',
    { name: 'archive_contact', arguments: { id } },
    token.access_token,
  )
  expect(archived.result.structuredContent.archivedAt).not.toBeNull()

  // A token for the right audience is required: a garbage token gets the challenge.
  const bad = await handleMcpRequest(
    auth,
    handle.db,
    new Request(`${baseURL}/mcp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer nope' },
      body: '{}',
    }),
  )
  expect(bad.status).toBe(401)
})
