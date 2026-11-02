import type { RouterOutputs } from '@fakturky/core/router'
import { moneyParts } from '@fakturky/ui/lib/money'
import { cn } from '@fakturky/ui/lib/utils'
import { cs } from '@/i18n/cs'

export const STRIP_FILTERS = ['all', 'draft', 'unpaid', 'overdue', 'paid'] as const
export type StripFilter = (typeof STRIP_FILTERS)[number]

type Stats = RouterOutputs['documents']['stats']

const labels: Record<StripFilter, string> = {
  all: cs.invoices.filters.all,
  draft: cs.invoices.filters.draft,
  unpaid: cs.invoices.filters.unpaid,
  overdue: cs.invoices.filters.overdue,
  paid: cs.invoices.filters.paid,
}

/** `92 400 Kč`: whole crowns, non-breaking. Haléře are noise in a summary. */
export function crowns(amount: string): string {
  const p = moneyParts(String(Math.round(Number(amount))))
  return `${p.negative ? '−' : ''}${p.integer} ${p.currency}`
}

/**
 * Filter chips as summary cards: micro-label, count (Geist Serif) and the CZK sum underneath.
 * One card is always active (toggle buttons in a group).
 */
export function SummaryStrip({
  stats,
  value,
  onChange,
}: {
  stats: Stats | undefined
  value: StripFilter
  onChange: (filter: StripFilter) => void
}) {
  return (
    <div
      role="group"
      aria-label={cs.invoices.title}
      className="-mx-4 mb-6 flex scroll-px-4 snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] @4xl:mx-0 @4xl:grid @4xl:grid-cols-5 @4xl:overflow-visible @4xl:px-0 @4xl:pb-0 [&::-webkit-scrollbar]:hidden"
    >
      {STRIP_FILTERS.map((f) => {
        const b = stats?.[f]
        const active = value === f
        const danger = f === 'overdue' && (b?.count ?? 0) > 0
        return (
          <button
            key={f}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(f)}
            className={cn(
              'sheet group relative min-w-[8.5rem] shrink-0 snap-start px-4 py-3.5 text-left outline-none transition-[box-shadow,transform] @4xl:min-w-0',
              'focus-visible:ring-3 focus-visible:ring-ring/50 motion-safe:hover:-translate-y-px',
              active &&
                'shadow-[0_0_0_1.5px_var(--primary),0_1px_2px_rgb(40_30_10/0.04),0_8px_24px_-12px_rgb(40_30_10/0.12)]',
            )}
          >
            <span className="flex items-center justify-between gap-2">
              <span className={cn('label-caps', active && 'text-primary')}>{labels[f]}</span>
              {b && (
                <span
                  className={cn(
                    'font-serif text-xl leading-6 tabular-nums',
                    danger && 'text-destructive',
                  )}
                >
                  {b.count}
                </span>
              )}
            </span>
            <span
              className={cn(
                'mt-2 block text-[13px] tabular-nums',
                danger ? 'text-destructive' : 'text-muted-foreground',
              )}
            >
              {b ? crowns(b.sum) : ' '}
            </span>
          </button>
        )
      })}
    </div>
  )
}
