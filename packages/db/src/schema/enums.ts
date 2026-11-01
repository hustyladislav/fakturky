import { pgEnum } from 'drizzle-orm/pg-core'

export const vatStatus = pgEnum('vat_status', ['non_payer', 'payer', 'identified_person'])
export const documentType = pgEnum('document_type', [
  'invoice',
  'proforma',
  'credit_note',
  'payment_receipt',
  'estimate',
])
export const documentStatus = pgEnum('document_status', ['draft', 'issued', 'paid', 'cancelled'])
export const vatMode = pgEnum('vat_mode', [
  'none',
  'standard',
  'reverse_charge',
  'eu_reverse_charge',
  'oss',
])
export const numberReset = pgEnum('number_reset', ['yearly', 'never'])
export const paymentSource = pgEnum('payment_source', ['manual', 'bank'])
export const recurringFrequency = pgEnum('recurring_frequency', ['monthly', 'quarterly', 'yearly'])
export const documentLanguage = pgEnum('document_language', ['cs', 'sk', 'en'])
