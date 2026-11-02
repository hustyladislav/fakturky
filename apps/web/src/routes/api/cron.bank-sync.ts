import { createFileRoute } from '@tanstack/react-router'

/** Vercel Cron (daily): pulls new Fio transactions for every connected bank account. */
export const Route = createFileRoute('/api/cron/bank-sync')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const { isCronAuthorized } = await import('@/server/cron-auth')
        if (!isCronAuthorized(request)) return new Response('Unauthorized', { status: 401 })
        const [{ bankRepo }, { createContext }] = await Promise.all([
          import('@fakturky/core/bank-repo'),
          import('@/server/context'),
        ])
        const ctx = await createContext(request.headers)
        const results = await bankRepo.syncAllFio(ctx.db)
        return Response.json({
          accounts: results.length,
          imported: results.reduce((n, r) => n + r.imported, 0),
          failed: results.filter((r) => r.error).length,
        })
      },
    },
  },
})
