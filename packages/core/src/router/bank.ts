import { toFixed } from '@fakturky/domain'
import { parseStatement, StatementParseError } from '@fakturky/domain/bank'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { procedure } from '../orpc'
import { BankError, bankRepo, type TransactionSource } from '../repositories/bank'
import {
  bankListInputSchema,
  bankListOutputSchema,
  importStatementInputSchema,
  importStatementOutputSchema,
  syncOutputSchema,
} from '../schemas/bank'

const tag = ['Bank']

/** Maps repository failures onto oRPC errors with readable messages. */
export async function guardBank<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (e) {
    if (e instanceof BankError) throw new ORPCError(e.code, { message: e.message })
    if (e instanceof StatementParseError) throw new ORPCError('BAD_REQUEST', { message: e.message })
    throw e
  }
}

export const bankRouter = {
  list: procedure({
    mcp: {
      name: 'list_bank_transactions',
      title: 'List bank transactions',
      description:
        'Lists imported bank transactions with their pairing status (unmatched / matched / ignored). Debits are never paired; status "unmatched" returns incoming payments only.',
      readOnly: true,
    },
    openapi: {
      method: 'GET',
      path: '/bank/transactions',
      summary: 'List bank transactions, filter by pairing status',
      tags: tag,
    },
  })
    .input(bankListInputSchema)
    .output(bankListOutputSchema)
    .handler(async ({ context, input }) => {
      const org = context.principal.organizationId
      const { items, total } = await bankRepo.list(context.db, org, input)
      const counts = await bankRepo.counts(context.db, org, input.bankAccountId)
      return {
        items: items.map(({ tx, documentNumber }) => ({
          ...tx,
          amount: toFixed(tx.amount, 2),
          matchedAmount: tx.matchedAmount === null ? null : toFixed(tx.matchedAmount, 2),
          matchedDocumentNumber: documentNumber,
        })),
        total,
        counts,
      }
    }),

  importStatement: procedure({
    mcp: {
      name: 'import_bank_statement',
      title: 'Import a bank statement',
      description:
        'Imports a bank statement file passed as text into a bank account: CSV (Fio, Revolut, Raiffeisenbank, ČSOB, KB are recognised; other CSV via `mapping`), ABO/GPC or CAMT.053 XML. Idempotent: already imported transactions are skipped. Incoming payments are then paired with open invoices by variable symbol and amount.',
      idempotent: true,
    },
    openapi: {
      method: 'POST',
      path: '/bank/import',
      summary: 'Import a bank statement (CSV, ABO/GPC or CAMT.053) into a bank account',
      tags: tag,
    },
  })
    .input(importStatementInputSchema)
    .output(importStatementOutputSchema)
    .handler(({ context, input }) =>
      guardBank(async () => {
        const org = context.principal.organizationId
        const account = await bankRepo.getAccount(context.db, org, input.bankAccountId)
        if (!account) throw new BankError('NOT_FOUND', 'Bank account not found')
        const statement = parseStatement(input.content, {
          currency: input.currency ?? account.currency,
          mapping: input.mapping,
        })
        const source: TransactionSource =
          statement.format === 'abo' ? 'abo' : statement.format === 'camt053' ? 'camt' : 'csv'
        const result = await bankRepo.importTransactions(
          context.db,
          org,
          input.bankAccountId,
          statement.transactions,
          source,
          statement,
        )
        return {
          format: statement.format,
          ...result,
          warnings: statement.warnings.slice(0, 50),
          autoMatched: 0,
        }
      }),
    ),

  syncFio: procedure({
    mcp: {
      name: 'sync_fio_bank_account',
      title: 'Synchronise a Fio bank account',
      description:
        'Downloads new transactions from Fio banka with the account’s read-only API token (one request per 30 seconds), then pairs incoming payments with open invoices.',
      idempotent: true,
    },
    openapi: {
      method: 'POST',
      path: '/bank-accounts/{id}/sync',
      summary: 'Download new transactions from Fio banka for this account',
      tags: tag,
    },
  })
    .input(z.object({ id: z.string().min(1) }))
    .output(syncOutputSchema)
    .handler(({ context, input }) =>
      guardBank(async () => {
        const r = await bankRepo.syncFio(context.db, context.principal.organizationId, input.id, {
          fetch: context.services?.fetch,
        })
        return { ...r, autoMatched: 0 }
      }),
    ),
}
