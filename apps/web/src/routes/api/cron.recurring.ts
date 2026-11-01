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
        const [{ recurringRepo }, { documentsRepo }, { createContext }] = await Promise.all([
          import('@fakturky/core/templates-repo'),
          import('@fakturky/core/documents-repo'),
          import('@/server/context'),
        ])
        const ctx = await createContext(request.headers)
        const results = await recurringRepo.runDue(
          ctx.db,
          undefined,
          async (orgId, documentId, autoSend) => {
            if (!autoSend) return
            try {
              await documentsRepo.send(ctx.db, orgId, 'system:recurring', documentId, ctx.services)
            } catch (e) {
              // The invoice stays issued; the missing mail is visible in its history (no "sent" entry).
              console.warn(
                `[recurring] auto-send failed for ${documentId}: ${(e as Error).message}`,
              )
            }
          },
        )
        return Response.json({ processed: results.length, results })
      },
    },
  },
})
