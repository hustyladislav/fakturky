import { formatDateCs, todayPrague } from '@fakturky/domain/dates'
import { Amount } from '@fakturky/ui/components/amount'
import { RelativeDate } from '@fakturky/ui/components/relative-date'
import { cn } from '@fakturky/ui/lib/utils'
import { RailSection } from '@/components/invoice-detail/rail-section'
import { cs } from '@/i18n/cs'
import type { DocumentDetail } from '@/lib/document-sheet'

const t = cs.invoices.detail

const TIME = new Intl.DateTimeFormat('cs-CZ', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Prague',
})

/** What happened, newest last: a dot per step, a hollow one for the due date still ahead. */
export function Timeline({ d, className }: { d: DocumentDetail; className?: string }) {
  const open = d.status === 'issued' && d.type !== 'credit_note'
  return (
    <RailSection title={t.history} {...(className && { className })}>
      <ol>
        {d.activity.map((a, i) => {
          const data = (a.data ?? {}) as { amount?: string; to?: string }
          const settled = a.action === 'paid' || a.action === 'bank_matched'
          const last = i === d.activity.length - 1 && !(open && d.dueDate)
          return (
            <li key={a.id} className="relative flex gap-3 pb-4 last:pb-0">
              {!last && (
                <span aria-hidden className="absolute top-3 bottom-0 left-[3px] w-px bg-border" />
              )}
              <span
                aria-hidden
                className={cn(
                  'relative mt-[7px] size-[7px] shrink-0 rounded-full bg-muted-foreground/60',
                  settled && 'bg-success',
                  a.action === 'cancelled' && 'bg-destructive',
                )}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="text-sm">
                    {t.timeline[a.action as keyof typeof t.timeline] ?? a.action}
                  </span>
                  <time
                    dateTime={a.createdAt.toISOString()}
                    className="text-xs text-muted-foreground tabular-nums"
                  >
                    {formatDateCs(todayPrague(a.createdAt))} · {TIME.format(a.createdAt)}
                  </time>
                </div>
                {data.amount && (
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                    <Amount value={data.amount} currency={d.currency} size="sm" />
                    <span>· {a.action === 'bank_matched' ? t.viaBank : t.manual}</span>
                  </p>
                )}
                {data.to && (
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{data.to}</p>
                )}
              </div>
            </li>
          )
        })}
        {open && d.dueDate && (
          <li className="relative flex gap-3">
            <span
              aria-hidden
              className="mt-[7px] size-[7px] shrink-0 rounded-full border border-muted-foreground/60"
            />
            <div className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-3">
              <span className="text-sm text-muted-foreground">{t.dueStep}</span>
              <span className="text-xs tabular-nums">
                <RelativeDate date={d.dueDate} tone="due" />
                <span className="text-muted-foreground"> · {formatDateCs(d.dueDate)}</span>
              </span>
            </div>
          </li>
        )}
      </ol>
    </RailSection>
  )
}
