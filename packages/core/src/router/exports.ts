import { z } from 'zod'
import { procedure } from '../orpc'
import { exportsRepo } from '../repositories/exports'

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
    mcp: { name: 'export_documents_csv', title: 'Export all documents as CSV', readOnly: true },
    openapi: {
      method: 'GET',
      path: '/exports/documents',
      summary: 'CSV of all documents (semicolon-separated, UTF-8)',
      tags: ['Export'],
    },
  })
    .input(z.object({}))
    .output(out)
    .handler(async ({ context }) => ({
      filename: 'doklady.csv',
      csv: await exportsRepo.documentsCsv(context.db, context.principal.organizationId),
    })),

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
