import { IntegrationError, lookupByIco } from '@fakturky/domain'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { procedure } from '../orpc'
import { businessProfileRepo } from '../repositories/business-profile'
import {
  aresSubjectSchema,
  businessProfilePatchSchema,
  businessProfileSchema,
} from '../schemas/business-profile'

export const businessProfileRouter = {
  get: procedure({
    mcp: { name: 'get_business_profile', title: 'Get the business profile', readOnly: true },
    openapi: {
      method: 'GET',
      path: '/business-profile',
      summary: 'Get the supplier profile of the organization',
      tags: ['Business profile'],
    },
  })
    .output(businessProfileSchema)
    .handler(async ({ context }) =>
      businessProfileRepo.getOrCreate(context.db, context.principal.organizationId, 'Moje firma'),
    ),

  update: procedure({
    mcp: {
      name: 'update_business_profile',
      title: 'Update the business profile',
      idempotent: true,
    },
    openapi: {
      method: 'PATCH',
      path: '/business-profile',
      summary: 'Update the supplier profile (also finishes onboarding)',
      tags: ['Business profile'],
    },
  })
    .input(businessProfilePatchSchema)
    .output(businessProfileSchema)
    .handler(async ({ context, input }) => {
      const orgId = context.principal.organizationId
      await businessProfileRepo.getOrCreate(context.db, orgId, input.legalName ?? 'Moje firma')
      const row = await businessProfileRepo.update(context.db, orgId, input, true)
      if (!row) throw new ORPCError('NOT_FOUND')
      return row
    }),

  lookupIco: procedure({
    mcp: {
      name: 'lookup_company_by_ico',
      title: 'Look up a company in ARES by IČO',
      readOnly: true,
    },
    openapi: {
      method: 'GET',
      path: '/ares/{ico}',
      summary: 'Look up a company in ARES by IČO',
      tags: ['Business profile'],
    },
  })
    .input(z.object({ ico: z.string().trim().min(1).max(20) }))
    .output(aresSubjectSchema)
    .handler(async ({ input }) => {
      try {
        const subject = await lookupByIco(input.ico)
        if (!subject) throw new ORPCError('NOT_FOUND', { message: 'IČO nebylo v ARES nalezeno' })
        return subject
      } catch (error) {
        if (error instanceof IntegrationError) {
          throw new ORPCError(error.code === 'invalid_input' ? 'BAD_REQUEST' : 'BAD_GATEWAY', {
            message: error.message,
          })
        }
        throw error
      }
    }),
}
