import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { procedure } from '../orpc'
import { DocumentError } from '../repositories/documents'
import { numberSeriesRepo } from '../repositories/number-series'

const tag = ['Number series']
const seriesSchema = z.object({
  id: z.string(),
  documentType: z.string(),
  name: z.string(),
  pattern: z.string(),
  reset: z.enum(['yearly', 'never', 'monthly']).or(z.string()),
  isDefault: z.boolean(),
  nextValue: z.number(),
  nextNumber: z.string().describe('The number the next issued document will get'),
})

async function guard<T>(fn: () => Promise<T | null>): Promise<T> {
  try {
    const out = await fn()
    if (out === null) throw new ORPCError('NOT_FOUND', { message: 'Series not found' })
    return out
  } catch (e) {
    if (e instanceof DocumentError) throw new ORPCError(e.code, { message: e.message })
    throw e
  }
}

export const numberSeriesRouter = {
  list: procedure({
    mcp: {
      name: 'list_number_series',
      title: 'List document number series with the next number',
      readOnly: true,
    },
    openapi: {
      method: 'GET',
      path: '/number-series',
      summary: 'List number series (created with defaults on first use)',
      tags: tag,
    },
  })
    .input(z.object({}))
    .output(z.array(seriesSchema))
    .handler(({ context }) => numberSeriesRepo.list(context.db, context.principal.organizationId)),

  update: procedure({
    mcp: {
      name: 'update_number_series',
      title: 'Change a number series name or pattern, e.g. {YYYY}-{NNNN}',
      idempotent: true,
    },
    openapi: {
      method: 'PATCH',
      path: '/number-series/{id}',
      summary: 'Change the name or pattern of a number series',
      tags: tag,
    },
  })
    .input(
      z.object({
        id: z.string().min(1),
        name: z.string().trim().min(1).max(100).optional(),
        pattern: z
          .string()
          .trim()
          .min(3)
          .max(60)
          .optional()
          .describe(
            'Tokens: {YYYY} {YY} {MM} and exactly one counter {NNNN}; a yearly series needs a year token',
          ),
      }),
    )
    .output(seriesSchema)
    .handler(({ context, input }) => {
      const { id, ...patch } = input
      return guard(() =>
        numberSeriesRepo.update(context.db, context.principal.organizationId, id, patch),
      )
    }),

  setNext: procedure({
    mcp: {
      name: 'set_next_document_number',
      title: 'Continue numbering from a higher number (never lowers)',
      idempotent: true,
    },
    openapi: {
      method: 'POST',
      path: '/number-series/{id}/next',
      summary: 'Raise the next counter value, e.g. when moving from another invoicing tool',
      tags: tag,
    },
  })
    .input(z.object({ id: z.string().min(1), value: z.number().int().min(1).max(99_999_999) }))
    .output(seriesSchema)
    .handler(({ context, input }) =>
      guard(() =>
        numberSeriesRepo.setNext(
          context.db,
          context.principal.organizationId,
          input.id,
          input.value,
        ),
      ),
    ),
}
