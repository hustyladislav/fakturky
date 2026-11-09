import { formatDateCs, todayPrague } from '@fakturky/domain/dates'
import { parseDecimal } from '@fakturky/domain/money'
import { Amount } from '@fakturky/ui/components/amount'
import { RelativeDate } from '@fakturky/ui/components/relative-date'
import { diffDays, parseIsoDate } from '@fakturky/ui/lib/dates'
import { formatMoney } from '@fakturky/ui/lib/money'
import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { InvoiceStatus } from '@/components/invoices/invoice-status'
import { cs } from '@/i18n/cs'
import type { DocumentDetail } from '@/lib/document-sheet'

const t = cs.invoices.detail

/** Days past the due date (0 when not overdue). */
function overdueDaysOf(d: DocumentDetail): number {
  if (d.displayStatus !== 'overdue' || !d.dueDate) return 0
  const due = parseIsoDate(d.dueDate)
  const today = parseIsoDate(todayPrague())
  return due && today ? Math.max(0, diffDays(today, due)) : 0
}

type Mode = 'draft' | 'open' | 'paid' | 'cancelled' | 'creditNote' | 'receipt'

export function modeOf(d: DocumentDetail): Mode {
  if (d.status === 'draft') return 'draft'
  if (d.status === 'cancelled') return 'cancelled'
  if (d.type === 'credit_note') return 'creditNote'
  if (d.type === 'payment_receipt') return 'receipt'
  return d.status === 'issued' ? 'open' : 'paid'
}

function Row({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  )
}

/** Status, the amount that matters and when it is due: what a phone needs before anything else. */
export function Summary({ d, children }: { d: DocumentDetail; children?: ReactNode }) {
  const mode = modeOf(d)
  const overdueDays = overdueDaysOf(d)
  const bankPayments = d.payments.filter((p) => p.source === 'bank')
  const lastBank = bankPayments[bankPayments.length - 1]
  const showProgress =
    mode === 'open' && parseDecimal(d.paidAmount).gt(0) && parseDecimal(d.total).gt(0)
  const paidPercent = showProgress
    ? Math.min(100, parseDecimal(d.paidAmount).div(d.total).times(100).toNumber())
    : 0
  const progressLabel = t.hero.paidOfTotal(
    formatMoney(d.paidAmount, d.currency),
    formatMoney(d.total, d.currency),
  )

  return (
    <section aria-label={t.hero[mode]} data-testid="doc-hero">
      <div className="flex items-center justify-between gap-3">
        <InvoiceStatus
          status={d.displayStatus}
          viaAssistant={d.viaAssistant}
          {...(overdueDays ? { overdueDays } : {})}
        />
        {d.importedFrom && (
          <span className="text-muted-foreground text-xs">{cs.import.imported}</span>
        )}
      </div>

      <p className="mt-4 text-[13px] text-muted-foreground">{t.hero[mode]}</p>
      <Amount
        size="hero"
        value={mode === 'open' ? d.remaining : d.total}
        currency={d.currency}
        tone={
          d.displayStatus === 'overdue'
            ? 'overdue'
            : mode === 'cancelled' || mode === 'creditNote'
              ? 'muted'
              : mode === 'paid'
                ? 'success'
                : 'default'
        }
        className="mt-1 block text-[40px]"
      />

      {showProgress && (
        <div className="mt-3">
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(paidPercent)}
            aria-label={progressLabel}
            className="h-1 overflow-hidden rounded-full bg-muted"
          >
            <div className="h-full rounded-full bg-success" style={{ width: `${paidPercent}%` }} />
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground tabular-nums">{progressLabel}</p>
        </div>
      )}

      {mode === 'draft' && <p className="mt-3 text-sm text-muted-foreground">{t.hero.draftHint}</p>}
      <dl className="mt-3 space-y-1.5 text-sm empty:hidden">
        {mode === 'open' && d.dueDate && (
          <Row label={t.hero.dueOn}>
            <RelativeDate date={d.dueDate} tone="due" />
            <span className="text-muted-foreground"> · {formatDateCs(d.dueDate)}</span>
          </Row>
        )}
        {mode === 'paid' && d.paidAt && (
          <Row label={t.hero.paid}>{formatDateCs(todayPrague(d.paidAt))}</Row>
        )}
        {mode === 'creditNote' && d.parent && (
          <Row label={t.hero.correctsDocument}>
            <Link
              to="/faktury/$id"
              params={{ id: d.parent.id }}
              className="underline underline-offset-2"
            >
              {d.parent.number ?? cs.invoices.draftNumber}
            </Link>
          </Row>
        )}
        {d.payments
          .filter((p) => p.method === 'credit_note')
          .map((p) => (
            <Row key={p.id} label={t.creditedBy(p.note ?? '')}>
              <Amount value={p.amount} currency={d.currency} size="sm" />
            </Row>
          ))}
      </dl>
      {lastBank && (
        <p className="mt-1.5 text-sm text-muted-foreground" data-testid="paid-by-transfer">
          {d.status === 'paid'
            ? t.paidByTransfer(formatDateCs(lastBank.paidOn))
            : t.partlyPaidByTransfer(formatDateCs(lastBank.paidOn))}
        </p>
      )}

      {children && <div className="mt-5 space-y-2">{children}</div>}
    </section>
  )
}
