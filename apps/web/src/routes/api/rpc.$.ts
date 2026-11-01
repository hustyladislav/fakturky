import { createFileRoute } from '@tanstack/react-router'

const handle = async ({ request }: { request: Request }) => {
  const [{ RPCHandler }, { router }, { createContext }] = await Promise.all([
    import('@orpc/server/fetch'),
    import('@fakturky/core/router'),
    import('@/server/context'),
  ])
  const handler = new RPCHandler(router)
  const { response } = await handler.handle(request, {
    prefix: '/api/rpc',
    context: await createContext(request.headers),
  })
  return response ?? new Response('Not found', { status: 404 })
}

export const Route = createFileRoute('/api/rpc/$')({
  server: {
    handlers: { GET: handle, POST: handle, PUT: handle, PATCH: handle, DELETE: handle },
  },
})
