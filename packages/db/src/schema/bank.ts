import { index, pgEnum, pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core'
import { bankAccount } from './business'
import { document, payment } from './documents'
import { idColumn, money, orgColumn, timestamps } from './helpers'

export const bankTransactionMatchStatus = pgEnum('bank_transaction_match_status', [
  'unmatched',
  'matched',
  'ignored',
])

/**
 * One line of a bank statement (CSV / ABO / CAMT.053 upload or Fio API). `amount` is signed:
 * credits (incoming money) are positive, debits negative. Only credits are ever matched to invoices.
 */
export const bankTransaction = pgTable(
  'bank_transaction',
  {
    id: idColumn(),
    organizationId: orgColumn(),
    bankAccountId: text('bank_account_id')
      .notNull()
      .references(() => bankAccount.id, { onDelete: 'cascade' }),
    /** YYYY-MM-DD. */
    bookedOn: text('booked_on').notNull(),
    amount: money('amount').notNull(),
    currency: text('currency').notNull(),
    variableSymbol: text('variable_symbol'),
    constantSymbol: text('constant_symbol'),
    specificSymbol: text('specific_symbol'),
    /** Counterparty account as the bank prints it ("123456/0800", "prefix-number/code" or an IBAN). */
    counterpartyAccount: text('counterparty_account'),
    counterpartyName: text('counterparty_name'),
    /** Message for the recipient / payment details. */
    message: text('message'),
    /** Id from the bank, or a deterministic hash of the row; unique per account so re-imports are idempotent. */
    externalId: text('external_id').notNull(),
    /** Where the row came from: 'csv' | 'abo' | 'camt' | 'fio_api'. */
    source: text('source').notNull(),
    matchStatus: bankTransactionMatchStatus('match_status').notNull().default('unmatched'),
    matchedDocumentId: text('matched_document_id').references(() => document.id, {
      onDelete: 'set null',
    }),
    /** The payment created by the match; removing the payment reopens the transaction. */
    paymentId: text('payment_id').references(() => payment.id, { onDelete: 'set null' }),
    /** Part of the transaction booked to the document; less than `amount` means an overpayment. */
    matchedAmount: money('matched_amount'),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('bank_transaction_account_external_uq').on(t.bankAccountId, t.externalId),
    index('bank_transaction_org_status_idx').on(t.organizationId, t.matchStatus, t.bookedOn),
    index('bank_transaction_org_document_idx').on(t.organizationId, t.matchedDocumentId),
    index('bank_transaction_org_vs_idx').on(t.organizationId, t.variableSymbol),
  ],
)
