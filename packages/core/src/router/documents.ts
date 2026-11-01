import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { procedure } from '../orpc'
import { DocumentError, documentsRepo } from '../repositories/documents'
import {
  documentDetailSchema,
  documentSchema,
  draftInputSchema,
  draftPatchSchema,
  listFilterSchema,
} from '../schemas/document'

const idInput = z.object({ id: z.string().min(1) })
const tag = ['Documents']

async function guard<T>(fn: () => Promise<T | null>): Promise<T> {
  try {
    const out = await fn()
    if (out === null) throw new ORPCError('NOT_FOUND', { message: 'Document not found' })
    return out
  } catch (e) {
    if (e instanceof DocumentError) throw new ORPCError(e.code, { message: e.message })
    throw e
  }
}

export const documentsRouter = {
  defaults: procedure({
    mcp: {
      name: 'get_invoice_defaults',
      title: 'Defaults for a new invoice (VAT payer?, currency, due days, bank accounts)',
      readOnly: true,
    },
    openapi: {
      method: 'GET',
      path: '/documents/defaults',
      summary: 'Defaults used when creating a new document',
      tags: tag,
    },
  })
    .input(z.object({}))
    .output(
      z.object({
        vatPayer: z.boolean(),
        hasProfile: z.boolean(),
        currency: z.string(),
        dueDays: z.number(),
        language: z.string(),
        paymentMethod: z.string(),
        footerText: z.string().nullable(),
      }),
    )
    .handler(({ context }) => documentsRepo.defaults(context.db, context.principal.organizationId)),

  list: procedure({
    mcp: { name: 'list_documents', title: 'List invoices and proformas', readOnly: true },
    openapi: { method: 'GET', path: '/documents', summary: 'List documents', tags: tag },
  })
    .input(
      z.object({
        filter: listFilterSchema
          .default('all')
          .describe('all | draft | unpaid (issued, not fully paid) | overdue | paid | cancelled'),
        search: z.string().optional().describe('Matches number, variable symbol, customer name'),
        limit: z.coerce.number().int().min(1).max(200).default(50),
        offset: z.coerce.number().int().min(0).default(0),
      }),
    )
    .output(z.array(documentSchema))
    .handler(({ context, input }) =>
      documentsRepo.list(context.db, context.principal.organizationId, input),
    ),

  get: procedure({
    mcp: {
      name: 'get_document',
      title: 'Get a document with lines, payments and history',
      readOnly: true,
    },
    openapi: { method: 'GET', path: '/documents/{id}', summary: 'Get a document', tags: tag },
  })
    .input(idInput)
    .output(documentDetailSchema)
    .handler(({ context, input }) =>
      guard(() => documentsRepo.get(context.db, context.principal.organizationId, input.id)),
    ),

  createDraft: procedure({
    mcp: { name: 'create_invoice_draft', title: 'Create an invoice draft' },
    openapi: {
      method: 'POST',
      path: '/documents',
      summary:
        'Create a draft invoice (or proforma). Dates, currency and bank account default from the business profile.',
      tags: tag,
    },
  })
    .input(draftInputSchema)
    .output(documentDetailSchema)
    .handler(({ context, input }) =>
      guard(() =>
        documentsRepo.createDraft(
          context.db,
          context.principal.organizationId,
          context.principal.userId,
          input,
        ),
      ),
    ),

  updateDraft: procedure({
    mcp: { name: 'update_invoice_draft', title: 'Update an invoice draft', idempotent: true },
    openapi: {
      method: 'PATCH',
      path: '/documents/{id}',
      summary:
        'Update a draft. Passing `lines` replaces all lines. Issued documents are immutable.',
      tags: tag,
    },
  })
    .input(idInput.extend({ patch: draftPatchSchema }))
    .output(documentDetailSchema)
    .handler(({ context, input }) =>
      guard(() =>
        documentsRepo.updateDraft(
          context.db,
          context.principal.organizationId,
          context.principal.userId,
          input.id,
          input.patch,
        ),
      ),
    ),

  issue: procedure({
    mcp: { name: 'issue_invoice', title: 'Issue an invoice (allocates its number)' },
    openapi: {
      method: 'POST',
      path: '/documents/{id}/issue',
      summary:
        'Issue a draft: allocates the document number, variable symbol and snapshots supplier, customer and bank account.',
      tags: tag,
    },
  })
    .input(idInput)
    .output(documentDetailSchema)
    .handler(({ context, input }) =>
      guard(() =>
        documentsRepo.issue(
          context.db,
          context.principal.organizationId,
          context.principal.userId,
          input.id,
        ),
      ),
    ),

  duplicate: procedure({
    mcp: { name: 'duplicate_document', title: 'Duplicate a document as a new draft' },
    openapi: {
      method: 'POST',
      path: '/documents/{id}/duplicate',
      summary: "Copy a document into a new draft with today's dates",
      tags: tag,
    },
  })
    .input(idInput)
    .output(documentDetailSchema)
    .handler(({ context, input }) =>
      guard(() =>
        documentsRepo.duplicate(
          context.db,
          context.principal.organizationId,
          context.principal.userId,
          input.id,
        ),
      ),
    ),

  markPaid: procedure({
    mcp: { name: 'mark_document_paid', title: 'Record a payment on an invoice' },
    openapi: {
      method: 'POST',
      path: '/documents/{id}/paid',
      summary:
        'Record a payment. Omit `amount` to pay the remaining balance; a smaller amount records a partial payment.',
      tags: tag,
    },
  })
    .input(
      idInput.extend({
        amount: z.string().nullish().describe('Decimal string; default = remaining balance'),
        paidOn: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional()
          .describe('YYYY-MM-DD, default today (Prague)'),
        method: z.string().max(40).optional(),
        note: z.string().max(500).nullish(),
      }),
    )
    .output(documentDetailSchema)
    .handler(({ context, input }) => {
      const { id, ...rest } = input
      return guard(() =>
        documentsRepo.markPaid(
          context.db,
          context.principal.organizationId,
          context.principal.userId,
          id,
          rest,
        ),
      )
    }),

  markUnpaid: procedure({
    mcp: {
      name: 'mark_document_unpaid',
      title: 'Undo payments (mark invoice unpaid)',
      destructive: true,
    },
    openapi: {
      method: 'POST',
      path: '/documents/{id}/unpaid',
      summary: 'Remove recorded payments and reopen the invoice',
      tags: tag,
    },
  })
    .input(idInput)
    .output(documentDetailSchema)
    .handler(({ context, input }) =>
      guard(() =>
        documentsRepo.markUnpaid(
          context.db,
          context.principal.organizationId,
          context.principal.userId,
          input.id,
        ),
      ),
    ),

  cancel: procedure({
    mcp: {
      name: 'cancel_document',
      title: 'Cancel (storno) an issued document',
      destructive: true,
    },
    openapi: {
      method: 'POST',
      path: '/documents/{id}/cancel',
      summary: 'Cancel an issued document. The number stays reserved.',
      tags: tag,
    },
  })
    .input(idInput)
    .output(documentDetailSchema)
    .handler(({ context, input }) =>
      guard(() =>
        documentsRepo.cancel(
          context.db,
          context.principal.organizationId,
          context.principal.userId,
          input.id,
        ),
      ),
    ),

  delete: procedure({
    mcp: { name: 'delete_document_draft', title: 'Delete a draft', destructive: true },
    openapi: {
      method: 'DELETE',
      path: '/documents/{id}',
      summary: 'Delete a draft. Issued documents cannot be deleted; cancel them instead.',
      tags: tag,
    },
  })
    .input(idInput)
    .output(idInput)
    .handler(({ context, input }) =>
      guard(() =>
        documentsRepo.deleteDraft(
          context.db,
          context.principal.organizationId,
          context.principal.userId,
          input.id,
        ),
      ),
    ),
}
