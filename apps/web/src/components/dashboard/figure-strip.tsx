import type { RouterOutputs } from '@fakturky/core/router'
import { parseDecimal } from '@fakturky/domain/money'
import { Amount } from '@fakturky/ui/components/amount'
import { cn } from '@fakturky/ui/lib/utils'
import type { ReactNode } from 'react'
import { cs } from '@/i18n/cs'
import { deltaPercent } from '@/lib/chart-scale'
import { crowns } from '@/lib/crowns'

type Summary = RouterOutputs['dashboard']['summary']

const t = cs.overview.kpi

function Figure({
  label,
  amount,
  size,
  tone,
  children,
}: {
  label: string
  amount: string
  size: 'hero' | 'md'
  tone?: 'overdue' | 'ink'
  children: ReactNode
}) {
  return (
    <div data-slot="figure" className="min-w-0">
      <dt className="text-[13px] text-muted-foreground">{label}</dt>
      <dd className="mt-1.5">
        <Amount value={amount} size={size} tone={tone} hideZeroFraction />
        <div className="mt-1 space-y-0.5 text-[13px] text-muted-foreground">{children}</div>
      </dd>
    </div>
  )
}

/** "+12 % vs. minulý měsíc": plain text, no chip; nothing when both months are empty. */
function Trend({ current, previous }: { current: string; previous: string }) {
  const [now, before] = [parseDecimal(current), parseDecimal(previous)]
  if (before.isZero()) return now.isZero() ? null : <p>{t.lastMonthZero}</p>
  const percent = deltaPercent(now.toNumber(), before.toNumber()) ?? 0
  return (
    <p className="tabular-nums">
      {percent >= 0 ? '+' : '−'}
      {Math.abs(percent)}&nbsp;% {t.vsLast}
    </p>
  )
}

/** The one question first: how much is outstanding and how much of it is overdue. */
export function OutstandingFigures({ s, className }: { s: Summary; className?: string }) {
  const overdue = s.overdueCount > 0
  return (
    <dl className={cn('grid gap-x-8 gap-y-6 @md:grid-cols-2', className)}>
      <Figure label={t.unpaid} amount={s.unpaid} size="hero">
        <p>{t.unpaidHint(s.unpaidCount)}</p>
      </Figure>
      <Figure
        label={t.overdue}
        amount={s.overdue}
        size="hero"
        tone={overdue ? 'overdue' : undefined}
      >
        <p className={cn(overdue && 'text-destructive')}>
          {overdue ? t.overdueHint(s.overdueCount, s.oldestOverdueDays) : t.none}
        </p>
      </Figure>
    </dl>
  )
}

/** This month's turnover and received payments; the "bez DPH, včetně dobropisů" caveat stays visible. */
export function MonthFigures({ s, className }: { s: Summary; className?: string }) {
  const prev = s.months.at(-2)
  const credit = parseDecimal(s.monthCreditNotes).lt(0)
  return (
    <dl className={cn('grid grid-cols-2 gap-x-6 gap-y-6', className)}>
      <Figure label={t.month} amount={s.monthTurnover} size="md" tone="ink">
        <p>{credit ? t.monthCredit(crowns(s.monthCreditNotes)) : t.monthHint}</p>
        <Trend current={s.monthTurnover} previous={prev?.turnover ?? '0'} />
      </Figure>
      <Figure label={t.received} amount={s.monthReceived} size="md">
        <p>{t.receivedHint}</p>
        <Trend current={s.monthReceived} previous={prev?.received ?? '0'} />
      </Figure>
    </dl>
  )
}
