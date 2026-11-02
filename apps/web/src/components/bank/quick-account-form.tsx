import { findBank } from '@fakturky/domain/bank-codes'
import {
  czechAccountToIban,
  isValidCzechAccount,
  parseCzechAccount,
} from '@fakturky/domain/czech-account'
import { czechAccountFromIban, formatIban, isValidIban, normalizeIban } from '@fakturky/domain/iban'
import { Button } from '@fakturky/ui/components/button'
import { FieldError } from '@fakturky/ui/components/field-error'
import { Input } from '@fakturky/ui/components/input'
import { Label } from '@fakturky/ui/components/label'
import { useMutation } from '@tanstack/react-query'
import { type ReactNode, useId, useState } from 'react'
import { toast } from 'sonner'
import { cs } from '@/i18n/cs'
import { orpc } from '@/lib/orpc'

const t = cs.bankAccounts.quick

type Derived = { iban: string; bic: string | null; bank: string | null } | null

/** Czech number -> IBAN/BIC/bank, or a valid IBAN -> its parts. Null until the input is a complete valid account. */
export function deriveAccount(input: string): Derived {
  const value = input.trim()
  if (!value) return null
  const czech = parseCzechAccount(value)
  if (czech) {
    if (!isValidCzechAccount(value)) return null
    const bank = findBank(czech.bankCode)
    return { iban: czechAccountToIban(value), bic: bank?.bic ?? null, bank: bank?.name ?? null }
  }
  if (!isValidIban(value)) return null
  const cz = czechAccountFromIban(value)
  const bank = cz ? findBank(cz.bankCode) : undefined
  return { iban: normalizeIban(value), bic: bank?.bic ?? null, bank: bank?.name ?? null }
}

/**
 * One-field "add a bank account": type a Czech number or IBAN, see IBAN/BIC appear, Enter saves.
 * Shared by onboarding and the invoice editor so a first account never needs a trip to Nastavení.
 */
export function QuickAccountForm({
  onCreated,
  onSkip,
  submitLabel = t.submit,
  autoFocus,
  children,
}: {
  onCreated: () => unknown
  onSkip?: () => unknown
  submitLabel?: string
  autoFocus?: boolean
  children?: ReactNode
}) {
  const id = useId()
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const derived = deriveAccount(value)
  const create = useMutation(
    orpc.bankAccounts.create.mutationOptions({
      onSuccess: async () => {
        toast.success(cs.bankAccounts.created)
        await onCreated()
      },
      onError: (e) => {
        if ((e as { code?: string }).code === 'BAD_REQUEST') setError(cs.bankAccounts.invalid)
        else toast.error(cs.common.error)
      },
    }),
  )

  const submit = () => {
    if (!derived) {
      setError(value.trim() ? cs.bankAccounts.invalid : t.required)
      return
    }
    create.mutate({ label: derived.bank ?? t.defaultLabel, account: value.trim() })
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor={id}>{cs.bankAccounts.account}</Label>
        <Input
          id={id}
          value={value}
          autoFocus={autoFocus}
          autoComplete="off"
          autoCapitalize="characters"
          placeholder={cs.bankAccounts.accountPlaceholder}
          aria-invalid={error ? true : undefined}
          aria-describedby={`${id}-info`}
          onChange={(e) => {
            setValue(e.target.value)
            setError(null)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              submit()
            }
          }}
        />
        <div id={`${id}-info`} className="min-h-10 text-[13px] leading-5 text-muted-foreground">
          {error ? (
            <FieldError>{error}</FieldError>
          ) : derived ? (
            <p data-testid="account-derived">
              <span className="font-mono">{formatIban(derived.iban)}</span>
              {derived.bic && <> · BIC {derived.bic}</>}
              {derived.bank && <> · {derived.bank}</>}
            </p>
          ) : (
            <p>{t.hint}</p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={submit} disabled={create.isPending}>
          {submitLabel}
        </Button>
        {onSkip && (
          <Button type="button" variant="ghost" onClick={() => onSkip()}>
            {t.skip}
          </Button>
        )}
        {children}
      </div>
    </div>
  )
}
