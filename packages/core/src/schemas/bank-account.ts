import {
  czechAccountToIban,
  findBank,
  isValidIban,
  normalizeIban,
  parseCzechAccount,
} from '@fakturky/domain'
import { z } from 'zod'

const currency = z
  .string()
  .trim()
  .length(3)
  .transform((v) => v.toUpperCase())

/**
 * Either a Czech account (`[prefix-]number/bank`) or an IBAN. The server derives
 * IBAN + BIC so callers (UI, MCP, CLI) only need to supply what the user knows.
 */
// Field definitions without defaults, shared by create and patch (Zod 4 `.partial()` keeps defaults).
const fields = {
  label: z.string().trim().min(1).max(100),
  currency,
  account: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .describe('Czech account number "[prefix-]number/bankCode" or an IBAN'),
  bic: z
    .string()
    .trim()
    .max(11)
    .nullish()
    .describe('Optional; filled in from the bank code for Czech accounts'),
  showQr: z.boolean(),
}

export const bankAccountInputSchema = z.object({
  ...fields,
  currency: fields.currency.default('CZK'),
  showQr: fields.showQr.default(true),
})

export const bankAccountPatchSchema = z.object(fields).partial()

export const bankAccountSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  label: z.string(),
  currency: z.string(),
  accountNumber: z.string().nullable(),
  bankCode: z.string().nullable(),
  iban: z.string().nullable(),
  bic: z.string().nullable(),
  isDefault: z.boolean(),
  defaultForCurrency: z.boolean(),
  showQr: z.boolean(),
  archivedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export type BankAccountInput = z.infer<typeof bankAccountInputSchema>
export type BankAccountPatch = z.infer<typeof bankAccountPatchSchema>

export type ResolvedAccount = {
  accountNumber: string | null
  bankCode: string | null
  iban: string
  bic: string | null
}

/** Throws a plain Error with a user-presentable message when the account is invalid. */
export function resolveAccount(account: string, bic?: string | null): ResolvedAccount {
  const czech = parseCzechAccount(account)
  if (czech) {
    let iban: string
    try {
      iban = czechAccountToIban(czech)
    } catch {
      throw new Error('Invalid Czech bank account number')
    }
    const bank = findBank(czech.bankCode)
    return {
      accountNumber: `${czech.prefix ? `${czech.prefix}-` : ''}${czech.number}`,
      bankCode: czech.bankCode,
      iban,
      bic: bic?.trim().toUpperCase() || bank?.bic || null,
    }
  }
  const iban = normalizeIban(account)
  if (!isValidIban(iban)) throw new Error('Invalid IBAN')
  return { accountNumber: null, bankCode: null, iban, bic: bic?.trim().toUpperCase() || null }
}
