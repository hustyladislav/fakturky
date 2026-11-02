import { toolDefinition } from '@tanstack/ai'
import { z } from 'zod'

/**
 * Tools the assistant runs in the browser (navigation / UI). Definitions are shared: the server hands them
 * to the model, the client attaches the `execute` implementation (see assistant/client-tools.ts).
 * Inputs are closed enums so the model can only reach routes that exist.
 */

export const APP_PATHS = [
  '/',
  '/faktury',
  '/faktury/nova',
  '/kontakty',
  '/banka',
  '/nastaveni',
] as const
export const INVOICE_FILTERS = ['all', 'unpaid', 'overdue', 'paid', 'draft'] as const

export const navigateTool = toolDefinition({
  name: 'navigate',
  description:
    'Otevře stránku v aplikaci. Přehled „/“, seznam faktur „/faktury“ (volitelně s filtrem: unpaid, overdue, paid, draft), nová faktura „/faktury/nova“, kontakty „/kontakty“, banka a párování plateb „/banka“, nastavení „/nastaveni“.',
  inputSchema: z.object({
    to: z.enum(APP_PATHS),
    filter: z.enum(INVOICE_FILTERS).optional().describe('Jen pro /faktury'),
    q: z.string().max(100).optional().describe('Hledaný text, jen pro /faktury'),
  }),
  outputSchema: z.object({ ok: z.boolean() }),
})

export const openDocumentTool = toolDefinition({
  name: 'openDocument',
  description: 'Otevře detail faktury nebo zálohové faktury podle jejího ID.',
  inputSchema: z.object({ id: z.string().min(1).max(64) }),
  outputSchema: z.object({ ok: z.boolean() }),
})

export const prefillInvoiceFormTool = toolDefinition({
  name: 'prefillInvoiceForm',
  description:
    'Otevře formulář nové faktury a předvyplní ho. Použij, když chce uživatel fakturu ještě upravit sám; jinak vytvoř koncept nástrojem create_invoice_draft.',
  inputSchema: z.object({
    contactId: z.string().max(64).optional(),
    lines: z
      .array(
        z.object({
          description: z.string().max(300),
          quantity: z.string().max(20).default('1'),
          unitPrice: z.string().max(20),
          vatRate: z.string().max(5).optional(),
        }),
      )
      .max(30)
      .default([]),
    dueDate: z.string().max(10).optional().describe('RRRR-MM-DD'),
  }),
  outputSchema: z.object({ ok: z.boolean() }),
})

export const clientToolDefinitions = [navigateTool, openDocumentTool, prefillInvoiceFormTool]
