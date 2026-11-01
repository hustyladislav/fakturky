import { z } from 'zod'
import { procedure } from '../orpc'
import { dashboardRepo } from '../repositories/dashboard'

export const dashboardRouter = {
  summary: procedure({
    mcp: {
      name: 'get_dashboard_summary',
      title: 'Business overview: monthly turnover, unpaid, overdue, VAT registration limit',
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
        unpaid: z.string(),
        overdue: z.string(),
        overdueCount: z.number(),
        oldestOverdueDays: z.number(),
        vatLimit: z
          .object({
            year: z.number(),
            turnover: z.string(),
            limit: z.string(),
            percent: z.number(),
          })
          .nullable(),
        months: z.array(z.object({ month: z.string(), turnover: z.string() })),
      }),
    )
    .handler(({ context }) => dashboardRepo.summary(context.db, context.principal.organizationId)),
}
