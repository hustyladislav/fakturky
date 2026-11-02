import { sql } from 'drizzle-orm'
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
import { documentLanguage, numberReset, vatStatus } from './enums'
import { idColumn, orgColumn, timestamps } from './helpers'

export type Address = {
  street?: string
  city?: string
  zip?: string
  country?: string
}

export const businessProfile = pgTable('business_profile', {
  id: idColumn(),
  organizationId: text('organization_id')
    .notNull()
    .unique()
    .references(() => organization.id, { onDelete: 'cascade' }),
  legalName: text('legal_name').notNull(),
  ico: text('ico'),
  dic: text('dic'),
  address: jsonb('address').$type<Address>().notNull().default({}),
  vatStatus: vatStatus('vat_status').notNull().default('non_payer'),
  registryNote: text('registry_note'),
  email: text('email'),
  phone: text('phone'),
  website: text('website'),
  logoKey: text('logo_key'),
  signatureKey: text('signature_key'),
  defaultCurrency: text('default_currency').notNull().default('CZK'),
  defaultDueDays: integer('default_due_days').notNull().default(14),
  defaultLanguage: documentLanguage('default_language').notNull().default('cs'),
  defaultPaymentMethod: text('default_payment_method').notNull().default('bank_transfer'),
  defaultFooter: text('default_footer'),
  defaultNote: text('default_note'),
  /** Opt-in: e-mail payment reminders for overdue invoices (3, 10 and 17 days after the due date). */
  autoRemind: boolean('auto_remind').notNull().default(false),
  /** Hex colour (#RRGGBB) of the document accent; null = brand default. */
  accentColor: text('accent_color'),
  /** Print the small "issued with …" line on documents. */
  showBrand: boolean('show_brand').notNull().default(true),
  /** Set when the user finishes (or skips) onboarding; null sends them to the onboarding screen. */
  onboardedAt: timestamp('onboarded_at', { withTimezone: true }),
  ...timestamps(),
})

/** Private per-organization images (logo, signature). Stored in the database, only ever served through the app. */
export const orgAsset = pgTable(
  'org_asset',
  {
    id: idColumn(),
    organizationId: orgColumn(),
    kind: text('kind').notNull(),
    contentType: text('content_type').notNull(),
    /** Base64 of the PNG/JPEG bytes (size-limited at the procedure boundary). */
    data: text('data').notNull(),
    /** Replaced or removed images are kept (issued documents reference the version they were issued with). */
    supersededAt: timestamp('superseded_at', { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('org_asset_org_kind_current_uq')
      .on(t.organizationId, t.kind)
      .where(sql`${t.supersededAt} is null`),
  ],
)

export const bankAccount = pgTable(
  'bank_account',
  {
    id: idColumn(),
    organizationId: orgColumn(),
    label: text('label').notNull(),
    currency: text('currency').notNull().default('CZK'),
    accountNumber: text('account_number'),
    bankCode: text('bank_code'),
    iban: text('iban'),
    bic: text('bic'),
    isDefault: boolean('is_default').notNull().default(false),
    defaultForCurrency: boolean('default_for_currency').notNull().default(false),
    showQr: boolean('show_qr').notNull().default(true),
    /** Fio read-only API token, AES-256-GCM encrypted with `ENCRYPTION_KEY` (never returned to clients). */
    fioTokenEncrypted: text('fio_token_encrypted'),
    /** Last Fio request, kept in the DB so the 1 request / 30 s limit holds across serverless instances. */
    fioLastRequestAt: timestamp('fio_last_request_at', { withTimezone: true }),
    fioLastSyncedAt: timestamp('fio_last_synced_at', { withTimezone: true }),
    /** Statement coverage reached by the last successful sync (YYYY-MM-DD); the next sync resumes from here. */
    fioSyncedThrough: text('fio_synced_through'),
    fioLastError: text('fio_last_error'),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [index('bank_account_org_idx').on(t.organizationId)],
)

export const contact = pgTable(
  'contact',
  {
    id: idColumn(),
    organizationId: orgColumn(),
    name: text('name').notNull(),
    ico: text('ico'),
    dic: text('dic'),
    icDph: text('ic_dph'),
    address: jsonb('address').$type<Address>().notNull().default({}),
    country: text('country').notNull().default('CZ'),
    emails: jsonb('emails').$type<string[]>().notNull().default([]),
    phone: text('phone'),
    defaultDueDays: integer('default_due_days'),
    defaultCurrency: text('default_currency'),
    defaultLanguage: documentLanguage('default_language'),
    note: text('note'),
    /** Id in the system this contact was imported from (e.g. Fakturoid subject id). */
    externalId: text('external_id'),
    aresSyncedAt: timestamp('ares_synced_at', { withTimezone: true }),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    index('contact_org_idx').on(t.organizationId, t.archivedAt),
    index('contact_org_name_idx').on(t.organizationId, t.name),
    index('contact_org_ico_idx').on(t.organizationId, t.ico),
  ],
)

export const numberSeries = pgTable(
  'number_series',
  {
    id: idColumn(),
    organizationId: orgColumn(),
    documentType: text('document_type').notNull(),
    name: text('name').notNull(),
    pattern: text('pattern').notNull().default('{YYYY}{NNNN}'),
    reset: numberReset('reset').notNull().default('yearly'),
    isDefault: boolean('is_default').notNull().default(true),
    ...timestamps(),
  },
  (t) => [index('number_series_org_type_idx').on(t.organizationId, t.documentType)],
)

export const numberSeriesCounter = pgTable(
  'number_series_counter',
  {
    id: idColumn(),
    organizationId: orgColumn(),
    seriesId: text('series_id')
      .notNull()
      .references(() => numberSeries.id, { onDelete: 'cascade' }),
    /** '2026' for yearly series, 'all' for never-resetting ones. */
    period: text('period').notNull(),
    nextValue: integer('next_value').notNull().default(1),
  },
  (t) => [
    uniqueIndex('number_series_counter_uq').on(t.seriesId, t.period),
    index('number_series_counter_org_idx').on(t.organizationId),
  ],
)

export const exchangeRate = pgTable(
  'exchange_rate',
  {
    id: idColumn(),
    date: text('date').notNull(),
    currency: text('currency').notNull(),
    amount: integer('amount').notNull().default(1),
    rate: numeric('rate', { precision: 19, scale: 6 }).notNull(),
  },
  (t) => [uniqueIndex('exchange_rate_date_currency_uq').on(t.date, t.currency)],
)
