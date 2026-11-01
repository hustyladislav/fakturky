import { createFileRoute } from '@tanstack/react-router'

/** Dev-only: tells `pnpm db:seed` whether this server runs on the local PGlite (never in production). */
const handle = async () => {
  if (process.env.NODE_ENV === 'production') return new Response('Not found', { status: 404 })
  const { getRuntime } = await import('@/server/runtime')
  const { handle } = await getRuntime()
  return Response.json({ kind: handle.kind })
}

export const Route = createFileRoute('/api/dev/db-kind')({
  server: { handlers: { GET: handle } },
})
