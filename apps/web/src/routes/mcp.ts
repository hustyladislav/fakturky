import { createFileRoute } from '@tanstack/react-router'

const handle = async ({ request }: { request: Request }) => {
  const [{ handleMcpRequest }, { getRuntime }] = await Promise.all([
    import('@fakturky/core/mcp'),
    import('@/server/runtime'),
  ])
  const { auth, handle: db } = await getRuntime()
  return handleMcpRequest(auth, db.db, request)
}

export const Route = createFileRoute('/mcp')({
  server: {
    handlers: { GET: handle, POST: handle, DELETE: handle },
  },
})
