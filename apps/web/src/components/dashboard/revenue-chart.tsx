import type { RouterOutputs } from '@fakturky/core/router'
import { sum } from '@fakturky/domain/money'
import { Amount } from '@fakturky/ui/components/amount'
import { formatMoney } from '@fakturky/ui/lib/money'
import { cn } from '@fakturky/ui/lib/utils'
import { useId, useMemo, useState } from 'react'
import { cs } from '@/i18n/cs'
import { compactCz, niceTicks } from '@/lib/chart-scale'
import { wholeCrowns } from '@/lib/crowns'

type Month = RouterOutputs['dashboard']['summary']['months'][number]

const t = cs.overview.chart

// Unpaid is hatched, paid is solid: the difference survives grayscale and colour blindness.
const HATCH =
  'repeating-linear-gradient(135deg, color-mix(in srgb, var(--primary) 70%, transparent) 0 1.5px, transparent 1.5px 4px)'

function Swatch({ kind }: { kind: 'paid' | 'unpaid' }) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-block size-2.5 rounded-[2px]',
        kind === 'paid' ? 'bg-primary' : 'ring-1 ring-primary/60 ring-inset',
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
 * Monthly turnover as thin stacked bars: paid (solid) + not yet paid (hatched). Hand-rolled with
 * plain elements: compact Czech axis, hover/focus tooltip, current month labelled in ink, 6/12 month toggle. Static: it is seen daily, so nothing grows in.
 */
export function RevenueChart({ months, className }: { months: Month[]; className?: string }) {
  // Start the axis at the first month with data (at least 6 months); new accounts default to 6.
  const firstData = months.findIndex((m) => Number(m.turnover) !== 0 || Number(m.received) !== 0)
  const history = firstData < 0 ? 0 : months.length - firstData
  const [range, setRange] = useState<6 | 12>(history > 6 ? 12 : 6)
  const headingId = useId()

  const span = Math.min(range, Math.max(history, 6))
  const shown = useMemo(() => months.slice(-span), [months, span])
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
  const total = sum(shown.map((m) => m.turnover))
  const empty = peak === 0
  const currentKey = months.at(-1)?.month

  return (
    <section className={cn('@container', className)} aria-labelledby={headingId}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 id={headingId} className="text-xl leading-7">
            {t.title}
          </h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            <Amount
              value={wholeCrowns(total.toFixed(2))}
              size="sm"
              hideZeroFraction
              className="text-foreground"
            />{' '}
            {t.caption(span)}
          </p>
        </div>
        {history > 6 && (
          <div role="group" aria-label={t.range} className="flex shrink-0 gap-0.5">
            {([6, 12] as const).map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={range === r}
                onClick={() => setRange(r)}
                className={cn(
                  'h-8 rounded-md px-2.5 text-[13px] whitespace-nowrap outline-none focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:h-11 pointer-coarse:px-3',
                  range === r
                    ? 'bg-muted font-medium text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {r === 6 ? t.sixMonths : t.twelveMonths}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-5 grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-2">
        {/* y axis */}
        <div className="relative mb-7 h-36 @xl:h-44" aria-hidden>
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

        <div className="relative mb-7 h-36 @xl:h-44">
          {ticks.map((v) => (
            <div
              key={v}
              aria-hidden
              className={cn(
                'absolute inset-x-0 border-t',
                v === 0 ? 'border-border' : 'border-border/50',
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
              const paidPct = (r.paidN / top) * 100
              const unpaidPct = (r.unpaidN / top) * 100
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
                      className="absolute inset-x-0.5 inset-y-0 rounded-md group-hover:bg-foreground/[0.04] group-focus-visible:bg-foreground/[0.06] group-focus-visible:ring-2 group-focus-visible:ring-ring/60"
                    />
                    {r.stack === 0 ? (
                      <span
                        aria-hidden
                        className="absolute bottom-0 left-1/2 h-0.5 w-3 -translate-x-1/2 rounded-full bg-border"
                      />
                    ) : (
                      <span
                        aria-hidden
                        className="absolute bottom-0 left-1/2 flex w-3 -translate-x-1/2 flex-col-reverse overflow-hidden rounded-t-[2px]"
                        style={{ height: `${stackPct}%` }}
                      >
                        <span
                          className="w-full bg-primary"
                          style={{ height: stackPct ? `${(paidPct / stackPct) * 100}%` : 0 }}
                        />
                        <span
                          className="w-full"
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
                        current ? 'font-medium text-foreground' : 'text-muted-foreground',
                        // On narrow screens only every second month is labelled (the last always).
                        (rows.length - 1 - i) % 2 === 1 && '@max-xl:invisible',
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
                    <div className="mb-2 font-medium">
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

      <div className="flex items-center gap-4 pl-[calc(2.5rem+0.5rem)] text-xs text-muted-foreground">
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
