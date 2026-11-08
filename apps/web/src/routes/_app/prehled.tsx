import { Button } from '@fakturky/ui/components/button'
import { EmptyState } from '@fakturky/ui/components/empty-state'
import { PageHeader } from '@fakturky/ui/components/page-header'
import { Skeleton } from '@fakturky/ui/components/skeleton'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { AwaitingList } from '@/components/dashboard/awaiting-list'
import { MonthFigures, OutstandingFigures } from '@/components/dashboard/figure-strip'
import { RecentDocuments } from '@/components/dashboard/recent-documents'
import { RevenueChart } from '@/components/dashboard/revenue-chart'
import { VatLimitCard } from '@/components/dashboard/vat-limit'
import { cs } from '@/i18n/cs'
import { pageHead } from '@/lib/head'
import { orpc } from '@/lib/orpc'

export const Route = createFileRoute('/_app/prehled')({
  head: pageHead(cs.nav.overview),
  component: Overview,
})

const t = cs.overview

function FirstInvoice({ noBankAccount }: { noBankAccount: boolean }) {
  return (
    <EmptyState
      illustration="invoices"
      title={t.emptyTitle}
      className="mb-8"
      action={
        noBankAccount ? (
          <div className="flex flex-wrap justify-center gap-2">
            <Button nativeButton={false} render={<Link to="/nastaveni" hash="banka" />}>
              {t.addBankAccount}
            </Button>
            <Button variant="outline" nativeButton={false} render={<Link to="/faktury/nova" />}>
              {cs.invoices.emptyCta}
            </Button>
          </div>
        ) : (
          <Button nativeButton={false} render={<Link to="/faktury/nova" />}>
            {cs.invoices.emptyCta}
          </Button>
        )
      }
    >
      {t.emptyText}
    </EmptyState>
  )
}

function Loading() {
  return (
    <div className="space-y-10" aria-busy="true">
      <div className="grid gap-6 @md:grid-cols-2">
        <Skeleton className="h-24 rounded-md" />
        <Skeleton className="h-24 rounded-md" />
      </div>
      <Skeleton className="h-64 rounded-md" />
    </div>
  )
}

/**
 * Přehled answers "who owes me?" first: outstanding and overdue figures, then the people who owe
 * it with a one-tap reminder. Turnover, chart and recent documents follow for the quieter reading.
 */
function Overview() {
  const summary = useQuery(orpc.dashboard.summary.queryOptions({ input: {} }))
  const recent = useQuery(orpc.documents.list.queryOptions({ input: { limit: 5 } }))
  const unpaid = useQuery(
    orpc.documents.list.queryOptions({ input: { filter: 'unpaid', limit: 200 } }),
  )
  const bankAccounts = useQuery(orpc.bankAccounts.list.queryOptions({ input: {} }))
  const s = summary.data
  const noBankAccount = bankAccounts.isSuccess && bankAccounts.data.length === 0
  const hasDocs = (recent.data?.length ?? 0) > 0

  return (
    <div className="@container mx-auto max-w-[1200px]">
      <PageHeader title={t.greeting} className="mb-8" />

      {recent.isSuccess && !hasDocs && <FirstInvoice noBankAccount={noBankAccount} />}

      {summary.isError && <p className="text-sm text-muted-foreground">{cs.common.error}</p>}
      {summary.isPending && <Loading />}

      {s && (
        // Phone: owed, who owes, then the month. Wide: one figure strip, then who owes.
        <div className="grid gap-y-10 @4xl:grid-cols-4 @4xl:gap-y-0">
          <OutstandingFigures s={s} className="order-1 @4xl:col-span-2 @4xl:border-b @4xl:pb-8" />
          <MonthFigures
            s={s}
            className="order-3 @4xl:order-2 @4xl:col-span-2 @4xl:border-b @4xl:border-l @4xl:pb-8 @4xl:pl-8"
          />
          <AwaitingList
            docs={unpaid.data ?? []}
            status={unpaid.status}
            onRetry={unpaid.refetch}
            total={s.unpaidCount}
            className="order-2 @4xl:order-3 @4xl:col-span-4 @4xl:mt-8"
          />

          <div className="order-4 grid gap-x-12 gap-y-10 @4xl:col-span-4 @4xl:mt-12 @4xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] @4xl:items-start">
            <div className="space-y-10">
              <RevenueChart months={s.months} />
              {s.vatLimit && <VatLimitCard vat={s.vatLimit} />}
            </div>
            {hasDocs && <RecentDocuments docs={recent.data ?? []} />}
          </div>
        </div>
      )}
    </div>
  )
}
