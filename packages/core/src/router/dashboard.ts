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
}
