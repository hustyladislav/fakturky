import { requireMcpAuth } from '@better-auth/mcp'
import type { Db } from '@fakturky/db'
import { type Auth, MCP_SCOPE, mcpResource, principalForUser, resolvePrincipal } from '../auth'
import { BRAND } from '../brand'
import { createMcpFetchHandler } from './server'

export { createMcpFetchHandler } from './server'

/**
 * Serve one MCP request. Callers authenticate with either an API key (`Authorization: Bearer fk_…`)
 * or an OAuth 2.1 access token issued by this app (verified against its JWKS). Anything else gets
 * the RFC 9728 `WWW-Authenticate` challenge so MCP clients can start the authorization flow.
 */
export async function handleMcpRequest(auth: Auth, db: Db, request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Use POST (Streamable HTTP, stateless)' }), {
      status: 405,
      headers: { allow: 'POST', 'content-type': 'application/json' },
    })
  }

  const bearer = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (bearer?.startsWith(BRAND.apiKeyPrefix)) {
    const principal = await resolvePrincipal(auth, db, request.headers)
    if (principal) return createMcpFetchHandler({ db, principal }).fetch(request)
    // Invalid key: fall through so the client receives the standard challenge.
  }

  const { baseURL } = await auth.$context
  return requireMcpAuth(
    auth,
    async (req, claims) => {
      const principal = claims.sub ? await principalForUser(db, claims.sub, 'oauth') : null
      if (!principal) return new Response('Forbidden', { status: 403 })
      return createMcpFetchHandler({ db, principal }).fetch(req)
    },
    { resource: mcpResource(baseURL), requiredScopes: [MCP_SCOPE] },
  )(request)
}
