import { createFileRoute } from '@tanstack/react-router'

/** Vercel Cron (daily): pulls new Fio transactions for every connected bank account. */
export const Route = createFileRoute('/api/cron/bank-sync')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) =>
        (await import('@/server/cron')).runCronJob(request, 'bankSync'),
    },
  },
})
