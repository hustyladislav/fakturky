import { Amount } from '@fakturky/ui/components/amount'
import { Avatar } from '@fakturky/ui/components/avatar'
import { Button } from '@fakturky/ui/components/button'
import { EmptyState } from '@fakturky/ui/components/empty-state'
import { Kbd } from '@fakturky/ui/components/kbd'
import { PageHeader, SectionLabel } from '@fakturky/ui/components/page-header'
import { Skeleton } from '@fakturky/ui/components/skeleton'
import { moneyParts } from '@fakturky/ui/lib/money'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { FilePlus2, Landmark, Layers, Sparkles } from 'lucide-react'
import { AwaitingList } from '@/components/dashboard/awaiting-list'
import { Delta, KpiCard, wholeCrowns } from '@/components/dashboard/kpi-card'
import { RevenueChart } from '@/components/dashboard/revenue-chart'
import { VatLimitCard } from '@/components/dashboard/vat-limit'
import { InvoiceStatus } from '@/components/invoice-status'
import { useShell } from '@/components/shell/shell-context'
import { useModKey } from '@/components/shell/use-mod-key'
import { cs } from '@/i18n/cs'
import { pageHead } from '@/lib/head'
import { orpc } from '@/lib/orpc'

export const Route = createFileRoute('/_app/prehled')({
  head: pageHead(cs.nav.overview),
  component: Overview,
})

const t = cs.overview

/** `92 400 Kč` (whole crowns, non-breaking spaces) for running text. */
function crowns(amount: string) {
  const p = moneyParts(wholeCrowns(amount))
  return `${p.integer}\u00a0${p.currency}`
}

function today() {
  return new Intl.DateTimeFormat('cs-CZ', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date())
}

function QuickActions() {
  const shell = useShell()
  const mod = useModKey()
  return (
    <nav aria-label={t.quick.title} className="mb-6 flex flex-wrap gap-2">
      <Button
        nativeButton={false}
        render={<Link to="/faktury/nova" />}
        size="lg"
        className="px-3.5"
      >
        <FilePlus2 />
        {t.quick.newInvoice}
      </Button>
      <Button
        variant="outline"
        size="lg"
        nativeButton={false}
        render={<Link to="/sablony" />}
        className="bg-card px-3.5"
      >
        <Layers />
        {t.quick.fromTemplate}
      </Button>
      <Button
        variant="outline"
        size="lg"
        nativeButton={false}
        render={<Link to="/banka" />}
        className="bg-card px-3.5"
      >
        <Landmark />
        {t.quick.uploadStatement}
      </Button>
      <Button
        variant="outline"
        size="lg"
        onClick={() => shell.setAssistantOpen(true)}
        className="bg-card px-3.5"
      >
        <Sparkles />
        {t.quick.askAssistant}
        <Kbd className="ml-1 hidden sm:inline-flex">{mod} J</Kbd>
      </Button>
    </nav>
  )
}

function Overview() {
  const summary = useQuery(orpc.dashboard.summary.queryOptions({ input: {} }))
  const recent = useQuery(orpc.documents.list.queryOptions({ input: { limit: 5 } }))
  const unpaid = useQuery(
    orpc.documents.list.queryOptions({ input: { filter: 'unpaid', limit: 200 } }),
  )
  const s = summary.data
  const hasDocs = (recent.data?.length ?? 0) > 0

  const prev = s?.months.at(-2)
  const monthN = Number(s?.monthTurnover ?? 0)
  const spark = s?.months.slice(-6)

  const subtitle = s ? (
    <>
      {s.monthIssuedCount > 0
        ? t.summary.issued(s.monthIssuedCount, monthN > 0 ? crowns(s.monthTurnover) : null)
        : t.summary.none}{' '}
      {t.summary.awaiting(s.unpaidCount)}
    </>
  ) : undefined

  return (
    <div className="mx-auto max-w-[1200px]">
      <PageHeader eyebrow={today()} title={t.greeting} subtitle={subtitle} className="mb-5" />

      <QuickActions />

      {recent.isSuccess && !hasDocs && (
        <EmptyState
          illustration="invoices"
          title={t.emptyTitle}
          className="mb-6 bg-card"
          action={
            <Button nativeButton={false} render={<Link to="/faktury/nova" />}>
              {cs.invoices.emptyCta}
            </Button>
          }
        >
          {t.emptyText}
        </EmptyState>
      )}

      {summary.isError && <p className="text-sm text-muted-foreground">{cs.common.error}</p>}

      {summary.isPending && (
        <div className="space-y-5" aria-busy="true">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[142px] rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-[340px] rounded-xl" />
        </div>
      )}

      {s && (
        <div className="space-y-5">
          {/* KPIs: 4 across on desktop, 2x2 on tablet, a snap carousel on phones */}
          <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-2 md:gap-4 md:overflow-visible md:px-0 md:pb-0 lg:grid-cols-4 [&::-webkit-scrollbar]:hidden">
            <KpiCard
              className="w-[78%] shrink-0 snap-start md:w-auto"
              label={t.kpi.month}
              amount={s.monthTurnover}
              delta={<Delta current={monthN} previous={Number(prev?.turnover ?? 0)} />}
              hint={monthN < 0 ? t.kpi.monthNegative : t.kpi.monthHint}
              spark={spark?.map((m) => Number(m.turnover))}
            />
            <KpiCard
              className="w-[78%] shrink-0 snap-start md:w-auto"
              label={t.kpi.unpaid}
              amount={s.unpaid}
              hint={t.kpi.unpaidHint(s.unpaidCount)}
            />
            <KpiCard
              className="w-[78%] shrink-0 snap-start md:w-auto"
              label={t.kpi.overdue}
              amount={s.overdue}
              tone={s.overdueCount > 0 ? 'overdue' : undefined}
              hint={
                s.overdueCount > 0
                  ? t.kpi.overdueHint(s.overdueCount, s.oldestOverdueDays)
                  : t.kpi.none
              }
            />
            <KpiCard
              className="w-[78%] shrink-0 snap-start md:w-auto"
              label={t.kpi.received}
              amount={s.monthReceived}
              delta={
                <Delta current={Number(s.monthReceived)} previous={Number(prev?.received ?? 0)} />
              }
              hint={t.kpi.receivedHint}
              spark={spark?.map((m) => Number(m.received))}
            />
          </div>

          <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-start">
            <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-5">
              <RevenueChart months={s.months} className="order-2" />
              {hasDocs && (
                <section className="sheet order-4 pt-5 pb-2">
                  <SectionLabel
                    className="px-5"
                    action={
                      <Link
                        to="/faktury"
                        search={{ filter: 'all' }}
                        className="text-xs font-medium text-primary underline-offset-4 hover:underline"
                      >
                        {t.allInvoices}
                      </Link>
                    }
                  >
                    {t.recent}
                  </SectionLabel>
                  <ul className="mt-2 divide-y divide-border/60">
                    {recent.data?.map((d) => (
                      <li key={d.id} className="row-hover relative">
                        <Link
                          to={d.status === 'draft' ? '/faktury/$id/upravit' : '/faktury/$id'}
                          params={{ id: d.id }}
                          className="flex items-center gap-3 px-5 py-3 outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-inset"
                        >
                          <Avatar name={d.customerName ?? '?'} size="md" />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium">
                              {d.customerName ?? '—'}
                            </div>
                            <div className="truncate text-xs text-muted-foreground tabular-nums">
                              {d.number ?? cs.invoices.draftNumber}
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-4">
                            <Amount value={d.total} currency={d.currency} hideZeroFraction />
                            <InvoiceStatus status={d.displayStatus} viaAssistant={d.viaAssistant} />
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>

            <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-5">
              <AwaitingList docs={unpaid.data ?? []} total={s.unpaidCount} className="order-1" />
              {s.vatLimit && <VatLimitCard vat={s.vatLimit} className="order-3" />}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
