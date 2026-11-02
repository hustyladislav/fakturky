import { z } from 'zod'
import { procedure } from '../orpc'
import { dashboardRepo } from '../repositories/dashboard'

export const dashboardRouter = {
  summary: procedure({
    mcp: {
      name: 'get_dashboard_summary',
      title:
        'Business overview: 12-month turnover (paid/unpaid), received payments, unpaid, overdue, VAT registration limit',
      readOnly: true,
    },
    openapi: {
      method: 'GET',
      path: '/dashboard',
      summary:
        'Overview KPIs (turnover this month, unpaid, overdue) and the VAT registration limit tracker',
      tags: ['Dashboard'],
    },
  })
    .input(z.object({}))
    .output(
      z.object({
        monthTurnover: z.string(),
        monthCreditNotes: z.string().describe('Credit notes netted into the month turnover (≤ 0)'),
        monthIssuedCount: z.number().describe('Invoices with a tax date in the current month'),
        monthReceived: z.string().describe('Payments received this month (CZK)'),
        unpaidCount: z.number(),
        unpaid: z.string(),
        overdue: z.string(),
        overdueCount: z.number(),
        oldestOverdueDays: z.number(),
        vatLimit: z
          .object({
            year: z.number(),
            turnover: z.string(),
            limit: z.string(),
            immediateLimit: z.string(),
            immediateExceeded: z.boolean(),
            percent: z.number(),
          })
          .nullable(),
        months: z
          .array(
            z.object({
              month: z.string().describe('YYYY-MM'),
              turnover: z.string().describe('Net turnover (credit notes included)'),
              paid: z.string().describe('Paid part of the turnover'),
              unpaid: z.string().describe('Turnover not paid yet'),
              received: z.string().describe('Payments received in the month'),
            }),
          )
          .describe('Last 12 months, oldest first'),
      }),
    )
    .handler(({ context }) => dashboardRepo.summary(context.db, context.principal.organizationId)),

  activity: procedure({
    mcp: {
      name: 'get_recent_activity',
      title: 'Latest document events: issued, paid, sent, reminded, matched from the bank',
      readOnly: true,
    },
    openapi: {
      method: 'GET',
      path: '/dashboard/activity',
      summary: 'The latest document events for the dashboard feed',
      tags: ['Dashboard'],
    },
  })
    .input(z.object({ limit: z.coerce.number().int().min(1).max(30).default(6) }))
    .output(
      z.array(
        z.object({
          id: z.string(),
          action: z.string(),
          createdAt: z.date(),
          documentId: z.string(),
          number: z.string().nullable(),
          type: z.string(),
          customerName: z.string().nullable(),
        }),
      ),
    )
    .handler(({ context, input }) =>
      dashboardRepo.activity(context.db, context.principal.organizationId, input.limit),
    ),
}
