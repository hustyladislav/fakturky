import { createFileRoute } from '@tanstack/react-router'

const handle = async ({ request }: { request: Request }) => {
  const [{ createContext }, { handleAgentRequest }] = await Promise.all([
    import('@/server/context'),
    import('@/server/agent/handler'),
  ])
  return handleAgentRequest(request, await createContext(request.headers))
}

export const Route = createFileRoute('/api/agent')({
  server: { handlers: { POST: handle } },
})
