import { z } from 'zod'

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')
const decimal = z
  .union([z.string(), z.number()])
  .transform((v) => String(v).trim().replace(',', '.'))
  .refine((v) => /^-?\d+(\.\d+)?$/.test(v), 'Expected a decimal number')

export const DOCUMENT_TYPES = ['invoice', 'proforma'] as const
export const documentTypeSchema = z.enum(DOCUMENT_TYPES)

export const lineInputSchema = z.object({
  description: z.string().trim().min(1).max(1000),
  quantity: decimal.default('1').describe('Decimal string, e.g. "2.5"'),
  unit: z.string().trim().max(20).nullish().describe('e.g. "ks", "hod"'),
  unitPrice: decimal.default('0').describe('Unit price without VAT, decimal string'),
  vatRate: decimal
    .default('0')
    .describe('VAT rate in percent (21, 12, 0). Ignored for VAT non-payers.'),
  discountPercent: decimal.default('0'),
})

const fields = {
  type: documentTypeSchema,
  contactId: z.string().nullish().describe('Customer (odběratel) contact id'),
  bankAccountId: z.string().nullish().describe('Defaults to the default account of the currency'),
  issueDate: isoDate,
  taxableDate: isoDate.nullish(),
  dueDate: isoDate,
  currency: z
    .string()
    .length(3)
    .transform((v) => v.toUpperCase()),
  exchangeRate: decimal
    .nullish()
    .describe('CZK per 1 unit of currency; required for foreign currency'),
  language: z.enum(['cs', 'sk', 'en']),
  paymentMethod: z.string().max(40),
  constantSymbol: z.string().max(10).nullish(),
  orderNumber: z.string().max(100).nullish(),
  introText: z.string().max(5000).nullish(),
  footerText: z.string().max(5000).nullish(),
  privateNote: z.string().max(5000).nullish().describe('Never shown to the customer'),
  lines: z.array(lineInputSchema).max(200),
}

/** Everything optional except lines; omitted dates/currency/etc. get defaults from the business profile. */
export const draftInputSchema = z.object({
  ...fields,
  type: fields.type.default('invoice'),
  issueDate: fields.issueDate.optional(),
  dueDate: fields.dueDate.optional(),
  currency: fields.currency.optional(),
  language: fields.language.optional(),
  paymentMethod: fields.paymentMethod.optional(),
  lines: fields.lines.default([]),
})

export const draftPatchSchema = z.object(fields).omit({ type: true }).partial()

export const lineSchema = z.object({
  id: z.string(),
  position: z.number(),
  description: z.string(),
  quantity: z.string(),
  unit: z.string().nullable(),
  unitPrice: z.string(),
  vatRate: z.string(),
  discountPercent: z.string(),
  lineSubtotal: z.string(),
  lineVat: z.string(),
  lineTotal: z.string(),
})

export const paymentSchema = z.object({
  id: z.string(),
  paidOn: z.string(),
  amount: z.string(),
  currency: z.string(),
  method: z.string(),
  note: z.string().nullable(),
  createdAt: z.date(),
})

export const DISPLAY_STATUSES = [
  'draft',
  'issued',
  'overdue',
  'partially_paid',
  'paid',
  'cancelled',
] as const
export const displayStatusSchema = z.enum(DISPLAY_STATUSES)
export type DisplayStatus = z.infer<typeof displayStatusSchema>

const snapshot = z.record(z.string(), z.unknown()).nullable()

export const documentSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  type: z.string(),
  number: z.string().nullable(),
  status: z.string(),
  displayStatus: displayStatusSchema,
  contactId: z.string().nullable(),
  bankAccountId: z.string().nullable(),
  supplierSnapshot: snapshot,
  customerSnapshot: snapshot,
  bankSnapshot: snapshot,
  customerName: z.string().nullable(),
  issueDate: z.string().nullable(),
  taxableDate: z.string().nullable(),
  dueDate: z.string().nullable(),
  currency: z.string(),
  exchangeRate: z.string().nullable(),
  language: z.string(),
  paymentMethod: z.string(),
  variableSymbol: z.string().nullable(),
  constantSymbol: z.string().nullable(),
  orderNumber: z.string().nullable(),
  vatMode: z.string(),
  introText: z.string().nullable(),
  footerText: z.string().nullable(),
  privateNote: z.string().nullable(),
  subtotal: z.string(),
  vatTotal: z.string(),
  total: z.string(),
  totalCzk: z.string().nullable(),
  paidAmount: z.string(),
  remaining: z.string(),
  publicToken: z.string().nullable(),
  importedFrom: z.string().nullable().describe('Source system when imported (read-only document)'),
  paidAt: z.date().nullable(),
  cancelledAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export const documentDetailSchema = documentSchema.extend({
  lines: z.array(lineSchema),
  payments: z.array(paymentSchema),
  vatRecap: z.array(
    z.object({ vatRate: z.string(), base: z.string(), vat: z.string(), total: z.string() }),
  ),
  activity: z.array(
    z.object({ id: z.string(), action: z.string(), data: z.unknown(), createdAt: z.date() }),
  ),
})

export const listFilterSchema = z.enum(['all', 'draft', 'unpaid', 'overdue', 'paid', 'cancelled'])

export type DraftInput = z.infer<typeof draftInputSchema>
export type DraftPatch = z.infer<typeof draftPatchSchema>
export type LineInput = z.infer<typeof lineInputSchema>
