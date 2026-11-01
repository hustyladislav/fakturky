import { createFileRoute } from '@tanstack/react-router'

/**
 * OAuth discovery documents live at the site root while Better Auth is mounted under /api/auth:
 * protected-resource metadata (RFC 9728) for /mcp, authorization-server metadata (RFC 8414) and
 * OpenID configuration for the issuer `<origin>/api/auth`.
 */
const handle = async ({ request }: { request: Request }) => {
  const [{ oauthProviderAuthServerMetadata, oauthProviderOpenIdConfigMetadata }, { getRuntime }] =
    await Promise.all([import('@better-auth/oauth-provider'), import('@/server/runtime')])
  const { auth } = await getRuntime()
  const path = new URL(request.url).pathname

  if (path.startsWith('/.well-known/oauth-protected-resource')) return auth.handler(request)
  if (path.startsWith('/.well-known/oauth-authorization-server')) {
    return oauthProviderAuthServerMetadata(auth)(request)
  }
  if (path.startsWith('/.well-known/openid-configuration')) {
    return oauthProviderOpenIdConfigMetadata(auth)(request)
  }
  return new Response('Not found', { status: 404 })
}

export const Route = createFileRoute('/.well-known/$')({
  server: { handlers: { GET: handle, HEAD: handle } },
})
