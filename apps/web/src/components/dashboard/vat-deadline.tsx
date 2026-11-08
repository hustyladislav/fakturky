import { formatDateCs, todayPrague } from '@fakturky/domain/dates'
import { vatReminderPeriod } from '@fakturky/domain/vat-report'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { cs } from '@/i18n/cs'
import { orpc } from '@/lib/orpc'

const t = cs.overview.vatDeadline

/**
 * VAT payers' counterpart of the registration tracker: when the next return is due. The period
 * flips on the date alone (there is no "filed" state), and the deadline ignores public holidays.
 */
export function VatDeadline() {
  const profile = useQuery(orpc.businessProfile.get.queryOptions({ input: {} }))
  const payer = profile.data?.vatStatus === 'payer'
  const period = vatReminderPeriod(
    todayPrague(),
    profile.data?.vatFiling?.period === 'quarterly' ? 'quarterly' : 'monthly',
  )
  const report = useQuery({
    ...orpc.vat.report.queryOptions({
      input: {
        year: period.year,
        ...(period.kind === 'month' ? { month: period.month } : { quarter: period.quarter }),
      },
    }),
    enabled: payer,
  })
  const r = report.data
  if (!payer || !r) return null

  const label =
    period.kind === 'month'
      ? `${cs.vat.months[period.month - 1]} ${period.year}`
      : `${cs.vat.quarter(period.quarter)} ${period.year}`
  const parts = [
    t.period(label),
    t.by(formatDateCs(r.deadline)),
    t.documents(r.documentCount),
    ...(r.warnings.length ? [t.warnings(r.warnings.length)] : []),
  ]
  return (
    <section>
      <Link
        to="/dph"
        className="-mx-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-md px-2 py-2 text-sm outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:py-3"
      >
        <span className="tabular-nums">{parts.join(' · ')}</span>
        <span className="text-muted-foreground">{r.filing.ready ? t.open : t.complete} →</span>
      </Link>
      <p className="mt-1 text-xs text-muted-foreground">{cs.vat.disclaimer}</p>
    </section>
  )
}
