import { isoWeekday, isWeekend } from '@fakturky/domain/dates'
import { Button } from '@fakturky/ui/components/button'
import { CurrencyCombobox } from '@fakturky/ui/components/currency-combobox'
import { DatePicker } from '@fakturky/ui/components/date-picker'
import { Input } from '@fakturky/ui/components/input'
import { Label } from '@fakturky/ui/components/label'
import { NativeSelect } from '@fakturky/ui/components/native-select'
import { cn } from '@fakturky/ui/lib/utils'
import { useQueryClient } from '@tanstack/react-query'
import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { QuickAccountForm } from '@/components/bank/quick-account-form'
import { cs } from '@/i18n/cs'
import { orpc } from '@/lib/orpc'
import type { InvoiceDraft } from './use-invoice-draft'

const t = cs.invoices.form

/** Due date, currency and payment folded into one sentence; the fields open on demand. */
export function TermsSection({ draft }: { draft: InvoiceDraft }) {
  const { fields, bank, foreign, vatPayer } = draft
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const dueInDays = Math.round(
    (Date.parse(fields.dueDate) - Date.parse(fields.issueDate)) / 86_400_000,
  )
  const method = t.methods[fields.paymentMethod as keyof typeof t.methods]
  const weekend = fields.dueDate && isWeekend(fields.dueDate)

  return (
    <div className="border-t py-2">
      {bank.none && (
        // No account yet: the inline form stays in view, or the invoice goes out without a QR code.
        <div className="space-y-2 py-4">
          <p className="text-muted-foreground text-sm">{t.bankAddInline}</p>
          <QuickAccountForm
            onCreated={() => queryClient.invalidateQueries({ queryKey: orpc.bankAccounts.key() })}
          />
        </div>
      )}
      <button
        type="button"
        aria-expanded={open}
        aria-controls="terms-fields"
        onClick={() => setOpen((o) => !o)}
        className="-mx-2 flex w-[calc(100%+1rem)] items-center justify-between gap-3 rounded-md px-2 py-3 text-left text-sm outline-none hover:bg-muted/50 focus-visible:bg-muted/50 pointer-coarse:min-h-11"
      >
        <span className="min-w-0">
          {t.dueSummary(dueInDays, fields.dueDate)}
          {foreign && ` · ${fields.currency}`}
          {method && ` · ${method}`}
          <span className="text-muted-foreground"> · {open ? t.datesHide : t.datesEdit}</span>
        </span>
        <ChevronDown
          aria-hidden
          className={cn(
            'size-4 shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>
      {open && (
        <div id="terms-fields" className="grid gap-4 pt-3 pb-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="issueDate">{t.issueDate}</Label>
            <DatePicker id="issueDate" value={fields.issueDate} onChange={draft.setIssueDate} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dueDate">{t.dueDate}</Label>
            <DatePicker
              id="dueDate"
              value={fields.dueDate}
              presets
              presetBase={fields.issueDate}
              onChange={draft.setDueDate}
            />
          </div>
          {vatPayer && (
            <div className="space-y-1.5">
              <Label htmlFor="taxableDate">{t.taxableDate}</Label>
              <DatePicker
                id="taxableDate"
                value={fields.taxableDate}
                onChange={draft.setTaxableDate}
              />
              <p className="text-muted-foreground text-xs">{t.taxableHint}</p>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="currency">{t.currency}</Label>
            <CurrencyCombobox id="currency" value={fields.currency} onChange={draft.setCurrency} />
          </div>
          {foreign && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="rate">{t.exchangeRate}</Label>
              <div className="flex gap-2">
                <Input
                  id="rate"
                  inputMode="decimal"
                  enterKeyHint="done"
                  value={fields.exchangeRate}
                  onChange={(e) => draft.setExchangeRate(e.target.value)}
                />
                <Button type="button" variant="outline" onClick={draft.reloadRate}>
                  {t.exchangeRateLoad}
                </Button>
              </div>
              <p className="text-muted-foreground text-xs">{t.exchangeRateHint}</p>
            </div>
          )}
          {!bank.none && (
            <div className="space-y-1.5">
              <Label htmlFor="bank">{t.bankAccount}</Label>
              <NativeSelect
                id="bank"
                value={bank.selectedId}
                onChange={(e) => draft.set({ bankAccountId: e.target.value })}
              >
                {bank.forCurrency.length === 0 && <option value="">{t.bankAccountNone}</option>}
                {bank.forCurrency.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </NativeSelect>
              {bank.selected && (
                <p className="text-muted-foreground text-xs tabular-nums">
                  {bank.selected.accountNumber
                    ? `${bank.selected.accountNumber}/${bank.selected.bankCode}`
                    : bank.selected.iban}
                </p>
              )}
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="method">{t.paymentMethod}</Label>
            <NativeSelect
              id="method"
              value={fields.paymentMethod}
              onChange={(e) => draft.set({ paymentMethod: e.target.value })}
            >
              {Object.entries(t.methods).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>
      )}
      {weekend && (
        <p className={cn('pb-2 text-muted-foreground text-sm', !open && 'sr-only')}>
          {t.weekendHint(t.weekdays[isoWeekday(fields.dueDate) % 7] ?? '')}
        </p>
      )}
    </div>
  )
}
