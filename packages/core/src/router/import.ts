import { IntegrationError } from '@fakturky/domain'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { contactsFromCsv, invoicesFromCsv } from '../import/csv'
import { FakturoidClient } from '../import/fakturoid'
import { parseIsdoc } from '../import/isdoc'
import type { ImportBatch, ImportIssue, ImportSummary } from '../import/types'
import { procedure } from '../orpc'
import { importRepo } from '../repositories/import'

const tag = ['Import']

const summarySchema = z.object({
  dryRun: z.boolean(),
  contacts: z.object({ created: z.number(), skipped: z.number() }),
  documents: z.object({ created: z.number(), skipped: z.number(), failed: z.number() }),
  numberingAdjusted: z
    .number()
    .describe('Number series whose counter was raised to continue after the imported numbers'),
  issues: z.array(
    z.object({
      kind: z.enum(['contact', 'document']),
      ref: z.string(),
      level: z.enum(['skipped', 'failed', 'warning']),
      message: z.string(),
    }),
  ),
})

const dryRun = z
  .boolean()
  .default(false)
  .describe('Preview only: compute the result and roll everything back')

export const importRouter = {
  fakturoid: procedure({
    mcp: {
      name: 'import_from_fakturoid',
      title: 'Import contacts and invoices from a Fakturoid account (API v3)',
      description:
        "Imports contacts and issued invoices/proformas from the user's own Fakturoid account using their API client id/secret (Fakturoid → Settings → User account). Invoices keep their original numbers and are marked as imported. Idempotent; use dryRun first. The credentials are used once and never stored.",
    },
    openapi: {
      method: 'POST',
      path: '/import/fakturoid',
      summary:
        'Import contacts and invoices from Fakturoid with the user’s own API credentials (used once, never stored)',
      tags: tag,
    },
  })
    .input(
      z.object({
        accountSlug: z
          .string()
          .trim()
          .min(1)
          .max(100)
          .describe('Fakturoid account slug (URL part)'),
        clientId: z.string().trim().min(1).max(200),
        clientSecret: z.string().trim().min(1).max(500),
        contactEmail: z.email().optional().describe('Sent in the User-Agent header to Fakturoid'),
        contacts: z.boolean().default(true),
        invoices: z.boolean().default(true),
        dryRun,
      }),
    )
    .output(summarySchema)
    .handler(async ({ context, input }): Promise<ImportSummary> => {
      const issues: ImportIssue[] = []
      const batch: ImportBatch = { contacts: [], documents: [] }
      try {
        const client = new FakturoidClient(
          {
            accountSlug: input.accountSlug,
            clientId: input.clientId,
            clientSecret: input.clientSecret,
            contactEmail: input.contactEmail,
          },
          context.services?.fetch,
        )
        if (input.contacts || input.invoices) batch.contacts = await client.subjects()
        if (input.invoices) {
          const { documents, unsupported } = await client.invoices()
          batch.documents = documents
          for (const ref of unsupported) {
            issues.push({
              kind: 'document',
              ref,
              level: 'skipped',
              message: 'Corrections and tax documents for received payments are not supported yet',
            })
          }
        } else {
          batch.documents = []
        }
        if (!input.contacts) batch.contacts = []
      } catch (e) {
        if (e instanceof IntegrationError) {
          throw new ORPCError('BAD_REQUEST', { message: e.message })
        }
        throw e
      }
      const summary = await importRepo.run(
        context.db,
        context.principal.organizationId,
        context.principal.userId,
        'fakturoid',
        batch,
        { dryRun: input.dryRun },
      )
      summary.issues.unshift(...issues)
      return summary
    }),

  file: procedure({
    mcp: {
      name: 'import_from_file',
      title: 'Import contacts or invoices from CSV or ISDOC content',
      description:
        'Imports from file content passed as text. CSV: `kind` "contacts" (columns name, ico, dic, email, phone, street, city, zip, country, note) or "invoices" (one row per line; rows sharing `number` form one invoice; columns number, type, issue_date, due_date, currency, customer, customer_ico, description, quantity, unit_price, vat_rate, paid_on). ISDOC: one invoice XML. Invoices keep their original numbers. Idempotent; use dryRun first.',
    },
    openapi: {
      method: 'POST',
      path: '/import/file',
      summary: 'Import contacts or invoices from CSV or ISDOC content (sent as text)',
      tags: tag,
    },
  })
    .input(
      z.object({
        format: z.enum(['csv', 'isdoc']),
        kind: z
          .enum(['contacts', 'invoices'])
          .default('invoices')
          .describe('What the CSV contains; ISDOC is always one invoice'),
        content: z.string().min(1).max(5_000_000).describe('File content as text (UTF-8)'),
        dryRun,
      }),
    )
    .output(summarySchema)
    .handler(async ({ context, input }): Promise<ImportSummary> => {
      const issues: ImportIssue[] = []
      const batch: ImportBatch = { contacts: [], documents: [] }
      let source: 'csv' | 'isdoc' = input.format

      if (input.format === 'isdoc') {
        const parsed = parseIsdoc(input.content)
        if (!parsed.ok) throw new ORPCError('BAD_REQUEST', { message: parsed.reason })
        batch.documents = [parsed.document]
      } else if (input.kind === 'contacts') {
        batch.contacts = contactsFromCsv(input.content)
        if (batch.contacts.length === 0) {
          throw new ORPCError('BAD_REQUEST', {
            message: 'No contacts found (is there a name column?)',
          })
        }
      } else {
        const parsed = invoicesFromCsv(input.content)
        batch.documents = parsed.documents
        for (const p of parsed.problems) {
          issues.push({ kind: 'document', ref: p.number, level: 'failed', message: p.message })
        }
        if (parsed.documents.length === 0 && parsed.problems.length === 0) {
          throw new ORPCError('BAD_REQUEST', {
            message: 'No invoices found (is there a number column?)',
          })
        }
      }
      source = input.format

      const summary = await importRepo.run(
        context.db,
        context.principal.organizationId,
        context.principal.userId,
        source,
        batch,
        { dryRun: input.dryRun },
      )
      summary.issues.unshift(...issues)
      summary.documents.failed += issues.filter((i) => i.level === 'failed').length
      return summary
    }),
}
