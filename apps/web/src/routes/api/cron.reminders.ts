import { createFileRoute } from '@tanstack/react-router'

/** Vercel Cron (daily). Authorised with `Authorization: Bearer $CRON_SECRET`. */
export const Route = createFileRoute('/api/cron/reminders')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const secret = process.env.CRON_SECRET
        if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
          return new Response('Unauthorized', { status: 401 })
        }
        const [{ remindersRepo }, { createContext }] = await Promise.all([
          import('@fakturky/core/reminders-repo'),
          import('@/server/context'),
        ])
        const ctx = await createContext(request.headers)
        const results = await remindersRepo.runDue(ctx.db, ctx.services)
        return Response.json({
          processed: results.length,
          sent: results.filter((r) => r.sent).length,
        })
      },
    },
  },
})
