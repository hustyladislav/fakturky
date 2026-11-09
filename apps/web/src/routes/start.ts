import { createFileRoute } from '@tanstack/react-router'

/** The runbook a user's agent follows when pointed at the app. Plain text on purpose: agents read it. */
export const Route = createFileRoute('/start')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { renderRunbook } = await import('@fakturky/core/onboarding')
        return new Response(renderRunbook(new URL(request.url).origin), {
          headers: {
            'content-type': 'text/markdown; charset=utf-8',
            'cache-control': 'public, max-age=3600',
          },
        })
      },
    },
  },
})
