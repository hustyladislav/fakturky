import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/docs/api')({
  server: {
    handlers: {
      GET: async () => (await import('@/server/docs-page')).docsApiResponse(),
    },
  },
})
