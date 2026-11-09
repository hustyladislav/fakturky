import { parseDecimal, toFixed } from '@fakturky/domain'
import { parseStatement, StatementParseError } from '@fakturky/domain/bank'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { procedure } from '../orpc'
import { BankError, bankRepo, type TransactionSource } from './repo'
import { bankMatchingRepo } from './matching'
import {
  bankListInputSchema,
  bankListOutputSchema,
  IMPORT_OUTCOMES,
  importStatementInputSchema,
  importStatementOutputSchema,
  matchInputSchema,
  matchOutputSchema,
  syncOutputSchema,
} from './schema'

const tag = ['Bank']
const MAX_RESULT_ROWS = 500

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
      const suggestions = await bankMatchingRepo.suggest(
        context.db,
        org,
        items.map((i) => i.tx),
      )
      return {
        items: items.map(({ tx, documentNumber }) => {
          const overpaid =
            tx.matchStatus === 'matched' && tx.matchedAmount !== null
              ? parseDecimal(tx.amount).minus(tx.matchedAmount)
              : null
          return {
            ...tx,
            amount: toFixed(tx.amount, 2),
            matchedAmount: tx.matchedAmount === null ? null : toFixed(tx.matchedAmount, 2),
            overpaid: overpaid?.gt('0.005') ? toFixed(overpaid, 2) : null,
            matchedDocumentNumber: documentNumber,
            suggestions: (suggestions.get(tx.id) ?? []).map((s) => ({
              documentId: s.document.id,
              number: s.document.number,
              customerName: s.document.customerName,
              currency: s.document.currency,
              total: s.document.total,
              remaining: s.document.remaining,
              dueDate: s.document.dueDate,
              score: s.score,
              reasons: s.reasons,
            })),
          }
        }),
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
        const autoMatched = await bankMatchingRepo.autoMatch(
          context.db,
          org,
          context.principal.userId,
        )
        const shown = statement.transactions.slice(0, MAX_RESULT_ROWS)
        const ids = result.rowIds.slice(0, MAX_RESULT_ROWS)
        const stored = new Map(
          (
            await bankRepo.byIds(
              context.db,
              org,
              ids.filter((i): i is string => i !== null),
            )
          ).map((r) => [r.tx.id, r] as const),
        )
        const open = [...stored.values()].filter(
          (r) => r.tx.matchStatus === 'unmatched' && parseDecimal(r.tx.amount).gt(0),
        )
        const suggestions = await bankMatchingRepo.suggest(
          context.db,
          org,
          open.map((r) => r.tx),
        )
        const rows = shown.map((t, i) => {
          const id = ids[i]
          const row = id ? stored.get(id) : undefined
          const suggestion = row ? suggestions.get(row.tx.id)?.[0] : undefined
          const outcome: (typeof IMPORT_OUTCOMES)[number] = !row
            ? 'duplicate'
            : parseDecimal(row.tx.amount).lt(0)
              ? 'outgoing'
              : row.tx.matchStatus === 'matched'
                ? 'matched'
                : suggestion
                  ? 'suggested'
                  : 'unmatched'
          return {
            bookedOn: t.bookedOn,
            amount: toFixed(t.amount, 2),
            currency: t.currency,
            counterpartyName: t.counterpartyName,
            variableSymbol: t.variableSymbol,
            outcome,
            documentNumber: row?.documentNumber ?? suggestion?.document.number ?? null,
          }
        })
        return {
          format: statement.format,
          imported: result.imported,
          duplicates: result.duplicates,
          warnings: statement.warnings.slice(0, 50),
          autoMatched,
          rows,
          rowsTruncated: statement.transactions.length > MAX_RESULT_ROWS,
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
        const autoMatched = await bankMatchingRepo.autoMatch(
          context.db,
          context.principal.organizationId,
          context.principal.userId,
        )
        return { ...r, autoMatched }
      }),
    ),

  autoMatch: procedure({
    mcp: {
      name: 'auto_match_bank_payments',
      title: 'Pair incoming bank payments with invoices',
      description:
        'Pairs unmatched incoming payments with open invoices when the variable symbol identifies exactly one invoice in the same currency. Partial payments are booked as partial; an excess is flagged as overpayment.',
      idempotent: true,
    },
    openapi: {
      method: 'POST',
      path: '/bank/auto-match',
      summary: 'Pair unmatched incoming payments with invoices by variable symbol',
      tags: tag,
    },
  })
    .input(z.object({}))
    .output(z.object({ matched: z.number() }))
    .handler(({ context }) =>
      guardBank(async () => ({
        matched: await bankMatchingRepo.autoMatch(
          context.db,
          context.principal.organizationId,
          context.principal.userId,
        ),
      })),
    ),

  match: procedure({
    mcp: {
      name: 'match_bank_transaction',
      title: 'Pair a bank transaction with an invoice',
      description:
        'Books an incoming bank transaction as a payment (source "bank") on an invoice or advance invoice. Use this to confirm a suggestion or to pair manually.',
    },
    openapi: {
      method: 'POST',
      path: '/bank/transactions/{transactionId}/match',
      summary: 'Pair an incoming bank transaction with an invoice and record the payment',
      tags: tag,
    },
  })
    .input(matchInputSchema)
    .output(matchOutputSchema)
    .handler(({ context, input }) =>
      guardBank(() =>
        bankMatchingRepo.match(
          context.db,
          context.principal.organizationId,
          context.principal.userId,
          input.transactionId,
          input.documentId,
          { amount: input.amount },
        ),
      ),
    ),

  unmatch: procedure({
    mcp: {
      name: 'unmatch_bank_transaction',
      title: 'Undo the pairing of a bank transaction',
      description:
        'Removes the payment created by the pairing and reopens the invoice if that payment had settled it.',
      destructive: true,
    },
    openapi: {
      method: 'POST',
      path: '/bank/transactions/{transactionId}/unmatch',
      summary: 'Undo the pairing: delete the payment and reopen the invoice',
      tags: tag,
    },
  })
    .input(z.object({ transactionId: z.string().min(1) }))
    .output(z.object({ ok: z.literal(true) }))
    .handler(({ context, input }) =>
      guardBank(async () => {
        await bankMatchingRepo.unmatch(
          context.db,
          context.principal.organizationId,
          context.principal.userId,
          input.transactionId,
        )
        return { ok: true as const }
      }),
    ),

  setIgnored: procedure({
    mcp: {
      name: 'ignore_bank_transaction',
      title: 'Ignore (or restore) a bank transaction',
      description:
        'Marks an unmatched transaction as ignored (not an invoice payment) or puts it back among the unmatched ones.',
      idempotent: true,
    },
    openapi: {
      method: 'POST',
      path: '/bank/transactions/{transactionId}/ignore',
      summary: 'Ignore a bank transaction, or restore it with ignored=false',
      tags: tag,
    },
  })
    .input(z.object({ transactionId: z.string().min(1), ignored: z.boolean().default(true) }))
    .output(z.object({ ok: z.literal(true) }))
    .handler(({ context, input }) =>
      guardBank(async () => {
        await bankMatchingRepo.setIgnored(
          context.db,
          context.principal.organizationId,
          input.transactionId,
          input.ignored,
        )
        return { ok: true as const }
      }),
    ),
}
