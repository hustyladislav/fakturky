import { BRAND } from '@fakturky/core/brand'
import { createFileRoute } from '@tanstack/react-router'

const SCALAR_VERSION = '1.76.4'

const html = `<!doctype html>
<html lang="cs">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>API – ${BRAND.name}</title>
  </head>
  <body>
    <div id="app"></div>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference@${SCALAR_VERSION}"></script>
    <script>
      Scalar.createApiReference('#app', {
        url: '/api/v1/openapi.json',
        showDeveloperTools: 'never',
        agent: { disabled: true },
        authentication: { preferredSecurityScheme: 'apiKey' },
      })
    </script>
  </body>
</html>`

export const Route = createFileRoute('/docs/api')({
  server: {
    handlers: {
      GET: () => new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } }),
    },
  },
})
