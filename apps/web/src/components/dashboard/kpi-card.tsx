import { Amount } from '@fakturky/ui/components/amount'
import { cn } from '@fakturky/ui/lib/utils'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { cs } from '@/i18n/cs'
import { deltaPercent } from '@/lib/chart-scale'
import { Sparkline } from './sparkline'

const t = cs.overview.kpi

/** KPI cards show whole crowns: haléře are noise at headline size. */
export function wholeCrowns(amount: string): string {
  const rounded = Math.round(Number(amount))
  return `${rounded === 0 ? 0 : rounded}.00`
}

/**
 * "↗ +12 % vs. minulý měsíc": green up, muted red down. Without a base month it says what last
 * month was instead; renders nothing when both months are empty.
 */
export function Delta({
  current,
  previous,
  neutral = false,
}: {
  current: number
  previous: number
  /** Grey chip: the change has an explainable, non-alarming cause (e.g. a credit note). */
  neutral?: boolean
}) {
  if (previous === 0) {
    return current === 0 ? null : <span>{t.lastMonthZero}</span>
  }
  const percent = deltaPercent(current, previous) ?? 0
  const up = percent >= 0
  const Icon = up ? ArrowUpRight : ArrowDownRight
  return (
    <span className="flex items-center gap-1.5">
      <span
        className={cn(
          'inline-flex h-5 items-center gap-0.5 rounded-full px-1.5 text-[11px] font-semibold tabular-nums',
          neutral
            ? 'bg-muted text-muted-foreground'
            : up
              ? 'bg-success/12 text-success'
              : 'bg-destructive/10 text-destructive',
        )}
      >
        <Icon className="size-3" aria-hidden />
        {up ? '+' : '−'}
        {Math.abs(percent)}&nbsp;%
      </span>
      <span className="whitespace-nowrap">{t.vsLast}</span>
    </span>
  )
}

/**
 * One headline number: micro-label, Geist Serif amount (counts up on first paint), then a footer line
 * with the delta / hint on the left and an optional sparkline on the right.
 */
export function KpiCard({
  label,
  amount,
  tone,
  delta,
  hint,
  spark,
  sparkTone,
  className,
}: {
  label: string
  amount: string
  tone?: 'overdue' | 'success' | 'ink'
  delta?: ReactNode
  hint?: ReactNode
  spark?: number[]
  sparkTone?: 'primary' | 'destructive' | 'muted'
  className?: string
}) {
  return (
    <div
      data-slot="kpi-card"
      className={cn(
        'sheet relative flex min-w-0 flex-col justify-between gap-4 overflow-hidden p-5',
        spark && 'pb-14',
        className,
      )}
    >
      <div>
        <div className="label-caps">{label}</div>
        <div className="mt-3">
          <Amount
            value={amount}
            size="lg"
            tone={tone}
            animate
            hideZeroFraction
            className="text-[32px] leading-9"
          />
        </div>
      </div>
      <div className="flex min-w-0 flex-col items-start gap-1.5 text-xs text-muted-foreground">
        {delta}
        <span className={cn('leading-4', tone === 'overdue' && 'text-destructive')}>{hint}</span>
      </div>
      {spark && (
        <Sparkline
          values={spark}
          tone={sparkTone}
          className="pointer-events-none absolute inset-x-0 bottom-0"
        />
      )}
    </div>
  )
}
