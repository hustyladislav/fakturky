import { periodFileLabel } from '@fakturky/domain'
import { z } from 'zod'
import { procedure } from '../orpc'
import { exportsRepo } from './repo'
import { isoDate } from '../documents/schema'

const out = z.object({ filename: z.string(), csv: z.string() })

export const exportsRouter = {
  organization: procedure({
    mcp: {
      name: 'export_organization_json',
      title: 'Export all organization data as JSON (backup / portability)',
      readOnly: true,
    },
    openapi: {
      method: 'GET',
      path: '/exports/organization',
      summary:
        'Full JSON export of the organization (documents, contacts, bank accounts, templates, settings)',
      tags: ['Export'],
    },
  })
    .input(z.object({}))
    .output(z.object({ filename: z.string(), json: z.string() }))
    .handler(async ({ context }) => ({
      filename: 'fakturky-export.json',
      json: await exportsRepo.organizationJson(context.db, context.principal.organizationId),
    })),

  documents: procedure({
    mcp: {
      name: 'export_documents_csv',
      title: 'Export documents as CSV, all or for a period (e.g. for the accountant)',
      readOnly: true,
    },
    openapi: {
      method: 'GET',
      path: '/exports/documents',
      summary:
        'CSV of documents (semicolon-separated, UTF-8). Without from/to: all documents. With a period: issued documents by DUZP (issue date when none), ends inclusive.',
      tags: ['Export'],
    },
  })
    // from/to/type are optional so existing callers keep getting the full export.
    .input(
      z.object({
        from: isoDate.optional().describe('First day of the period, YYYY-MM-DD (inclusive)'),
        to: isoDate.optional().describe('Last day of the period, YYYY-MM-DD (inclusive)'),
        type: z
          .enum(['invoice', 'proforma', 'credit_note', 'payment_receipt'])
          .optional()
          .describe('Only documents of this type'),
      }),
    )
    .output(out)
    .handler(async ({ context, input }) => {
      const label = periodFileLabel(input.from, input.to)
      return {
        filename: label ? `doklady-${label}.csv` : 'doklady.csv',
        csv: await exportsRepo.documentsCsv(context.db, context.principal.organizationId, input),
      }
    }),

  contacts: procedure({
    mcp: { name: 'export_contacts_csv', title: 'Export contacts as CSV', readOnly: true },
    openapi: {
      method: 'GET',
      path: '/exports/contacts',
      summary: 'CSV of contacts (semicolon-separated, UTF-8)',
      tags: ['Export'],
    },
  })
    .input(z.object({}))
    .output(out)
    .handler(async ({ context }) => ({
      filename: 'kontakty.csv',
      csv: await exportsRepo.contactsCsv(context.db, context.principal.organizationId),
    })),
}
