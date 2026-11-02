import { createHash } from 'node:crypto'
import { BRAND } from '@fakturky/core/brand'

const SCALAR_VERSION = '1.76.4'
const SCALAR_URL = `https://cdn.jsdelivr.net/npm/@scalar/api-reference@${SCALAR_VERSION}/dist/browser/standalone.js`
// Subresource Integrity: this page is same-origin with the app, so a tampered CDN file must not run.
// Regenerate on a version bump: curl -sL <SCALAR_URL> | openssl dgst -sha384 -binary | openssl base64 -A
const SCALAR_SRI = 'sha384-hwB9WroDTpZaI38gr+u9CXA6ksz5gUYgD2GxXazKl/agT1L2GWUiRFWGJYNiFu4Q'

const CSS = `
.light-mode, .dark-mode { --scalar-font: "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif; }
.light-mode {
  --scalar-background-1: #fffefb; --scalar-background-2: #f2ede3; --scalar-background-3: #e9e2d3;
  --scalar-background-accent: #1f4d3c14; --scalar-color-1: #1b1a17; --scalar-color-2: #4f4a40;
  --scalar-color-3: #6b665b; --scalar-color-accent: #1f4d3c; --scalar-border-color: #d6cdba;
  --scalar-button-1: #1f4d3c; --scalar-button-1-color: #fffefb; --scalar-button-1-hover: #2a6350;
}
.dark-mode {
  --scalar-background-1: #1a1b17; --scalar-background-2: #0f100d; --scalar-background-3: #26271f;
  --scalar-background-accent: #8cc4a41f; --scalar-color-1: #ece6d6; --scalar-color-2: #b9b3a1;
  --scalar-color-3: #8d8777; --scalar-color-accent: #8cc4a4; --scalar-border-color: #34352b;
  --scalar-button-1: #8cc4a4; --scalar-button-1-color: #0f100d; --scalar-button-1-hover: #a3d2b8;
}
`

const INLINE = `
      Scalar.createApiReference('#app', {
        url: '/api/v1/openapi.json',
        // Never send the session cookie: the entered API key must be what authenticates.
        fetch: (input, init) => fetch(input, { ...init, credentials: 'omit' }),
        showDeveloperTools: 'never',
        agent: { disabled: true },
        withDefaultFonts: false,
        customCss: ${JSON.stringify(CSS)},
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
