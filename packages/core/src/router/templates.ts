import type { Db } from '@fakturky/db'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { procedure } from '../orpc'
import { DocumentError, documentsRepo } from '../repositories/documents'
import { recurringRepo, templatesRepo } from '../repositories/templates'
import { documentDetailSchema, isoDate } from '../schemas/document'

const idInput = z.object({ id: z.string().min(1) })
const tag = ['Templates']

async function guard<T>(fn: () => Promise<T | null>, what = 'Not found'): Promise<T> {
  try {
    const out = await fn()
    if (out === null) throw new ORPCError('NOT_FOUND', { message: what })
    return out
  } catch (e) {
    if (e instanceof DocumentError) throw new ORPCError(e.code, { message: e.message })
    throw e
  }
}

const templateSchema = z.object({
  id: z.string(),
  name: z.string(),
  documentType: z.string(),
  body: z
    .object({
      contactId: z.string().nullish(),
      currency: z.string().optional(),
      lines: z.array(
        z
          .object({
            description: z.string(),
            quantity: z.string(),
            unitPrice: z.string(),
            vatRate: z.string(),
          })
          .loose(),
      ),
    })
    .loose(),
  createdAt: z.date(),
})

const ruleSchema = z.object({
  id: z.string(),
  templateId: z.string(),
  templateName: z.string().optional(),
  frequency: z.enum(['monthly', 'quarterly', 'yearly']),
  dayOfMonth: z.number(),
  nextRunOn: z.string(),
  autoIssue: z.boolean(),
  autoSend: z.boolean(),
  active: z.boolean(),
})

async function assistantTag<T extends { id: string } | null>(
  context: { db: Db; principal: { organizationId: string; via: string } },
  doc: T,
): Promise<T> {
  if (!doc || context.principal.via !== 'assistant') return doc
  await documentsRepo.tagAssistant(context.db, context.principal.organizationId, doc.id)
  return { ...doc, viaAssistant: true } as T
}

export const templatesRouter = {
  list: procedure({
    mcp: { name: 'list_templates', title: 'List invoice templates', readOnly: true },
    openapi: { method: 'GET', path: '/templates', summary: 'List invoice templates', tags: tag },
  })
    .input(z.object({}))
    .output(z.array(templateSchema))
    .handler(({ context }) => templatesRepo.list(context.db, context.principal.organizationId)),

  createFromDocument: procedure({
    mcp: { name: 'save_invoice_as_template', title: 'Save a document as a reusable template' },
    openapi: {
      method: 'POST',
      path: '/templates',
      summary: 'Save a document as a template',
      tags: tag,
    },
  })
    .input(z.object({ documentId: z.string().min(1), name: z.string().trim().min(1).max(100) }))
    .output(templateSchema)
    .handler(({ context, input }) =>
      guard(() =>
        templatesRepo.createFromDocument(
          context.db,
          context.principal.organizationId,
          input.name,
          input.documentId,
        ),
      ),
    ),

  use: procedure({
    mcp: { name: 'create_invoice_from_template', title: 'Create a draft invoice from a template' },
    openapi: {
      method: 'POST',
      path: '/templates/{id}/use',
      summary: "Create a draft with today's dates from a template",
      tags: tag,
    },
  })
    .input(idInput)
    .output(documentDetailSchema)
    .handler(({ context, input }) =>
      guard(async () => {
        const doc = await templatesRepo.use(
          context.db,
          context.principal.organizationId,
          context.principal.userId,
          input.id,
        )
        return assistantTag(context, doc)
      }),
    ),

  delete: procedure({
    mcp: { name: 'delete_template', title: 'Delete a template', destructive: true },
    openapi: {
      method: 'DELETE',
      path: '/templates/{id}',
      summary: 'Delete a template and its recurring rules',
      tags: tag,
    },
  })
    .input(idInput)
    .output(idInput)
    .handler(async ({ context, input }) => {
      const row = await templatesRepo.remove(context.db, context.principal.organizationId, input.id)
      if (!row) throw new ORPCError('NOT_FOUND', { message: 'Template not found' })
      return { id: row.id }
    }),
}

export const recurringRouter = {
  list: procedure({
    mcp: { name: 'list_recurring_invoices', title: 'List recurring invoice rules', readOnly: true },
    openapi: {
      method: 'GET',
      path: '/recurring',
      summary: 'List recurring rules',
      tags: ['Recurring'],
    },
  })
    .input(z.object({}))
    .output(z.array(ruleSchema))
    .handler(({ context }) => recurringRepo.list(context.db, context.principal.organizationId)),

  create: procedure({
    mcp: {
      name: 'create_recurring_invoice',
      title: 'Repeat a template monthly/quarterly/yearly (optionally auto-issue)',
    },
    openapi: {
      method: 'POST',
      path: '/recurring',
      summary: 'Create a recurring rule from a template',
      tags: ['Recurring'],
    },
  })
    .input(
      z.object({
        templateId: z.string().min(1),
        frequency: z.enum(['monthly', 'quarterly', 'yearly']).default('monthly'),
        dayOfMonth: z.number().int().min(1).max(31).default(1),
        startOn: isoDate.optional().describe('First run on or after this date (default today)'),
        autoIssue: z
          .boolean()
          .default(false)
          .describe('Issue automatically instead of leaving a draft'),
        autoSend: z.boolean().default(false).describe('E-mail the issued invoice to the customer'),
      }),
    )
    .output(ruleSchema)
    .handler(({ context, input }) =>
      guard(() => recurringRepo.create(context.db, context.principal.organizationId, input)),
    ),

  update: procedure({
    mcp: {
      name: 'update_recurring_invoice',
      title: 'Pause/resume or change a recurring rule',
      idempotent: true,
    },
    openapi: {
      method: 'PATCH',
      path: '/recurring/{id}',
      summary: 'Update a recurring rule',
      tags: ['Recurring'],
    },
  })
    .input(
      idInput.extend({
        active: z.boolean().optional(),
        autoIssue: z.boolean().optional(),
        autoSend: z.boolean().optional(),
      }),
    )
    .output(ruleSchema)
    .handler(({ context, input }) => {
      const { id, ...patch } = input
      return guard(() =>
        recurringRepo.update(context.db, context.principal.organizationId, id, patch),
      )
    }),

  delete: procedure({
    mcp: { name: 'delete_recurring_invoice', title: 'Delete a recurring rule', destructive: true },
    openapi: {
      method: 'DELETE',
      path: '/recurring/{id}',
      summary: 'Delete a recurring rule',
      tags: ['Recurring'],
    },
  })
    .input(idInput)
    .output(idInput)
    .handler(async ({ context, input }) => {
      const row = await recurringRepo.remove(context.db, context.principal.organizationId, input.id)
      if (!row) throw new ORPCError('NOT_FOUND', { message: 'Rule not found' })
      return { id: row.id }
    }),
}
