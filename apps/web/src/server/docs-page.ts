import { createHash } from 'node:crypto'
import { BRAND } from '@fakturky/core/brand'

const SCALAR_VERSION = '1.76.4'
const SCALAR_URL = `https://cdn.jsdelivr.net/npm/@scalar/api-reference@${SCALAR_VERSION}/dist/browser/standalone.js`
// Subresource Integrity: this page is same-origin with the app, so a tampered CDN file must not run.
// Regenerate on a version bump: curl -sL <SCALAR_URL> | openssl dgst -sha384 -binary | openssl base64 -A
const SCALAR_SRI = 'sha384-hwB9WroDTpZaI38gr+u9CXA6ksz5gUYgD2GxXazKl/agT1L2GWUiRFWGJYNiFu4Q'

const INLINE = `
      Scalar.createApiReference('#app', {
        url: '/api/v1/openapi.json',
        // Never send the session cookie: the entered API key must be what authenticates.
        fetch: (input, init) => fetch(input, { ...init, credentials: 'omit' }),
        showDeveloperTools: 'never',
        agent: { disabled: true },
        withDefaultFonts: false,
        authentication: { preferredSecurityScheme: 'apiKey' },
      })
`

const html = `<!doctype html>
<html lang="cs">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>API – ${BRAND.name}</title>
  </head>
  <body>
    <div id="app"></div>
    <script src="${SCALAR_URL}" integrity="${SCALAR_SRI}" crossorigin="anonymous"></script>
    <script>${INLINE}</script>
  </body>
</html>`

// Own CSP (the global nonce policy skips responses that already carry one): the only third-party
// script is the SRI-pinned Scalar bundle plus our one inline initialiser, pinned by hash.
const csp = [
  "default-src 'none'",
  `script-src https://cdn.jsdelivr.net 'sha256-${createHash('sha256').update(INLINE).digest('base64')}'`,
  "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
  "img-src 'self' data: https:",
  "font-src 'self' data: https://cdn.jsdelivr.net",
  "connect-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ')

export function docsApiResponse(): Response {
  return new Response(html, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'content-security-policy': csp },
  })
}
