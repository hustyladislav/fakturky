import type { Db } from '@fakturky/db'
import { schema } from '@fakturky/db'
import { and, asc, eq, isNull, ne } from 'drizzle-orm'
import {
  type BankAccountInput,
  type BankAccountPatch,
  resolveAccount,
} from './schema'

const { bankAccount } = schema

const scoped = (orgId: string, id: string) =>
  and(eq(bankAccount.organizationId, orgId), eq(bankAccount.id, id), isNull(bankAccount.archivedAt))

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]

/** Keeps the invariants: one default per currency and one overall default (when any account exists). */
async function reconcileDefaults(tx: Tx, orgId: string) {
  const rows = await tx
    .select()
    .from(bankAccount)
    .where(and(eq(bankAccount.organizationId, orgId), isNull(bankAccount.archivedAt)))
    .orderBy(asc(bankAccount.createdAt), asc(bankAccount.id))
  const byCurrency = new Map<string, typeof rows>()
  for (const r of rows) byCurrency.set(r.currency, [...(byCurrency.get(r.currency) ?? []), r])
  const fix = async (id: string, set: { defaultForCurrency?: boolean; isDefault?: boolean }) =>
    tx
      .update(bankAccount)
      .set(set)
      .where(and(eq(bankAccount.organizationId, orgId), eq(bankAccount.id, id)))
  for (const group of byCurrency.values()) {
    const flagged = group.filter((r) => r.defaultForCurrency)
    const keep = flagged[0] ?? group[0]
    for (const r of group) {
      const want = r.id === keep?.id
      if (r.defaultForCurrency !== want) await fix(r.id, { defaultForCurrency: want })
    }
  }
  const overall = rows.filter((r) => r.isDefault)
  const keepOverall = overall[0] ?? rows[0]
  for (const r of rows) {
    const want = r.id === keepOverall?.id
    if (r.isDefault !== want) await fix(r.id, { isDefault: want })
  }
}

export const bankAccountsRepo = {
  list(db: Db, orgId: string) {
    return db
      .select()
      .from(bankAccount)
      .where(and(eq(bankAccount.organizationId, orgId), isNull(bankAccount.archivedAt)))
      .orderBy(asc(bankAccount.createdAt), asc(bankAccount.id))
  },

  async get(db: Db, orgId: string, id: string) {
    const [row] = await db.select().from(bankAccount).where(scoped(orgId, id))
    return row ?? null
  },

  /** Default account for a currency (falls back to any account in that currency). */
  async defaultFor(db: Db, orgId: string, currency: string) {
    const rows = await db
      .select()
      .from(bankAccount)
      .where(
        and(
          eq(bankAccount.organizationId, orgId),
          eq(bankAccount.currency, currency),
          isNull(bankAccount.archivedAt),
        ),
      )
      .orderBy(asc(bankAccount.createdAt))
    return rows.find((r) => r.defaultForCurrency) ?? rows[0] ?? null
  },

  async create(db: Db, orgId: string, input: BankAccountInput) {
    const resolved = resolveAccount(input.account, input.bic)
    return db.transaction(async (tx) => {
      const existing = await tx
        .select()
        .from(bankAccount)
        .where(and(eq(bankAccount.organizationId, orgId), isNull(bankAccount.archivedAt)))
      const [row] = await tx
        .insert(bankAccount)
        .values({
          organizationId: orgId,
          label: input.label,
          currency: input.currency,
          showQr: input.showQr,
          ...resolved,
          isDefault: existing.length === 0,
          defaultForCurrency: !existing.some((e) => e.currency === input.currency),
        })
        .returning()
      if (!row) throw new Error('insert returned no row')
      return row
    })
  },

  async update(db: Db, orgId: string, id: string, patch: BankAccountPatch) {
    const current = await this.get(db, orgId, id)
    if (!current) return null
    const { account, bic, ...rest } = patch
    const resolved = account
      ? resolveAccount(account, bic)
      : bic !== undefined
        ? { bic: bic?.trim().toUpperCase() || null }
        : {}
    return db.transaction(async (tx) => {
      const currencyChanged = rest.currency !== undefined && rest.currency !== current.currency
      const [row] = await tx
        .update(bankAccount)
        .set({ ...rest, ...resolved, ...(currencyChanged ? { defaultForCurrency: false } : {}) })
        .where(scoped(orgId, id))
        .returning()
      if (currencyChanged) await reconcileDefaults(tx, orgId)
      return row ?? null
    })
  },

  async setDefault(db: Db, orgId: string, id: string) {
    return db.transaction(async (tx) => {
      const [target] = await tx.select().from(bankAccount).where(scoped(orgId, id))
      if (!target) return null
      await tx
        .update(bankAccount)
        .set({ defaultForCurrency: false })
        .where(
          and(
            eq(bankAccount.organizationId, orgId),
            eq(bankAccount.currency, target.currency),
            ne(bankAccount.id, id),
          ),
        )
      const [current] = await tx
        .select()
        .from(bankAccount)
        .where(and(eq(bankAccount.organizationId, orgId), eq(bankAccount.isDefault, true)))
      // The overall default moves only within the same currency (CZK stays the headline account).
      const moveOverall = !current || current.currency === target.currency
      if (moveOverall) {
        await tx
          .update(bankAccount)
          .set({ isDefault: false })
          .where(and(eq(bankAccount.organizationId, orgId), ne(bankAccount.id, id)))
      }
      const [row] = await tx
        .update(bankAccount)
        .set({ defaultForCurrency: true, ...(moveOverall ? { isDefault: true } : {}) })
        .where(scoped(orgId, id))
        .returning()
      return row ?? null
    })
  },

  /** Soft delete so issued documents that reference the account keep their FK. */
  async archive(db: Db, orgId: string, id: string) {
    return db.transaction(async (tx) => {
      const [row] = await tx
        .update(bankAccount)
        .set({ archivedAt: new Date(), isDefault: false, defaultForCurrency: false })
        .where(scoped(orgId, id))
        .returning()
      if (!row) return null
      await reconcileDefaults(tx, orgId)
      return row
    })
  },
}
