import { Amount } from '@fakturky/ui/components/amount'
import { Money } from '@fakturky/ui/components/money'
import { cn } from '@fakturky/ui/lib/utils'
import { cs } from '@/i18n/cs'
import { num, validNum } from '@/lib/invoice-numbers'
import type { InvoiceDraft } from './use-invoice-draft'

const t = cs.invoices.form

function Row({
  label,
  amount,
  currency,
  muted,
}: {
  label: string
  amount: string
  currency: string
  muted?: boolean
}) {
  return (
    <div className={cn('flex justify-between gap-6', muted && 'text-muted-foreground')}>
      <span>{label}</span>
      <Money amount={amount} currency={currency} />
    </div>
  )
}

/** Recap under the items: base, VAT per rate, rounding, total, and the round-up switch. */
export function Totals({ draft }: { draft: InvoiceDraft }) {
  const { totals, vatPayer, foreign, isProforma, fields } = draft
  const { currency, exchangeRate } = fields
  return (
    <>
      {totals && (
        <div className="mt-6 ml-auto max-w-sm space-y-1 text-sm">
          {vatPayer && (
            <>
              <Row label={t.subtotal} amount={totals.subtotal} currency={currency} />
              {totals.recap.map((r) => (
                <Row
                  key={`${r.vatTreatment}-${r.vatRate}`}
                  label={`${t.vat} · ${t.vatRecapRow(r.vatRate)}`}
                  amount={r.vat}
                  currency={currency}
                  muted
                />
              ))}
            </>
          )}
          {Number(totals.rounding) !== 0 && (
            <Row label={t.rounding} amount={totals.rounding} currency={currency} muted />
          )}
          {vatPayer && foreign && validNum(exchangeRate) && Number(num(exchangeRate)) > 0 && (
            <Row label={t.vatInCzk} amount={totals.vatTotalCzk} currency="CZK" muted />
          )}
          <div className="hairline mt-2 flex items-baseline justify-between gap-6 pt-3">
            <span className="text-muted-foreground">{t.total}</span>
            <Amount value={totals.total} currency={currency} size="lg" />
          </div>
          {!vatPayer && (
            <p className="text-muted-foreground text-xs">
              {isProforma ? t.proformaNoVat : t.nonPayer}
            </p>
          )}
        </div>
      )}
      <label className="mt-4 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={fields.roundTotal}
          onChange={(e) => draft.set({ roundTotal: e.target.checked })}
        />
        {t.roundTotal}
      </label>
    </>
  )
}
