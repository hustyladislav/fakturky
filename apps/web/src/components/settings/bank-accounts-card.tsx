import { Button } from '@fakturky/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@fakturky/ui/components/dialog'
import { FieldError } from '@fakturky/ui/components/field-error'
import { Input } from '@fakturky/ui/components/input'
import { Label } from '@fakturky/ui/components/label'
import { NativeSelect } from '@fakturky/ui/components/native-select'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ExternalLink } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { bankErrorMessage } from '@/components/bank/bank-errors'
import { COMMON_CURRENCIES, CURRENCY_CODES, currencyLabel } from '@/components/settings/currencies'
import { RowList, SettingsSection } from '@/components/settings/settings-section'
import { cs } from '@/i18n/cs'
import { orpc } from '@/lib/orpc'

const t = cs.bankAccounts

/** Fio's official API documentation (explains where to create a token in internet banking). */
const FIO_API_DOCS = 'https://www.fio.cz/docs/cz/API_Bankovnictvi.pdf'

export function BankAccountsCard() {
  const queryClient = useQueryClient()
  const list = useQuery(orpc.bankAccounts.list.queryOptions({ input: {} }))
  const refresh = () => queryClient.invalidateQueries({ queryKey: orpc.bankAccounts.key() })
  const setDefault = useMutation(
    orpc.bankAccounts.setDefault.mutationOptions({
      onSuccess: async () => {
        toast.success(t.updated)
        await refresh()
      },
    }),
  )
  const remove = useMutation(
    orpc.bankAccounts.delete.mutationOptions({
      onSuccess: async () => {
        toast.success(t.deleted)
        await refresh()
      },
    }),
  )

  return (
    <SettingsSection
      id="banka"
      title={t.title}
      description={t.description}
      action={<NewBankAccount onCreated={refresh} />}
    >
      {list.data?.length === 0 && <p className="text-muted-foreground text-sm">{t.empty}</p>}
      {!!list.data?.length && (
        <RowList>
          {list.data.map((a) => (
            <div
              key={a.id}
              className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
            >
              <div className="min-w-0 space-y-0.5">
                <div className="flex flex-wrap items-baseline gap-x-2 text-sm font-medium">
                  {a.label}
                  <span className="text-muted-foreground text-xs font-normal">{a.currency}</span>
                  {a.defaultForCurrency && (
                    <span className="text-muted-foreground text-xs font-normal">· {t.default}</span>
                  )}
                </div>
                <div className="text-muted-foreground text-sm tabular-nums break-all">
                  {a.accountNumber ? `${a.accountNumber}/${a.bankCode} · ` : ''}
                  {a.iban}
                  {a.bic ? ` · ${a.bic}` : ''}
                </div>
                {a.fioConnected && (
                  <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-xs">
                    <span className="text-foreground">{t.fio.connected}</span>
                    {a.fioLastError ? (
                      <span className="text-destructive">
                        {bankErrorMessage({ message: a.fioLastError })}
                      </span>
                    ) : (
                      <span>
                        {a.fioLastSyncedAt
                          ? t.fio.lastSync(formatDateTimeCs(a.fioLastSyncedAt))
                          : t.fio.neverSynced}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2 sm:justify-end">
                <FioToken account={a} onChanged={refresh} />
                {!a.defaultForCurrency && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDefault.mutate({ id: a.id })}
                  >
                    {t.makeDefault}
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => remove.mutate({ id: a.id })}>
                  {t.delete}
                </Button>
              </div>
            </div>
          ))}
        </RowList>
      )}
    </SettingsSection>
  )
}

function NewBankAccount({ onCreated }: { onCreated: () => unknown }) {
  const [open, setOpen] = useState(false)
  const [accountError, setAccountError] = useState<string | null>(null)
  const create = useMutation(
    orpc.bankAccounts.create.mutationOptions({
      onSuccess: async () => {
        toast.success(t.created)
        setOpen(false)
        await onCreated()
      },
      onError: (e) => {
        if ((e as { code?: string }).code === 'BAD_REQUEST') setAccountError(t.invalid)
        else toast.error(cs.common.error)
      },
    }),
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>{t.new}</DialogTrigger>
      <DialogContent>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            const f = new FormData(e.currentTarget)
            const text = (k: string) => String(f.get(k) ?? '').trim()
            create.mutate({
              label: text('label'),
              account: text('account'),
              currency: text('currency') || 'CZK',
              bic: text('bic') || undefined,
              showQr: f.get('showQr') === 'on',
            })
          }}
        >
          <DialogHeader>
            <DialogTitle>{t.new}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="ba-label">{t.label}</Label>
            <Input id="ba-label" name="label" placeholder={t.labelPlaceholder} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ba-account">{t.account}</Label>
            <Input
              id="ba-account"
              name="account"
              placeholder={t.accountPlaceholder}
              required
              aria-invalid={accountError ? true : undefined}
              aria-describedby={accountError ? 'ba-account-error' : undefined}
              onChange={() => setAccountError(null)}
            />
            <FieldError id="ba-account-error">{accountError}</FieldError>
          </div>
          <div className="grid grid-cols-2 items-start gap-4">
            <div className="space-y-2">
              <Label htmlFor="ba-currency">{t.currency}</Label>
              <NativeSelect id="ba-currency" name="currency" defaultValue="CZK" required>
                {COMMON_CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
                <option disabled>──────────</option>
                {CURRENCY_CODES.filter((c) => !COMMON_CURRENCIES.includes(c)).map((c) => (
                  <option key={c} value={c}>
                    {currencyLabel(c)}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <Label htmlFor="ba-bic">{t.bic}</Label>
                <span id="ba-bic-hint" className="text-muted-foreground text-xs">
                  {t.bicOptional}
                </span>
              </div>
              <Input
                id="ba-bic"
                name="bic"
                maxLength={11}
                autoCapitalize="characters"
                aria-describedby="ba-bic-hint"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="showQr" defaultChecked />
            {t.showQr}
          </label>
          <DialogFooter>
            <Button type="submit" disabled={create.isPending}>
              {cs.common.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function formatDateTimeCs(d: Date | string) {
  return new Date(d).toLocaleString('cs-CZ', { dateStyle: 'medium', timeStyle: 'short' })
}

function FioToken({
  account,
  onChanged,
}: {
  account: { id: string; fioConnected: boolean; bankCode: string | null }
  onChanged: () => unknown
}) {
  const f = t.fio
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const save = useMutation(
    orpc.bankAccounts.setFioToken.mutationOptions({
      onSuccess: async (_, v) => {
        toast.success(v.token ? f.saved : f.removed)
        setOpen(false)
        await onChanged()
      },
      onError: (e) => {
        const code = (e as { code?: string }).code
        setError(code === 'PRECONDITION_FAILED' ? f.notConfigured : f.invalid)
      },
    }),
  )
  // 2010 is Fio's bank code; other banks have no such API.
  if (account.bankCode !== '2010') return null
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        {account.fioConnected ? f.reconnect : f.connect}
      </Button>
      {account.fioConnected && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => save.mutate({ id: account.id, token: null })}
        >
          {f.disconnect}
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form
            className="space-y-4"
            autoComplete="off"
            onSubmit={(e) => {
              e.preventDefault()
              setError(null)
              const token = String(new FormData(e.currentTarget).get('token') ?? '').trim()
              save.mutate({ id: account.id, token })
            }}
          >
            <DialogHeader>
              <DialogTitle>{f.title}</DialogTitle>
            </DialogHeader>
            <p className="text-muted-foreground text-sm">{f.description}</p>
            <ol className="list-decimal space-y-1 pl-5 text-muted-foreground text-sm">
              {f.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <a
              href={FIO_API_DOCS}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1 text-sm underline underline-offset-2"
            >
              {f.docsLink}
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
            <div className="space-y-2">
              <Label htmlFor="fio-token">{f.token}</Label>
              <Input
                id="fio-token"
                name="token"
                type="password"
                required
                autoComplete="off"
                spellCheck={false}
                aria-invalid={error ? true : undefined}
                aria-describedby="fio-token-hint"
                onChange={() => setError(null)}
              />
              <p id="fio-token-hint" className="text-muted-foreground text-xs">
                {f.tokenHint}
              </p>
              <FieldError>{error}</FieldError>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={save.isPending}>
                {f.save}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
