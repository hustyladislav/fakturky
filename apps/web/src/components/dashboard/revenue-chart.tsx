import type { RouterOutputs } from '@fakturky/core/router'
import { Amount } from '@fakturky/ui/components/amount'
import { formatMoney } from '@fakturky/ui/lib/money'
import { cn } from '@fakturky/ui/lib/utils'
import { useEffect, useId, useMemo, useState } from 'react'
import { cs } from '@/i18n/cs'
import { compactCz, niceTicks } from '@/lib/chart-scale'
import { wholeCrowns } from './kpi-card'

type Month = RouterOutputs['dashboard']['summary']['months'][number]

const t = cs.overview.chart

const HATCH =
  'repeating-linear-gradient(135deg, color-mix(in srgb, var(--primary) 60%, transparent) 0 1.5px, transparent 1.5px 5px)'

function Swatch({ kind }: { kind: 'paid' | 'unpaid' }) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-block size-2.5 rounded-[3px]',
        kind === 'paid' ? 'bg-primary' : 'bg-primary/15 ring-1 ring-primary/50 ring-inset',
      )}
      style={kind === 'unpaid' ? { backgroundImage: HATCH } : undefined}
    />
  )
}

function monthParts(key: string) {
  const [y, m] = key.split('-')
  return { year: Number(y), index: Number(m) - 1 }
}

/**
 * Stacked monthly turnover: paid (solid) + not yet paid (hatched). Hand-rolled with plain
 * elements, no chart library: axis with compact Czech labels, hover/focus tooltip, current month
 * highlighted, empty months as a faint baseline, 6/12 month toggle.
 */
export function RevenueChart({ months, className }: { months: Month[]; className?: string }) {
  const [range, setRange] = useState<6 | 12>(12)
  const [grown, setGrown] = useState(false)
  const headingId = useId()
  useEffect(() => {
    const raf = requestAnimationFrame(() => setGrown(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  const shown = useMemo(() => months.slice(-range), [months, range])
  const rows = useMemo(
    () =>
      shown.map((m) => {
        const paid = Math.max(0, Number(m.paid))
        const unpaid = Math.max(0, Number(m.unpaid))
        return { ...m, paidN: paid, unpaidN: unpaid, stack: paid + unpaid }
      }),
    [shown],
  )
  const peak = Math.max(0, ...rows.map((r) => r.stack))
  const ticks = niceTicks(Math.max(peak, 1))
  const top = ticks.at(-1) ?? 1
  const total = shown.reduce((sum, m) => sum + Number(m.turnover), 0)
  const empty = peak === 0
  const currentKey = months.at(-1)?.month

  return (
    <section className={cn('sheet p-5 sm:p-6', className)} aria-labelledby={headingId}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 id={headingId} className="label-caps">
            {t.title}
          </h2>
          <div className="mt-2.5">
            <Amount value={wholeCrowns(total.toFixed(2))} size="lg" hideZeroFraction />
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{t.caption(range)}</div>
        </div>
        <div
          role="group"
          aria-label={t.range}
          className="inline-flex shrink-0 rounded-lg bg-muted p-0.5"
        >
          {([6, 12] as const).map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={range === r}
              onClick={() => setRange(r)}
              className={cn(
                'h-7 rounded-md px-2.5 text-xs font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                range === r
                  ? 'bg-card text-foreground shadow-[0_0_0_1px_var(--border),0_1px_2px_rgb(0_0_0/0.06)]'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {r === 6 ? t.sixMonths : t.twelveMonths}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-[3rem_minmax(0,1fr)] gap-x-2">
        {/* y axis */}
        <div className="relative mb-7 h-[210px]" aria-hidden>
          {ticks.map((v) => (
            <span
              key={v}
              className="absolute right-0 -translate-y-1/2 text-[11px] leading-none text-muted-foreground tabular-nums"
              style={{ bottom: `${(v / top) * 100}%` }}
            >
              {compactCz(v, { thousand: t.thousand, million: t.million })}
            </span>
          ))}
        </div>

        <div className="relative mb-7 h-[210px]">
          {ticks.map((v) => (
            <div
              key={v}
              aria-hidden
              className={cn(
                'absolute inset-x-0 border-t',
                v === 0 ? 'border-border' : 'border-dashed border-border/70',
              )}
              style={{ bottom: `${(v / top) * 100}%` }}
            />
          ))}

          {empty && (
            <p className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-sm text-muted-foreground">
              {t.empty}
            </p>
          )}

          <ul className="absolute inset-0 flex">
            {rows.map((r, i) => {
              const { index, year } = monthParts(r.month)
              const current = r.month === currentKey
              const paidPct = grown ? (r.paidN / top) * 100 : 0
              const unpaidPct = grown ? (r.unpaidN / top) * 100 : 0
              const stackPct = paidPct + unpaidPct
              // Anchor the tooltip to the nearer edge so it never overflows the chart.
              const tipAlign =
                i < rows.length / 3
                  ? 'left-0'
                  : i >= (rows.length * 2) / 3
                    ? 'right-0'
                    : 'left-1/2 -translate-x-1/2'
              return (
                <li key={r.month} className="relative h-full min-w-0 flex-1">
                  <div
                    role="img"
                    tabIndex={0}
                    aria-label={`${t.monthsLong[index]} ${year}: ${t.turnover} ${formatMoney(r.turnover)}, ${t.paid} ${formatMoney(r.paid)}, ${t.unpaid} ${formatMoney(r.unpaid)}`}
                    className="group peer absolute inset-0 rounded-md outline-none"
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'absolute inset-x-0.5 inset-y-0 rounded-md transition-colors',
                        current ? 'bg-primary/[0.06]' : 'group-hover:bg-foreground/[0.04]',
                        'group-focus-visible:bg-foreground/[0.06] group-focus-visible:ring-2 group-focus-visible:ring-ring/60',
                      )}
                    />
                    {r.stack === 0 ? (
                      <span
                        aria-hidden
                        className="absolute inset-x-[22%] bottom-0 h-0.5 rounded-full bg-border"
                      />
                    ) : (
                      <span
                        aria-hidden
                        className="absolute bottom-0 left-1/2 flex w-[min(62%,44px)] -translate-x-1/2 flex-col-reverse overflow-hidden rounded-t-[4px]"
                        style={{ height: `${stackPct}%` }}
                      >
                        <span
                          className="w-full bg-primary motion-safe:transition-[height] motion-safe:duration-700 motion-safe:ease-[cubic-bezier(0.2,0.7,0.2,1)]"
                          style={{
                            height: stackPct ? `${(paidPct / stackPct) * 100}%` : 0,
                            transitionDelay: `${i * 28}ms`,
                          }}
                        />
                        <span
                          className="w-full bg-primary/15"
                          style={{
                            height: stackPct ? `${(unpaidPct / stackPct) * 100}%` : 0,
                            backgroundImage: HATCH,
                          }}
                        />
                      </span>
                    )}
                    <span
                      className={cn(
                        'pointer-events-none absolute top-full mt-2 inset-x-0 text-center text-xs tabular-nums',
                        current ? 'font-semibold text-foreground' : 'text-muted-foreground',
                        // On narrow screens only every second month is labelled (the last always).
                        (rows.length - 1 - i) % 2 === 1 && 'max-sm:invisible',
                      )}
                    >
                      {cs.overview.months[index]}
                    </span>
                  </div>

                  <div
                    role="presentation"
                    className={cn(
                      'shadow-floating pointer-events-none absolute z-20 w-56 rounded-lg bg-popover p-3 text-xs opacity-0 transition-opacity duration-100',
                      'peer-hover:opacity-100 peer-focus:opacity-100',
                      tipAlign,
                    )}
                    style={{ bottom: `calc(${Math.min(stackPct, 100)}% + 12px)` }}
                  >
                    <div className="label-caps mb-2">
                      {t.monthsLong[index]} {year}
                    </div>
                    <dl className="space-y-1.5 tabular-nums">
                      <div className="flex justify-between gap-3 font-medium">
                        <dt>{t.turnover}</dt>
                        <dd>{formatMoney(r.turnover)}</dd>
                      </div>
                      <div className="flex justify-between gap-3 text-muted-foreground">
                        <dt className="inline-flex items-center gap-1.5">
                          <Swatch kind="paid" />
                          {t.paid}
                        </dt>
                        <dd>{formatMoney(r.paid)}</dd>
                      </div>
                      <div className="flex justify-between gap-3 text-muted-foreground">
                        <dt className="inline-flex items-center gap-1.5">
                          <Swatch kind="unpaid" />
                          {t.unpaid}
                        </dt>
                        <dd>{formatMoney(r.unpaid)}</dd>
                      </div>
                    </dl>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      </div>

      <div className="mt-1 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Swatch kind="paid" />
          {t.paid}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Swatch kind="unpaid" />
          {t.unpaid}
        </span>
      </div>
    </section>
  )
}
