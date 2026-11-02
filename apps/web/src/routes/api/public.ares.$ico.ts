import { createFileRoute } from '@tanstack/react-router'

/** Anonymous, rate-limited ARES lookup for the landing-page demo. */
export const Route = createFileRoute('/api/public/ares/$ico')({
  server: {
    handlers: {
      GET: async ({ request, params }: { request: Request; params: { ico: string } }) => {
        const { publicAresLookup } = await import('@/server/public-ares')
        const { status, body, retryAfter } = await publicAresLookup(request.headers, params.ico)
        return Response.json(body, {
          status,
          headers: {
            'cache-control': status === 200 ? 'public, max-age=300' : 'no-store',
            'x-robots-tag': 'noindex',
            ...(retryAfter ? { 'retry-after': String(retryAfter) } : {}),
          },
        })
      },
    },
  },
})
