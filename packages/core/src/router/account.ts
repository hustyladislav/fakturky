import { schema } from '@fakturky/db'
import { ORPCError } from '@orpc/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { procedure } from '../orpc'

export const accountRouter = {
  whoami: procedure({
    mcp: {
      name: 'whoami',
      title: 'Who am I: the organization and credential this session acts as',
      readOnly: true,
    },
    openapi: {
      method: 'GET',
      path: '/whoami',
      summary: 'The organization the current credential (API key, OAuth token or session) acts on',
      tags: ['Account'],
    },
  })
    .input(z.object({}))
    .output(
      z.object({
        organizationId: z.string(),
        organizationName: z.string(),
        via: z.enum(['session', 'apiKey', 'oauth']),
      }),
    )
    .handler(async ({ context }) => {
      const [org] = await context.db
        .select({ name: schema.organization.name })
        .from(schema.organization)
        .where(eq(schema.organization.id, context.principal.organizationId))
      if (!org) throw new ORPCError('NOT_FOUND', { message: 'Organization not found' })
      return {
        organizationId: context.principal.organizationId,
        organizationName: org.name,
        via: context.principal.via,
      }
    }),
}
