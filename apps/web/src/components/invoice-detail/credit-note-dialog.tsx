import { parseDecimal } from '@fakturky/domain/money'
import { allocateGross, splitGross } from '@fakturky/domain/vat'
import { Button } from '@fakturky/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@fakturky/ui/components/dialog'
import { FieldError } from '@fakturky/ui/components/field-error'
import { Input } from '@fakturky/ui/components/input'
import { Label } from '@fakturky/ui/components/label'
import { formatMoney } from '@fakturky/ui/lib/money'
import { cn } from '@fakturky/ui/lib/utils'
import { useEffect, useState } from 'react'
import { cs } from '@/i18n/cs'
import type { DocumentDetail } from '@/lib/document-sheet'

const t = cs.invoices.detail

function parseAmount(input: string) {
  try {
    return input.trim() ? parseDecimal(input) : null
  } catch {
    return null
  }
}

/** Credit note for the whole invoice or a VAT-inclusive part of it, with the base/VAT split shown live. */
export function CreditNoteDialog({
  open,
  onOpenChange,
  doc,
  pending,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  doc: DocumentDetail
  pending: boolean
  onConfirm: (v: { reason?: string; amount?: string }) => void
}) {
  const [scope, setScope] = useState<'whole' | 'part'>('whole')
  const [amountText, setAmountText] = useState('')
  const [reason, setReason] = useState('')
  useEffect(() => {
    if (open) {
      setScope('whole')
      setAmountText('')
      setReason('')
    }
  }, [open])

  const total = parseDecimal(doc.total)
  const money = (v: string | { toFixed: (dp: number) => string }) =>
    formatMoney(typeof v === 'string' ? v : v.toFixed(2), doc.currency)
  const amount = parseAmount(amountText)
  const invalid = scope === 'part' && (!amount || amount.lte(0))
  const tooMuch = scope === 'part' && !!amount && amount.gt(total)
  const error = tooMuch
    ? t.creditNoteTooMuch(money(doc.total))
    : amountText && invalid
      ? t.creditNoteInvalid
      : undefined
  const blocked = pending || (scope === 'part' && (invalid || tooMuch))

  const rows =
    scope === 'part' && amount && !invalid && !tooMuch
      ? allocateGross(
          amount,
          doc.vatRecap.map((r) => r.total),
        ).map((gross, i) => {
          const rate = doc.vatRecap[i]?.vatRate ?? '0'
          return { rate, gross, ...splitGross(gross, rate) }
        })
      : []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (blocked) return
            onConfirm({
              reason: reason.trim() || undefined,
              amount: scope === 'part' && amount ? amount.toFixed(2) : undefined,
            })
          }}
        >
          <DialogHeader>
            <DialogTitle>{t.creditNote}</DialogTitle>
          </DialogHeader>

          <div className="space-y-2">
            <span className="text-sm font-medium" id="cn-scope">
              {t.creditNoteScope}
            </span>
            <div
              role="radiogroup"
              aria-labelledby="cn-scope"
              className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1"
            >
              {(['whole', 'part'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={scope === value}
                  onClick={() => setScope(value)}
                  className={cn(
                    'h-8 rounded-md text-sm font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50',
                    scope === value
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {value === 'whole' ? t.creditNoteWhole : t.creditNotePart}
                </button>
              ))}
            </div>
          </div>

          {scope === 'whole' ? (
            <p className="text-muted-foreground text-sm">
              {t.creditNoteWholeHint(money(doc.total))}
            </p>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="cn-amount">{t.creditNoteAmount}</Label>
              <div className="relative">
                <Input
                  id="cn-amount"
                  inputMode="decimal"
                  autoComplete="off"
                  autoFocus
                  className="pr-12 tabular-nums"
                  aria-invalid={!!error}
                  aria-describedby="cn-amount-note"
                  value={amountText}
                  onChange={(e) => setAmountText(e.target.value)}
                />
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted-foreground text-sm"
                >
                  {doc.currency === 'CZK' ? 'Kč' : doc.currency}
                </span>
              </div>
              <FieldError id="cn-amount-note">{error}</FieldError>
              {!error && (
                <p id="cn-amount-note" className="text-muted-foreground text-xs">
                  {t.creditNoteMax(money(doc.total))}
                </p>
              )}
              {rows.length > 0 && (
                <dl
                  aria-label={t.creditNoteSplit}
                  className="space-y-1 rounded-lg bg-muted/60 p-3 text-sm tabular-nums"
                  data-testid="credit-split"
                >
                  {rows.map((r) => (
                    <div key={r.rate} className="flex items-baseline justify-between gap-3">
                      <dt className="text-muted-foreground">
                        {Number(r.rate) > 0 ? `${r.rate} %` : t.creditNoteBase}
                      </dt>
                      <dd className="text-right">
                        {Number(r.rate) > 0
                          ? `${t.creditNoteBase} ${money(r.base)} · ${t.creditNoteVat} ${money(r.vat)}`
                          : money(r.base)}
                      </dd>
                    </div>
                  ))}
                  <div className="flex items-baseline justify-between gap-3 border-t pt-1 font-medium">
                    <dt>{t.creditNoteTotal}</dt>
                    <dd>{money(amount ?? '0')}</dd>
                  </div>
                </dl>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="cn-reason">{t.creditNotePrompt}</Label>
            <Input
              id="cn-reason"
              value={reason}
              autoComplete="off"
              autoFocus={scope === 'whole'}
              onChange={(e) => setReason(e.target.value)}
            />
            <div className="flex flex-wrap gap-1.5">
              {t.creditNoteReasons.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className={cn(
                    'h-7 rounded-full border px-2.5 text-xs outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50',
                    reason === r && 'border-foreground/40 bg-muted',
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {cs.common.cancel}
            </Button>
            <Button type="submit" disabled={blocked}>
              {t.creditNote}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
