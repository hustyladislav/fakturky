import { z } from 'zod'
import { procedure } from '../orpc'
import { searchRepo } from './repo'
import { displayStatusSchema } from '../documents/schema'

export const searchRouter = {
  global: procedure({
    mcp: {
      name: 'search_workspace',
      title: 'Search invoices and contacts at once',
      description:
        'One call for "find anything": matches document number, variable symbol, customer name, IČO and amount, ignoring case and diacritics. An empty query returns the most recent documents and contacts.',
      readOnly: true,
    },
    openapi: {
      method: 'GET',
      path: '/search',
      summary: 'Search documents and contacts (command palette)',
      tags: ['Search'],
    },
  })
    .input(
      z.object({
        query: z.string().max(200).default('').describe('Free text; empty returns recent items'),
        limit: z.coerce.number().int().min(1).max(100).default(6).describe('Max items per group'),
      }),
    )
    .output(
      z.object({
        documents: z.array(
          z.object({
            id: z.string(),
            number: z.string().nullable(),
            type: z.string(),
            status: z.string(),
            displayStatus: displayStatusSchema,
            customerName: z.string().nullable(),
            variableSymbol: z.string().nullable(),
            total: z.string(),
            currency: z.string(),
            dueDate: z.string().nullable(),
            issueDate: z.string().nullable(),
            viaAssistant: z.boolean(),
          }),
        ),
        contacts: z.array(
          z.object({ id: z.string(), name: z.string(), ico: z.string().nullable() }),
        ),
      }),
    )
    .handler(({ context, input }) =>
      searchRepo.global(context.db, context.principal.organizationId, input),
    ),
}
