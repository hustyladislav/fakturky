import { createFileRoute } from '@tanstack/react-router'

/** Vercel Cron (daily): sends overdue reminders. */
export const Route = createFileRoute('/api/cron/reminders')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) =>
        (await import('@/server/cron')).runCronJob(request, 'reminders'),
    },
  },
})
