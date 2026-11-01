import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/v1/openapi.json')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { openApiSpec } = await import('@/server/openapi')
        return Response.json(await openApiSpec(new URL(request.url).origin))
      },
    },
  },
})
