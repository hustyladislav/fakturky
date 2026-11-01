import { createFileRoute } from '@tanstack/react-router'

const handle = async ({ request }: { request: Request }) => {
  const { handleRest } = await import('@/server/openapi')
  return handleRest(request)
}

export const Route = createFileRoute('/api/v1/$')({
  server: {
    handlers: { GET: handle, POST: handle, PUT: handle, PATCH: handle, DELETE: handle },
  },
})
