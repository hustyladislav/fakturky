import type { RouterOutputs } from '@fakturky/core/router'
import { cn } from '@fakturky/ui/lib/utils'
import { cs } from '@/i18n/cs'
import { FILTERS, type Filter } from './list-search'

export type Stats = RouterOutputs['documents']['stats']

/** Underline tabs with plain counts. On a phone the count sits under the label so all five fit. */
export function StatusTabs({
  stats,
  value,
  onChange,
}: {
  stats: Stats | undefined
  value: Filter
  onChange: (filter: Filter) => void
}) {
  return (
    <div
      role="group"
      aria-label={cs.invoices.tabsLabel}
      className="hairline-b mb-4 flex justify-between gap-3 max-[379px]:gap-1 sm:justify-start sm:gap-6"
    >
      {FILTERS.map((f) => {
        const active = value === f
        const count = stats?.[f].count
        const danger = f === 'overdue' && (count ?? 0) > 0
        return (
          <button
            key={f}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(f)}
            className={cn(
              '-mb-px flex flex-col items-start gap-0.5 border-b-2 py-2 text-[13px] whitespace-nowrap max-[379px]:text-xs outline-none focus-visible:rounded-sm focus-visible:ring-3 focus-visible:ring-ring/50 sm:h-11 sm:flex-row sm:items-center sm:gap-2 sm:py-0 sm:text-sm',
              active
                ? 'border-primary font-medium text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {cs.invoices.filters[f]}
            <span
              className={cn(
                'text-xs font-normal tabular-nums',
                danger ? 'text-destructive' : 'text-muted-foreground',
              )}
            >
              {count ?? ' '}
            </span>
          </button>
        )
      })}
    </div>
  )
}
