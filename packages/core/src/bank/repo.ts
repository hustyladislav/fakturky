import { createHash } from 'node:crypto'
import type { Db } from '@fakturky/db'
import { schema } from '@fakturky/db'
import { addDays, type FetchLike, IntegrationError, todayPrague } from '@fakturky/domain'
import {
  FIO_MIN_INTERVAL_MS,
  fetchFioTransactions,
  type ParsedStatement,
  type ParsedTransaction,
} from '@fakturky/domain/bank'
import { and, asc, desc, eq, gt, ilike, inArray, isNull, lt, or, sql } from 'drizzle-orm'
import { CryptoError, decryptSecret, encryptSecret } from '../crypto'

const { bankAccount, bankTransaction, document } = schema

type AccountRow = typeof bankAccount.$inferSelect

/** Domain-level failure; the router maps `code` onto an oRPC error. */
export class BankError extends Error {
  constructor(
    readonly code:
      | 'NOT_FOUND'
      | 'BAD_REQUEST'
      | 'CONFLICT'
      | 'TOO_MANY_REQUESTS'
      | 'PRECONDITION_FAILED',
    message: string,
  ) {
    super(message)
  }
}

export type TransactionSource = 'csv' | 'abo' | 'camt' | 'fio_api'

const scopedAccount = (orgId: string, id: string) =>
  and(eq(bankAccount.organizationId, orgId), eq(bankAccount.id, id), isNull(bankAccount.archivedAt))

const FIO_FIRST_SYNC_DAYS = 30
/** Fio only serves the last 90 days without strong authorisation in internet banking. */
const FIO_MAX_DAYS = 89
const FIO_OVERLAP_DAYS = 3

/** Identity of a statement row that carries no bank id; the caller appends an index for identical rows. */
function fingerprint(t: ParsedTransaction): string {
  const raw = [
    t.bookedOn,
    t.amount,
    t.currency,
    t.variableSymbol ?? '',
    t.counterpartyAccount ?? '',
    t.counterpartyName ?? '',
    t.message ?? '',
  ].join('|')
  return `fp:${createHash('sha256').update(raw).digest('hex').slice(0, 32)}`
}

const digitsOnly = (s: string) => s.replace(/\D/g, '').replace(/^0+/, '')

/** Refuses a statement that is clearly for another account (when the file says which account it is for). */
function assertSameAccount(
  account: AccountRow,
  statement: Pick<ParsedStatement, 'iban' | 'accountNumber'>,
) {
  const other = () =>
    new BankError('BAD_REQUEST', 'The statement belongs to a different bank account')
  if (statement.iban && account.iban) {
    if (statement.iban.replace(/\s/g, '').toUpperCase() !== account.iban) throw other()
  } else if (statement.accountNumber && account.accountNumber) {
    if (digitsOnly(statement.accountNumber) !== digitsOnly(account.accountNumber)) throw other()
  }
}

export type ListFilter = {
  bankAccountId?: string
  status?: 'unmatched' | 'matched' | 'ignored'
  direction?: 'credit' | 'debit'
  search?: string
  limit: number
  offset: number
}

export const bankRepo = {
  async getAccount(db: Db, orgId: string, id: string) {
    const [row] = await db.select().from(bankAccount).where(scopedAccount(orgId, id))
    return row ?? null
  },

  /**
   * Stores parsed rows; rows already known for this account (same external id) are skipped, so re-importing an
   * overlapping statement is safe. Returns what was actually inserted.
   */
  async importTransactions(
    db: Db,
    orgId: string,
    accountId: string,
    rows: ParsedTransaction[],
    source: TransactionSource,
    statement?: Pick<ParsedStatement, 'iban' | 'accountNumber'>,
  ) {
    const account = await this.getAccount(db, orgId, accountId)
    if (!account) throw new BankError('NOT_FOUND', 'Bank account not found')
    if (statement) assertSameAccount(account, statement)
    const seen = new Map<string, number>()
    const values = rows.map((t) => {
      let externalId = t.externalId
      if (!externalId) {
        const base = fingerprint(t)
        const n = seen.get(base) ?? 0
        seen.set(base, n + 1)
        externalId = `${base}:${n}`
      }
      return {
        organizationId: orgId,
        bankAccountId: accountId,
        bookedOn: t.bookedOn,
        amount: t.amount,
        currency: t.currency,
        variableSymbol: t.variableSymbol,
        constantSymbol: t.constantSymbol,
        specificSymbol: t.specificSymbol,
        counterpartyAccount: t.counterpartyAccount,
        counterpartyName: t.counterpartyName,
        message: t.message,
        externalId,
        source,
      }
    })
    let imported = 0
    const insertedIds = new Map<string, string>()
    // Chunked: one statement can hold thousands of rows.
    for (let i = 0; i < values.length; i += 500) {
      const res = await db
        .insert(bankTransaction)
        .values(values.slice(i, i + 500))
        .onConflictDoNothing({
          target: [bankTransaction.bankAccountId, bankTransaction.externalId],
        })
        .returning({ id: bankTransaction.id, externalId: bankTransaction.externalId })
      imported += res.length
      for (const r of res) insertedIds.set(r.externalId, r.id)
    }
    return {
      imported,
      duplicates: values.length - imported,
      /** Per statement row, in order: the stored transaction id, or null when it was already known. */
      rowIds: values.map((v) => insertedIds.get(v.externalId) ?? null),
    }
  },

  /** Stored transactions by id, with the number of the document each one is paired with. */
  async byIds(db: Db, orgId: string, ids: string[]) {
    if (ids.length === 0) return []
    return db
      .select({ tx: bankTransaction, documentNumber: document.number })
      .from(bankTransaction)
      .leftJoin(
        document,
        and(eq(document.id, bankTransaction.matchedDocumentId), eq(document.organizationId, orgId)),
      )
      .where(and(eq(bankTransaction.organizationId, orgId), inArray(bankTransaction.id, ids)))
  },

  async list(db: Db, orgId: string, f: ListFilter) {
    const where = [eq(bankTransaction.organizationId, orgId)]
    if (f.bankAccountId) where.push(eq(bankTransaction.bankAccountId, f.bankAccountId))
    if (f.status) where.push(eq(bankTransaction.matchStatus, f.status))
    // Only incoming money is ever paired with invoices, so "unmatched" means unmatched credits.
    const direction = f.direction ?? (f.status === 'unmatched' ? 'credit' : undefined)
    if (direction === 'credit') where.push(gt(bankTransaction.amount, '0'))
    if (direction === 'debit') where.push(lt(bankTransaction.amount, '0'))
    if (f.search?.trim()) {
      const q = `%${f.search.trim().replace(/[%_\\]/g, '\\$&')}%`
      const hit = or(
        ilike(bankTransaction.counterpartyName, q),
        ilike(bankTransaction.message, q),
        ilike(bankTransaction.variableSymbol, q),
        ilike(bankTransaction.counterpartyAccount, q),
      )
      if (hit) where.push(hit)
    }
    const items = await db
      .select({ tx: bankTransaction, documentNumber: document.number })
      .from(bankTransaction)
      .leftJoin(
        document,
        and(eq(document.id, bankTransaction.matchedDocumentId), eq(document.organizationId, orgId)),
      )
      .where(and(...where))
      .orderBy(
        desc(bankTransaction.bookedOn),
        desc(bankTransaction.createdAt),
        asc(bankTransaction.id),
      )
      .limit(f.limit)
      .offset(f.offset)
    const [total] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(bankTransaction)
      .where(and(...where))
    return { items, total: total?.n ?? 0 }
  },

  async counts(db: Db, orgId: string, bankAccountId?: string) {
    const base = [eq(bankTransaction.organizationId, orgId)]
    if (bankAccountId) base.push(eq(bankTransaction.bankAccountId, bankAccountId))
    const rows = await db
      .select({
        status: bankTransaction.matchStatus,
        credit: sql<boolean>`${bankTransaction.amount} > 0`,
        n: sql<number>`count(*)::int`,
      })
      .from(bankTransaction)
      .where(and(...base))
      .groupBy(bankTransaction.matchStatus, sql`${bankTransaction.amount} > 0`)
    const out = { unmatched: 0, matched: 0, ignored: 0, outgoing: 0 }
    for (const r of rows) {
      if (r.status === 'unmatched' && !r.credit) {
        out.outgoing += r.n
        continue
      }
      out[r.status] += r.n
    }
    return out
  },

  // --- Fio ---------------------------------------------------------------------------------------------------

  async setFioToken(db: Db, orgId: string, id: string, token: string | null) {
    let encrypted: string | null = null
    if (token !== null) {
      if (!/^[A-Za-z0-9]{20,100}$/.test(token)) {
        throw new BankError('BAD_REQUEST', 'The Fio token has an invalid format')
      }
      try {
        encrypted = encryptSecret(token)
      } catch (e) {
        if (e instanceof CryptoError) {
          throw new BankError(
            'PRECONDITION_FAILED',
            'Storing tokens is not configured on this server',
          )
        }
        throw e
      }
    }
    const [row] = await db
      .update(bankAccount)
      .set({
        fioTokenEncrypted: encrypted,
        fioLastError: null,
        fioLastRequestAt: null,
        ...(encrypted === null ? { fioSyncedThrough: null, fioLastSyncedAt: null } : {}),
      })
      .where(scopedAccount(orgId, id))
      .returning()
    if (!row) throw new BankError('NOT_FOUND', 'Bank account not found')
    return row
  },

  /**
   * Pulls new transactions from Fio for one account. The 1 request / 30 s limit is claimed in the database
   * (conditional update) so concurrent serverless instances cannot both call Fio.
   */
  async syncFio(
    db: Db,
    orgId: string,
    accountId: string,
    opts: { fetch?: FetchLike; now?: Date; from?: string } = {},
  ) {
    const now = opts.now ?? new Date()
    const account = await this.getAccount(db, orgId, accountId)
    if (!account) throw new BankError('NOT_FOUND', 'Bank account not found')
    if (!account.fioTokenEncrypted) {
      throw new BankError('PRECONDITION_FAILED', 'No Fio token is set for this bank account')
    }
    let token: string
    try {
      token = decryptSecret(account.fioTokenEncrypted)
    } catch {
      throw new BankError(
        'PRECONDITION_FAILED',
        'The stored Fio token cannot be read; set it again',
      )
    }
    const claimed = await db
      .update(bankAccount)
      .set({ fioLastRequestAt: now })
      .where(
        and(
          scopedAccount(orgId, accountId),
          or(
            isNull(bankAccount.fioLastRequestAt),
            lt(bankAccount.fioLastRequestAt, new Date(now.getTime() - FIO_MIN_INTERVAL_MS)),
          ),
        ),
      )
      .returning({ id: bankAccount.id })
    if (claimed.length === 0) {
      throw new BankError(
        'TOO_MANY_REQUESTS',
        'Fio allows one request per 30 seconds; try again shortly',
      )
    }

    const today = todayPrague(now)
    const earliest = addDays(today, -FIO_MAX_DAYS)
    let from =
      opts.from ??
      (account.fioSyncedThrough
        ? addDays(account.fioSyncedThrough, -FIO_OVERLAP_DAYS)
        : addDays(today, -FIO_FIRST_SYNC_DAYS))
    if (from < earliest) from = earliest
    if (from > today) from = today

    const fail = async (message: string, code: BankError['code']): Promise<never> => {
      await db
        .update(bankAccount)
        .set({ fioLastError: message })
        .where(scopedAccount(orgId, accountId))
      throw new BankError(code, message)
    }
    let statement: Awaited<ReturnType<typeof fetchFioTransactions>>
    try {
      statement = await fetchFioTransactions(token, from, today, { fetch: opts.fetch })
    } catch (e) {
      if (e instanceof IntegrationError) {
        return fail(e.message, e.status === 409 ? 'TOO_MANY_REQUESTS' : 'BAD_REQUEST')
      }
      throw e
    }
    const { info } = statement
    const sameAccount =
      info.iban && account.iban
        ? info.iban.toUpperCase() === account.iban
        : info.accountId && account.accountNumber
          ? digitsOnly(info.accountId) === digitsOnly(account.accountNumber)
          : true
    if (!sameAccount) {
      return fail('The Fio token belongs to a different bank account', 'BAD_REQUEST')
    }
    const result = await this.importTransactions(
      db,
      orgId,
      accountId,
      statement.transactions,
      'fio_api',
    )
    await db
      .update(bankAccount)
      .set({ fioLastSyncedAt: now, fioSyncedThrough: today, fioLastError: null })
      .where(scopedAccount(orgId, accountId))
    return { ...result, from, to: today }
  },

  /** Cron entry point: every account with a token, one after the other. The cross-tenant read is only this list. */
  async syncAllFio(db: Db, opts: { fetch?: FetchLike; now?: Date } = {}) {
    const accounts = await db
      .select({ id: bankAccount.id, organizationId: bankAccount.organizationId })
      .from(bankAccount)
      .where(and(sql`${bankAccount.fioTokenEncrypted} is not null`, isNull(bankAccount.archivedAt)))
    const results: Array<{
      organizationId: string
      bankAccountId: string
      imported: number
      error?: string
    }> = []
    for (const a of accounts) {
      try {
        const r = await this.syncFio(db, a.organizationId, a.id, opts)
        results.push({
          organizationId: a.organizationId,
          bankAccountId: a.id,
          imported: r.imported,
        })
      } catch (e) {
        results.push({
          organizationId: a.organizationId,
          bankAccountId: a.id,
          imported: 0,
          error: e instanceof BankError ? e.message : 'Unexpected error',
        })
      }
    }
    return results
  },
}
