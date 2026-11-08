import type { RouterOutputs } from '@fakturky/core/router'
import { Money } from '@fakturky/ui/components/money'
import { SectionLabel } from '@fakturky/ui/components/page-header'
import { cn } from '@fakturky/ui/lib/utils'
import { cs } from '@/i18n/cs'

type VatLimit = NonNullable<RouterOutputs['dashboard']['summary']['vatLimit']>

const t = cs.overview.vatLimit

/**
 * Non-payer registration tracker: one bar scaled to the "immediate" threshold, with both legal
 * thresholds marked (2 000 000 and 2 536 500 Kč).
 */
export function VatLimitCard({ vat, className }: { vat: VatLimit; className?: string }) {
  const turnover = Number(vat.turnover)
  const limit = Number(vat.limit)
  const immediate = Number(vat.immediateLimit)
  const scale = immediate * 1.04
  const fillPct = Math.min(100, (turnover / scale) * 100)
  const limitPct = (limit / scale) * 100
  const immediatePct = (immediate / scale) * 100
  const warn = vat.percent >= 80
  return (
    <section className={cn('sheet p-5', className)}>
      <SectionLabel>{t.title}</SectionLabel>
      <div className="mt-4 flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xl leading-7 tabular-nums">
            <Money amount={vat.turnover} />
          </div>
          <div className="text-xs text-muted-foreground">{t.description(vat.year)}</div>
        </div>
        <span
          className={cn(
            'shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums',
            vat.immediateExceeded
              ? 'bg-destructive/12 text-destructive'
              : warn
                ? 'bg-warning/14 text-warning'
                : 'bg-muted text-muted-foreground',
          )}
        >
          {t.progress(vat.percent)}
        </span>
      </div>

      <div className="relative mt-5 mb-5">
        <div
          role="progressbar"
          aria-label={t.title}
          aria-valuenow={vat.percent}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-2 overflow-hidden rounded-full bg-muted"
        >
          <div
            className={cn(
              'h-full rounded-full motion-safe:transition-[width] motion-safe:duration-700',
              vat.immediateExceeded ? 'bg-destructive' : warn ? 'bg-warning' : 'bg-primary',
            )}
            style={{ width: `${fillPct}%` }}
          />
        </div>
        {[limitPct, immediatePct].map((pct) => (
          <span
            key={pct}
            aria-hidden
            className="absolute -top-1 block h-4 w-px bg-foreground/45"
            style={{ left: `${pct}%` }}
          />
        ))}
      </div>

      <dl className="mb-4 grid grid-cols-2 gap-4 text-xs">
        <div>
          <dt className="label-caps !text-[10px]">{t.limit}</dt>
          <dd className="mt-0.5 text-foreground tabular-nums">
            <Money amount={`${vat.limit}.00`} className="[&>span]:hidden" />
          </dd>
        </div>
        <div>
          <dt className="label-caps !text-[10px]">{t.immediateMark}</dt>
          <dd className="mt-0.5 text-foreground tabular-nums">
            <Money amount={`${vat.immediateLimit}.00`} className="[&>span]:hidden" />
          </dd>
        </div>
      </dl>

      {vat.immediateExceeded ? (
        <p className="text-sm font-medium text-destructive">{t.immediate}</p>
      ) : (
        warn && <p className="text-sm text-warning">{t.warn}</p>
      )}
    </section>
  )
}
