import { Button } from '@fakturky/ui/components/button'
import { Money } from '@fakturky/ui/components/money'
import { Skeleton } from '@fakturky/ui/components/skeleton'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { InvoiceStatus } from '@/components/invoice-status'
import { cs } from '@/i18n/cs'
import { pageHead } from '@/lib/head'
import { orpc } from '@/lib/orpc'

export const Route = createFileRoute('/_app/prehled')({
  head: pageHead(cs.nav.overview),
  component: Overview,
})

const t = cs.overview

function Kpi({
  label,
  hint,
  amount,
  tone,
}: {
  label: string
  hint: string
  amount: string
  tone?: 'danger'
}) {
  return (
    <div className="min-w-0 rounded-xl border p-4">
      <div className="text-muted-foreground text-sm">{label}</div>
      <div
        className={`mt-1 font-serif text-2xl font-medium break-words lg:text-3xl ${tone === 'danger' ? 'text-destructive' : ''}`}
      >
        <Money amount={amount} />
      </div>
      <div className="text-muted-foreground mt-1 text-xs">{hint}</div>
    </div>
  )
}

function Overview() {
  const summary = useQuery(orpc.dashboard.summary.queryOptions({ input: {} }))
  const recent = useQuery(orpc.documents.list.queryOptions({ input: { limit: 5 } }))
  const s = summary.data
  const hasDocs = (recent.data?.length ?? 0) > 0
  const max = Math.max(1, ...(s?.months.map((m) => Number(m.turnover)) ?? [0]))

  return (
    <div className="mx-auto max-w-[1200px] space-y-6">
      <h1 className="text-2xl font-semibold">{t.greeting}</h1>

      {recent.isSuccess && !hasDocs && (
        <div className="space-y-3 rounded-xl border p-6">
          <h2 className="font-semibold">{t.emptyTitle}</h2>
          <p className="text-muted-foreground text-sm">{t.emptyText}</p>
          <Button nativeButton={false} render={<Link to="/faktury/nova" />}>
            {cs.invoices.emptyCta}
          </Button>
        </div>
      )}

      {summary.isError && <p className="text-muted-foreground text-sm">{cs.common.error}</p>}

      {summary.isPending && (
        <div className="space-y-6" aria-busy="true">
          <div className="grid gap-3 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-[110px] rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-[198px] rounded-xl" />
        </div>
      )}

      {s && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Kpi label={t.kpi.month} hint={t.kpi.monthHint} amount={s.monthTurnover} />
            <Kpi label={t.kpi.unpaid} hint={t.kpi.unpaidHint} amount={s.unpaid} />
            <Kpi
              label={t.kpi.overdue}
              hint={s.overdueCount > 0 ? t.kpi.overdueHint(s.overdueCount) : t.kpi.none}
              amount={s.overdue}
              tone={s.overdueCount > 0 ? 'danger' : undefined}
            />
          </div>

          {s.overdueCount > 0 && (
            <div className="bg-destructive/8 flex flex-wrap items-center justify-between gap-2 rounded-lg p-3 text-sm">
              <span>{t.nudgeOverdue(s.oldestOverdueDays)}</span>
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={<Link to="/faktury" search={{ filter: 'overdue' }} />}
              >
                {t.nudgeAction}
              </Button>
            </div>
          )}

          {s.vatLimit && (
            <section className="space-y-3 rounded-xl border p-4">
              <div>
                <h2 className="font-semibold">{t.vatLimit.title}</h2>
                <p className="text-muted-foreground text-sm">
                  {t.vatLimit.description(s.vatLimit.year)}
                </p>
              </div>
              <div
                role="progressbar"
                aria-valuenow={s.vatLimit.percent}
                aria-valuemin={0}
                aria-valuemax={100}
                className="bg-muted h-2 overflow-hidden rounded-full"
              >
                <div
                  className={`h-full rounded-full ${s.vatLimit.percent >= 80 ? 'bg-warning' : 'bg-primary'}`}
                  style={{ width: `${s.vatLimit.percent}%` }}
                />
              </div>
              <div className="flex items-baseline justify-between text-sm">
                <span>
                  <Money amount={s.vatLimit.turnover} /> /{' '}
                  <Money amount={`${s.vatLimit.limit}.00`} />
                </span>
                <span className="text-muted-foreground">
                  {t.vatLimit.progress(s.vatLimit.percent)}
                </span>
              </div>
              {s.vatLimit.immediateExceeded ? (
                <p className="text-destructive text-sm font-medium">{t.vatLimit.immediate}</p>
              ) : (
                s.vatLimit.percent >= 80 && (
                  <p className="text-warning text-sm">{t.vatLimit.warn}</p>
                )
              )}
            </section>
          )}

          <section className="space-y-3 rounded-xl border p-4">
            <h2 className="font-semibold">{t.chart}</h2>
            <div className="flex h-32 items-end gap-2" role="img" aria-label={t.chart}>
              {s.months.map((m) => (
                <div key={m.month} className="flex h-full flex-1 flex-col items-center gap-1">
                  <div className="flex w-full flex-1 items-end">
                    <div
                      className="bg-primary/70 w-full rounded-t"
                      style={{ height: `${Math.max(2, (Number(m.turnover) / max) * 100)}%` }}
                      title={m.turnover}
                    />
                  </div>
                  <span className="text-muted-foreground text-xs">
                    {t.months[Number(m.month.slice(5, 7)) - 1]}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {hasDocs && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{t.recent}</h2>
            <Link to="/faktury" search={{ filter: 'all' }} className="text-sm underline">
              {t.allInvoices}
            </Link>
          </div>
          <div className="divide-y overflow-hidden rounded-xl border">
            {recent.data?.map((d) => (
              <Link
                key={d.id}
                to={d.status === 'draft' ? '/faktury/$id/upravit' : '/faktury/$id'}
                params={{ id: d.id }}
                className="hover:bg-muted/30 flex items-center justify-between gap-3 p-3 text-sm"
              >
                <div className="min-w-0">
                  <div className="font-medium tabular-nums">
                    {d.number ?? cs.invoices.draftNumber}
                  </div>
                  <div className="text-muted-foreground truncate">{d.customerName ?? '—'}</div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <Money amount={d.total} currency={d.currency} />
                  <InvoiceStatus status={d.displayStatus} viaAssistant={d.viaAssistant} />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
