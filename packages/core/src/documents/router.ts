import type { Db } from '@fakturky/db'
import { generateIsdoc } from '@fakturky/domain'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { MailError } from '../context'
import { toDocumentForExport } from './export'
import { procedure } from '../orpc'
import { DocumentError, documentsRepo } from './repo'
import {
  documentDetailSchema,
  documentSchema,
  draftInputSchema,
  draftPatchSchema,
  isoDate,
  listFilterSchema,
} from './schema'
import { renderIssuedPdf } from './pdf'

const idInput = z.object({ id: z.string().min(1) })
const tag = ['Documents']
// Optional so existing callers (REST, MCP, CLI) keep listing everything.
const periodFrom = isoDate
  .optional()
  .describe(
    'First day of a period, YYYY-MM-DD, by DUZP (issue date when none). A period excludes drafts.',
  )
const periodTo = isoDate.optional().describe('Last day of the period, YYYY-MM-DD (inclusive)')
const statBucket = z.object({ count: z.number(), sum: z.string().describe('CZK, decimal string') })

async function guard<T>(fn: () => Promise<T | null>): Promise<T> {
  try {
    const out = await fn()
    if (out === null) throw new ORPCError('NOT_FOUND', { message: 'Document not found' })
    return out
  } catch (e) {
    if (e instanceof DocumentError) {
      throw new ORPCError(e.code, {
        message: e.message,
        ...(e.fields ? { data: { fields: e.fields } } : {}),
      })
    }
    if (e instanceof MailError) {
      throw new ORPCError('SERVICE_UNAVAILABLE', { message: e.reason, data: { reason: e.reason } })
    }
    throw e
  }
}

/** Drafts produced on the assistant's behalf (duplicate, credit note, …) carry the same provenance as createDraft. */
async function assistantTag<T extends { id: string } | null>(
  context: { db: Db; principal: { organizationId: string; via: string } },
  doc: T,
): Promise<T> {
  if (!doc || context.principal.via !== 'assistant') return doc
  await documentsRepo.tagAssistant(context.db, context.principal.organizationId, doc.id)
  return { ...doc, viaAssistant: true } as T
}

export const documentsRouter = {
  createPaymentReceipt: procedure({
    mcp: {
      name: 'create_payment_receipt',
      title:
        'Create the tax receipt (daňový doklad k přijaté platbě) for a paid proforma — VAT payers',
    },
    openapi: {
      method: 'POST',
      path: '/documents/{id}/payment-receipt',
      summary:
        'Draft tax receipt for the advance received on a paid proforma. The paid amount is treated as VAT-inclusive at the chosen rate. Issue it, then create the final invoice.',
      tags: tag,
    },
  })
    .input(
      idInput.extend({
        vatRate: z.enum(['21', '12']).default('21'),
        allocations: z
          .array(
            z.object({
              vatRate: z.enum(['21', '12']),
              amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
            }),
          )
          .min(1)
          .max(2)
          .optional()
          .describe(
            'Split the received amount over both VAT rates; must add up to the amount received',
          ),
      }),
    )
    .output(documentDetailSchema)
    .handler(({ context, input }) =>
      guard(() =>
        documentsRepo.createPaymentReceipt(
          context.db,
          context.principal.organizationId,
          context.principal.userId,
          input.id,
          input.vatRate,
          input.allocations,
        ),
      ),
    ),

  createFinalInvoice: procedure({
    mcp: {
      name: 'create_final_invoice_from_proforma',
      title: 'Create the final invoice for a paid proforma (advance deducted)',
    },
    openapi: {
      method: 'POST',
      path: '/documents/{id}/final-invoice',
      summary:
        'Draft invoice from a fully paid proforma: same lines plus a negative line for the paid advance. Edit, then issue.',
      tags: tag,
    },
  })
    .input(idInput)
    .output(documentDetailSchema)
    .handler(({ context, input }) =>
      guard(async () => {
        const doc = await documentsRepo.createFinalInvoice(
          context.db,
          context.principal.organizationId,
          context.principal.userId,
          input.id,
        )
        return assistantTag(context, doc)
      }),
    ),

  createCreditNote: procedure({
    mcp: {
      name: 'create_credit_note',
      title: 'Create a credit note (opravný doklad) draft correcting an issued invoice',
    },
    openapi: {
      method: 'POST',
      path: '/documents/{id}/credit-note',
      summary:
        'Create a draft credit note for an issued invoice: reverses all lines, or only `amount` (VAT-inclusive, spread over the VAT rates in proportion). Then issue it.',
      tags: tag,
    },
  })
    .input(
      idInput.extend({
        reason: z.string().max(1000).nullish().describe('Shown on the document'),
        amount: z
          .string()
          .nullish()
          .describe(
            'VAT-inclusive amount to credit, in the invoice currency; omit to reverse the whole invoice',
          ),
      }),
    )
    .output(documentDetailSchema)
    .handler(({ context, input }) =>
      guard(async () => {
        const doc = await documentsRepo.createCreditNote(
          context.db,
          context.principal.organizationId,
          context.principal.userId,
          input.id,
          input.reason,
          input.amount,
        )
        return assistantTag(context, doc)
      }),
    ),

  send: procedure({
    mcp: {
      name: 'send_invoice_email',
      title: 'E-mail an issued invoice (PDF attached + public link) to the customer',
      destructive: true,
    },
    openapi: {
      method: 'POST',
      path: '/documents/{id}/send',
      summary:
        "E-mail an issued invoice. Defaults to the customer's first e-mail. Set `reminder` for an overdue reminder.",
      tags: tag,
    },
  })
    .input(
      idInput.extend({
        to: z.email().optional(),
        message: z
          .string()
          .max(2000)
          .nullish()
          .describe('Optional personal note shown in the e-mail'),
        reminder: z.boolean().default(false),
      }),
    )
    .output(documentDetailSchema)
    .handler(({ context, input }) =>
      guard(() =>
        documentsRepo.send(
          context.db,
          context.principal.organizationId,
          context.principal.userId,
          input.id,
          context.services,
          { to: input.to, message: input.message, reminder: input.reminder },
        ),
      ),
    ),

  pdf: procedure({
    mcp: {
      name: 'export_document_pdf',
      title: 'Render an issued document as PDF (base64)',
      readOnly: true,
    },
    openapi: {
      method: 'GET',
      path: '/documents/{id}/pdf',
      summary:
        'PDF of an issued document as base64 (the web app also serves raw bytes at /api/documents/{id}/pdf)',
      tags: tag,
    },
  })
    .input(idInput)
    .output(z.object({ filename: z.string(), contentBase64: z.string() }))
    .handler(async ({ context, input }) => {
      const render = context.services?.renderPdf
      if (!render)
        throw new ORPCError('NOT_IMPLEMENTED', { message: 'PDF rendering is not available' })
      const found = await documentsRepo.forExport(
        context.db,
        context.principal.organizationId,
        input.id,
      )
      if (!found) throw new ORPCError('NOT_FOUND', { message: 'Issued document not found' })
      const bytes = await renderIssuedPdf(context.db, render, found)
      return {
        filename: `${found.doc.number ?? 'faktura'}.pdf`,
        contentBase64: Buffer.from(bytes).toString('base64'),
      }
    }),

  isdoc: procedure({
    mcp: {
      name: 'export_document_isdoc',
      title: 'Export an issued document as ISDOC XML',
      readOnly: true,
    },
    openapi: {
      method: 'GET',
      path: '/documents/{id}/isdoc',
      summary: 'ISDOC 6.0.2 XML of an issued document',
      tags: tag,
    },
  })
    .input(idInput)
    .output(z.object({ filename: z.string(), xml: z.string() }))
    .handler(async ({ context, input }) => {
      const found = await documentsRepo.forExport(
        context.db,
        context.principal.organizationId,
        input.id,
      )
      if (!found) throw new ORPCError('NOT_FOUND', { message: 'Issued document not found' })
      return {
        filename: `${found.doc.number ?? 'faktura'}.isdoc`,
        xml: generateIsdoc(toDocumentForExport(found.doc, found.lines, found.original)),
      }
    }),

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
        registryNoteMissing: z.boolean(),
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
        type: z
          .enum(['invoice', 'proforma', 'credit_note', 'payment_receipt'])
          .optional()
          .describe('Only documents of this type'),
        contactId: z.string().min(1).optional().describe('Only documents of this contact'),
        from: periodFrom,
        to: periodTo,
        sort: z
          .enum(['issueDate', 'dueDate', 'number', 'customer', 'total'])
          .default('issueDate')
          .describe('Sort column (default: issue date)'),
        dir: z.enum(['asc', 'desc']).default('desc'),
        limit: z.coerce.number().int().min(1).max(200).default(50),
        offset: z.coerce.number().int().min(0).default(0),
      }),
    )
    .output(z.array(documentSchema))
    .handler(({ context, input }) =>
      documentsRepo.list(context.db, context.principal.organizationId, input),
    ),

  stats: procedure({
    mcp: {
      name: 'get_document_stats',
      title: 'Counts and CZK sums of documents per status (all, draft, unpaid, overdue, paid)',
      readOnly: true,
    },
    openapi: {
      method: 'GET',
      path: '/documents/stats',
      summary:
        'Counts and CZK sums per status bucket; unpaid and overdue sum what is still owed. Optional search, type and period (from/to) narrow all buckets.',
      tags: tag,
    },
  })
    .input(
      z.object({
        search: z.string().optional().describe('Matches number, variable symbol, customer name'),
        type: z
          .enum(['invoice', 'proforma', 'credit_note', 'payment_receipt'])
          .optional()
          .describe('Only documents of this type'),
        from: periodFrom,
        to: periodTo,
      }),
    )
    .output(
      z.object({
        all: statBucket,
        draft: statBucket,
        unpaid: statBucket,
        overdue: statBucket,
        paid: statBucket,
      }),
    )
    .handler(({ context, input }) =>
      documentsRepo.stats(context.db, context.principal.organizationId, input),
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
          {},
          context.principal.via === 'assistant' ? 'assistant' : undefined,
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
      guard(async () => {
        const doc = await documentsRepo.duplicate(
          context.db,
          context.principal.organizationId,
          context.principal.userId,
          input.id,
        )
        return assistantTag(context, doc)
      }),
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
        paidOn: isoDate.optional().describe('YYYY-MM-DD, default today (Prague)'),
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
      summary:
        'Remove recorded payments and reopen the invoice. With `paymentId`, remove only that payment.',
      tags: tag,
    },
  })
    .input(
      idInput.extend({ paymentId: z.string().optional().describe('Remove just this payment') }),
    )
    .output(documentDetailSchema)
    .handler(({ context, input }) =>
      guard(() =>
        documentsRepo.markUnpaid(
          context.db,
          context.principal.organizationId,
          context.principal.userId,
          input.id,
          input.paymentId,
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

  rotateLink: procedure({
    mcp: {
      name: 'rotate_document_public_link',
      title: 'Revoke the public link of an issued document and create a new one',
      destructive: true,
    },
    openapi: {
      method: 'POST',
      path: '/documents/{id}/rotate-link',
      summary:
        'Invalidate the current public link (/f/:token) and issue a new one. Use when a link leaked or was sent to the wrong person.',
      tags: tag,
    },
  })
    .input(idInput)
    .output(documentDetailSchema)
    .handler(({ context, input }) =>
      guard(() =>
        documentsRepo.rotatePublicToken(
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
