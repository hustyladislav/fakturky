import { CSV_FIELDS } from '@fakturky/domain/bank'
import { z } from 'zod'

const money = z.string().describe('Decimal string')

export const suggestionSchema = z.object({
  documentId: z.string(),
  number: z.string().nullable(),
  customerName: z.string().nullable(),
  currency: z.string(),
  total: money,
  remaining: money.describe('Open balance of the document'),
  dueDate: z.string().nullable(),
  score: z.number(),
  reasons: z.array(z.enum(['variable_symbol', 'reference_in_message', 'amount', 'name'])),
})

export const bankTransactionSchema = z.object({
  id: z.string(),
  bankAccountId: z.string(),
  bookedOn: z.string().describe('YYYY-MM-DD'),
  amount: money.describe('Signed decimal string: credit > 0, debit < 0'),
  currency: z.string(),
  variableSymbol: z.string().nullable(),
  constantSymbol: z.string().nullable(),
  specificSymbol: z.string().nullable(),
  counterpartyAccount: z.string().nullable(),
  counterpartyName: z.string().nullable(),
  message: z.string().nullable(),
  source: z.string(),
  matchStatus: z.enum(['unmatched', 'matched', 'ignored']),
  matchedDocumentId: z.string().nullable(),
  matchedDocumentNumber: z.string().nullable(),
  matchedAmount: money.nullable(),
  overpaid: money
    .nullable()
    .describe('Part of a paired payment that exceeded the open balance (overpayment), if any'),
  suggestions: z
    .array(suggestionSchema)
    .describe(
      'Likely documents for an unmatched incoming payment; applying one needs confirmation',
    ),
  createdAt: z.date(),
})

export const bankListInputSchema = z.object({
  bankAccountId: z.string().optional(),
  status: z.enum(['unmatched', 'matched', 'ignored']).optional(),
  direction: z.enum(['credit', 'debit']).optional(),
  search: z.string().max(100).optional(),
  limit: z.number().int().min(1).max(200).default(50),
  offset: z.number().int().min(0).default(0),
})

export const bankListOutputSchema = z.object({
  items: z.array(bankTransactionSchema),
  total: z.number(),
  counts: z
    .object({
      unmatched: z.number(),
      matched: z.number(),
      ignored: z.number(),
      outgoing: z.number(),
    })
    .describe(
      'Per status; unmatched counts incoming payments only, outgoing counts stored debits (never paired)',
    ),
})

export const importStatementInputSchema = z.object({
  bankAccountId: z.string().min(1),
  content: z
    .string()
    .min(1)
    .max(8_000_000)
    .describe('Statement file as text: CSV, ABO/GPC or CAMT.053 XML. The format is detected.'),
  currency: z
    .string()
    .length(3)
    .optional()
    .describe('Currency when a CSV has no currency column (defaults to the account currency)'),
  mapping: z
    .partialRecord(z.enum(CSV_FIELDS), z.string().max(100))
    .optional()
    .describe('CSV only: header name for each field, for exports that are not recognised'),
})

export const IMPORT_OUTCOMES = [
  'matched',
  'suggested',
  'unmatched',
  'outgoing',
  'duplicate',
] as const

const importRowSchema = z.object({
  bookedOn: z.string(),
  amount: money,
  currency: z.string(),
  counterpartyName: z.string().nullable(),
  variableSymbol: z.string().nullable(),
  outcome: z
    .enum(IMPORT_OUTCOMES)
    .describe(
      'matched = paired with an invoice; suggested = a likely invoice awaits confirmation; unmatched = incoming, nothing found; outgoing = debit, stored but never paired; duplicate = already imported',
    ),
  documentNumber: z.string().nullable().describe('Paired or suggested invoice'),
})

export const importStatementOutputSchema = z.object({
  format: z.string(),
  imported: z.number().describe('New transactions stored'),
  duplicates: z.number().describe('Transactions already known (skipped)'),
  warnings: z.array(z.string()).describe('Rows that could not be read and were not stored'),
  autoMatched: z.number().describe('Incoming payments paired with invoices automatically'),
  rows: z
    .array(importRowSchema)
    .describe('What happened to every statement row, in file order (first 500)'),
  rowsTruncated: z.boolean(),
})

export const matchInputSchema = z.object({
  transactionId: z.string().min(1),
  documentId: z.string().min(1),
  amount: z
    .string()
    .optional()
    .describe('Decimal string; default = the whole transaction (capped at the open balance)'),
})

export const matchOutputSchema = z.object({
  documentId: z.string(),
  paymentId: z.string(),
  amount: money.describe('Booked as a payment'),
  full: z.boolean().describe('The document is now fully paid'),
  overpaid: money.describe('Received beyond what was booked'),
})

export const syncOutputSchema = z.object({
  imported: z.number(),
  duplicates: z.number(),
  from: z.string(),
  to: z.string(),
  autoMatched: z.number(),
})
