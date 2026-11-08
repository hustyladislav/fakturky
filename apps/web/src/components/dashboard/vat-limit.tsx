import type { RouterOutputs } from '@fakturky/core/router'
import { Money } from '@fakturky/ui/components/money'
import { cn } from '@fakturky/ui/lib/utils'
import { cs } from '@/i18n/cs'

type VatLimit = NonNullable<RouterOutputs['dashboard']['summary']['vatLimit']>

const t = cs.overview.vatLimit

/**
 * Non-payer registration tracker: one thin bar scaled to the "immediate" threshold, with both
 * legal thresholds marked (2 000 000 and 2 536 500 Kč). The state is always spelled out in text.
 */
export function VatLimitCard({ vat, className }: { vat: VatLimit; className?: string }) {
  const limit = Number(vat.limit)
  const immediate = Number(vat.immediateLimit)
  const scale = immediate * 1.04
  const fillPct = Math.min(100, (Number(vat.turnover) / scale) * 100)
  const warn = vat.percent >= 80
  return (
    <section className={className}>
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-xl leading-7">{t.title}</h2>
        <span
          className={cn(
            'text-[13px] tabular-nums',
            vat.immediateExceeded
              ? 'font-medium text-destructive'
              : warn
                ? 'font-medium text-warning'
                : 'text-muted-foreground',
          )}
        >
          {t.progress(vat.percent)}
        </span>
      </div>
      <p className="mt-1 text-[13px] text-muted-foreground tabular-nums">
        <Money amount={vat.turnover} className="text-foreground" /> · {t.description(vat.year)}
      </p>

      <div className="relative mt-4 mb-2">
        <div
          role="progressbar"
          aria-label={t.title}
          aria-valuenow={vat.percent}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-1 overflow-hidden rounded-full bg-muted"
        >
          <div
            className={cn(
              'h-full rounded-full',
              vat.immediateExceeded ? 'bg-destructive' : warn ? 'bg-warning' : 'bg-primary',
            )}
            style={{ width: `${fillPct}%` }}
          />
        </div>
        {[limit, immediate].map((v) => (
          <span
            key={v}
            aria-hidden
            className="absolute -top-1 block h-3 w-px bg-foreground/45"
            style={{ left: `${(v / scale) * 100}%` }}
          />
        ))}
      </div>

      <p className="flex justify-between gap-4 text-xs text-muted-foreground tabular-nums">
        <span>
          {t.limit} <Money amount={`${vat.limit}.00`} className="[&>span]:hidden" />
        </span>
        <span>
          {t.immediateMark}{' '}
          <Money amount={`${vat.immediateLimit}.00`} className="[&>span]:hidden" />
        </span>
      </p>

      {vat.immediateExceeded ? (
        <p className="mt-3 text-sm font-medium text-destructive">{t.immediate}</p>
      ) : (
        warn && <p className="mt-3 text-sm text-warning">{t.warn}</p>
      )}
    </section>
  )
}
