import type { AnyPgColumn } from 'drizzle-orm/pg-core'
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { organization } from './auth'
import { bankAccount, contact, numberSeries } from './business'
import {
  documentLanguage,
  documentStatus,
  documentType,
  paymentSource,
  recurringFrequency,
  vatMode,
} from './enums'
import { idColumn, money, orgColumn, timestamps } from './helpers'

export type PartySnapshot = Record<string, unknown>

export const document = pgTable(
  'document',
  {
    id: idColumn(),
    organizationId: orgColumn(),
    type: documentType('type').notNull(),
    /** Null while draft; allocated at issue inside the issuing transaction. */
    number: text('number'),
    seriesId: text('series_id').references(() => numberSeries.id),
    status: documentStatus('status').notNull().default('draft'),
    contactId: text('contact_id').references(() => contact.id),
    bankAccountId: text('bank_account_id').references(() => bankAccount.id),
    supplierSnapshot: jsonb('supplier_snapshot').$type<PartySnapshot>(),
    customerSnapshot: jsonb('customer_snapshot').$type<PartySnapshot>(),
    bankSnapshot: jsonb('bank_snapshot').$type<PartySnapshot>(),
    issueDate: text('issue_date'),
    taxableDate: text('taxable_date'),
    dueDate: text('due_date'),
    currency: text('currency').notNull().default('CZK'),
    exchangeRate: numeric('exchange_rate', { precision: 19, scale: 6 }),
    language: documentLanguage('language').notNull().default('cs'),
    paymentMethod: text('payment_method').notNull().default('bank_transfer'),
    variableSymbol: text('variable_symbol'),
    constantSymbol: text('constant_symbol'),
    orderNumber: text('order_number'),
    vatMode: vatMode('vat_mode').notNull().default('none'),
    introText: text('intro_text'),
    footerText: text('footer_text'),
    privateNote: text('private_note'),
    subtotal: money('subtotal').notNull().default('0'),
    vatTotal: money('vat_total').notNull().default('0'),
    total: money('total').notNull().default('0'),
    totalCzk: money('total_czk'),
    rounding: money('rounding').notNull().default('0'),
    /** Round the payable total to whole currency units; the difference is the separate `rounding` line. */
    roundTotal: boolean('round_total').notNull().default(false),
    /** Line prices include VAT (tax receipts for advances: VAT is extracted from the received gross). */
    pricesIncludeVat: boolean('prices_include_vat').notNull().default(false),
    relatedDocumentId: text('related_document_id').references((): AnyPgColumn => document.id),
    /** Set for documents brought in by an import ('fakturoid' | 'csv' | 'isdoc'); they keep their original number. */
    importedFrom: text('imported_from'),
    externalId: text('external_id'),
    publicToken: text('public_token'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('document_org_type_number_uq').on(t.organizationId, t.type, t.number),
    uniqueIndex('document_public_token_uq').on(t.publicToken),
    index('document_org_external_idx').on(t.organizationId, t.importedFrom, t.externalId),
    index('document_org_status_idx').on(t.organizationId, t.status),
    index('document_org_contact_idx').on(t.organizationId, t.contactId),
    index('document_org_due_idx').on(t.organizationId, t.dueDate),
    index('document_org_issue_idx').on(t.organizationId, t.issueDate),
  ],
)

export const documentLine = pgTable(
  'document_line',
  {
    id: idColumn(),
    organizationId: orgColumn(),
    documentId: text('document_id')
      .notNull()
      .references(() => document.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    description: text('description').notNull(),
    quantity: numeric('quantity', { precision: 19, scale: 4 }).notNull().default('1'),
    unit: text('unit'),
    unitPrice: money('unit_price').notNull().default('0'),
    vatRate: numeric('vat_rate', { precision: 5, scale: 2 }).notNull().default('0'),
    /** `standard` (rate applies) or a VAT regime: exempt, reverse_charge, eu_reverse_charge, export, outside_scope. */
    vatTreatment: text('vat_treatment').notNull().default('standard'),
    /** Statutory basis printed under an exempt line (e.g. "§ 51 odst. 1 zákona o DPH"). */
    vatNote: text('vat_note'),
    discountPercent: numeric('discount_percent', { precision: 5, scale: 2 }).notNull().default('0'),
    lineSubtotal: money('line_subtotal').notNull().default('0'),
    lineVat: money('line_vat').notNull().default('0'),
    lineTotal: money('line_total').notNull().default('0'),
    ...timestamps(),
  },
  (t) => [index('document_line_org_doc_idx').on(t.organizationId, t.documentId, t.position)],
)

export const payment = pgTable(
  'payment',
  {
    id: idColumn(),
    organizationId: orgColumn(),
    documentId: text('document_id')
      .notNull()
      .references(() => document.id, { onDelete: 'cascade' }),
    paidOn: text('paid_on').notNull(),
    amount: money('amount').notNull(),
    currency: text('currency').notNull().default('CZK'),
    method: text('method').notNull().default('bank_transfer'),
    note: text('note'),
    source: paymentSource('source').notNull().default('manual'),
    ...timestamps(),
  },
  (t) => [index('payment_org_doc_idx').on(t.organizationId, t.documentId)],
)

export type TemplateBody = {
  contactId?: string | null
  currency?: string
  language?: 'cs' | 'sk' | 'en'
  introText?: string | null
  footerText?: string | null
  lines: Array<{
    description: string
    quantity: string
    unit?: string | null
    unitPrice: string
    vatRate: string
    vatTreatment?: string
    vatNote?: string | null
    discountPercent?: string
  }>
}

export const template = pgTable(
  'template',
  {
    id: idColumn(),
    organizationId: orgColumn(),
    name: text('name').notNull(),
    documentType: documentType('document_type').notNull().default('invoice'),
    body: jsonb('body').$type<TemplateBody>().notNull(),
    ...timestamps(),
  },
  (t) => [index('template_org_idx').on(t.organizationId)],
)

export const recurringRule = pgTable(
  'recurring_rule',
  {
    id: idColumn(),
    organizationId: orgColumn(),
    templateId: text('template_id')
      .notNull()
      .references(() => template.id, { onDelete: 'cascade' }),
    frequency: recurringFrequency('frequency').notNull().default('monthly'),
    dayOfMonth: integer('day_of_month').notNull().default(1),
    nextRunOn: text('next_run_on').notNull(),
    autoIssue: boolean('auto_issue').notNull().default(false),
    autoSend: boolean('auto_send').notNull().default(false),
    active: boolean('active').notNull().default(true),
    ...timestamps(),
  },
  (t) => [index('recurring_rule_org_next_idx').on(t.organizationId, t.active, t.nextRunOn)],
)

export const activity = pgTable(
  'activity',
  {
    id: idColumn(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    actorId: text('actor_id'),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id'),
    action: text('action').notNull(),
    data: jsonb('data').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('activity_org_created_idx').on(t.organizationId, t.createdAt),
    index('activity_org_entity_idx').on(t.organizationId, t.entityType, t.entityId),
  ],
)
