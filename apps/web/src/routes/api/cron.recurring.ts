import { createFileRoute } from '@tanstack/react-router'

/** Vercel Cron (daily): issues invoices from recurring rules. */
export const Route = createFileRoute('/api/cron/recurring')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) =>
        (await import('@/server/cron')).runCronJob(request, 'recurring'),
    },
  },
})
