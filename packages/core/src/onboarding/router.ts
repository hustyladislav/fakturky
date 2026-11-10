import { z } from 'zod'
import { procedure } from '../orpc'
import { onboardingStatus, onboardingStatusSchema } from './status'

export const onboardingRouter = {
  status: procedure({
    mcp: {
      name: 'get_onboarding_status',
      title: 'What is left to set up, and how',
      description:
        'The setup checklist for this organization: each step says whether it is done, whether to act or ask the user (with the question ready to ask) and which tools to use. Call it first when the user wants to set up the app, then again after each step, passing `settled`, until `next` is null.',
      readOnly: true,
      idempotent: true,
    },
    openapi: {
      method: 'GET',
      path: '/onboarding/status',
      summary: 'The setup checklist: what is done, what an agent should do or ask next',
      tags: ['Account'],
    },
  })
    .input(
      z.object({
        // Optional so the first call needs no arguments; a REST query with one value arrives as a string.
        settled: z
          .union([z.string(), z.array(z.string()).max(20)])
          .transform((ids) => (typeof ids === 'string' ? [ids] : ids))
          .optional()
          .describe('Ids of steps the user answered with nothing to save, or declined'),
      }),
    )
    .output(onboardingStatusSchema)
    .handler(({ context, input }) =>
      onboardingStatus(context.db, context.principal.organizationId, input.settled ?? []),
    ),
}
