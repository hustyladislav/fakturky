import { createCsrfMiddleware, createMiddleware, createStart } from '@tanstack/react-start'
import { nonceStore } from './server/nonce'
import { buildCsp, generateNonce, needsCsrfCheck } from './server/security-headers'

const securityHeaders = createMiddleware({ type: 'request' }).server(async ({ next }) => {
  const nonce = generateNonce()
  const result = await nonceStore.run(nonce, () => next())
  const headers = result.response.headers
  const isHtml = headers.get('content-type')?.includes('text/html')
  // A route that ships its own CSP (e.g. /docs/api) keeps it; everything else gets the nonce policy.
  if (isHtml && !headers.has('content-security-policy') && import.meta.env.PROD) {
    headers.set('content-security-policy', buildCsp(nonce))
  }
  return result
})

// Passing our own `requestMiddleware` switches off Start's built-in CSRF protection for server functions, so it is
// re-added here and widened to the cookie-authenticated mutation endpoints (/api/rpc, /api/v1).
const csrf = createCsrfMiddleware({
  filter: ({ handlerType, request }) =>
    needsCsrfCheck(handlerType, request.method, new URL(request.url).pathname, request.headers),
})

export const startInstance = createStart(() => ({ requestMiddleware: [securityHeaders, csrf] }))
