import { createFileRoute } from '@tanstack/react-router'

/** Vercel Cron (daily on Hobby). Authorised with `Authorization: Bearer $CRON_SECRET`. */
export const Route = createFileRoute('/api/cron/recurring')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const secret = process.env.CRON_SECRET
        if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
          return new Response('Unauthorized', { status: 401 })
        }
        const [{ recurringRepo }, { getRuntime }] = await Promise.all([
          import('@fakturky/core/templates-repo'),
          import('@/server/runtime'),
        ])
        const { handle } = await getRuntime()
        const results = await recurringRepo.runDue(handle.db)
        return Response.json({ processed: results.length, results })
      },
    },
  },
})
