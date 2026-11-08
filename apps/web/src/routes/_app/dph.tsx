import { formatDateCs } from '@fakturky/domain/dates'
import { Button } from '@fakturky/ui/components/button'
import { EmptyState } from '@fakturky/ui/components/empty-state'
import { PageHeader } from '@fakturky/ui/components/page-header'
import { Skeleton } from '@fakturky/ui/components/skeleton'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Receipt } from 'lucide-react'
import { ErrorState } from '@/components/error-state'
import { VatExports } from '@/components/vat/exports'
import { FilingDetails } from '@/components/vat/filing-details'
import { PeriodPicker } from '@/components/vat/period-picker'
import { ReportBody } from '@/components/vat/report-body'
import { FilingGuide } from '@/components/vat/summary-and-guide'
import { useVatReport, type VatProfile } from '@/components/vat/use-vat-report'
import { cs } from '@/i18n/cs'
import { pageHead } from '@/lib/head'
import { orpc } from '@/lib/orpc'

export const Route = createFileRoute('/_app/dph')({
  head: pageHead(cs.nav.vat),
  component: VatPage,
})

const t = cs.vat
const WIDTH = 'mx-auto max-w-[56rem]'

function VatPage() {
  const profile = useQuery(orpc.businessProfile.get.queryOptions())

  if (profile.isPending) {
    return (
      <div className={`${WIDTH} space-y-4`} aria-busy="true">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }
  if (profile.isError) {
    return (
      <div className={`${WIDTH} space-y-6`}>
        <PageHeader title={t.title} />
        <ErrorState onRetry={() => profile.refetch()} />
      </div>
    )
  }
  if (profile.data?.vatStatus !== 'payer') {
    return (
      <div className={`${WIDTH} space-y-6`}>
        <PageHeader title={t.title} />
        <EmptyState icon={Receipt} title={t.notPayerTitle}>
          {t.notPayerText}
        </EmptyState>
        <div className="flex justify-center">
          <Button nativeButton={false} variant="outline" render={<Link to="/nastaveni" />}>
            {t.notPayerCta}
          </Button>
        </div>
      </div>
    )
  }
  return <PayerPage profile={profile.data} />
}

function PayerPage({ profile }: { profile: VatProfile }) {
  const { query, input, period, options, manual } = useVatReport(profile)
  const report = query.data

  return (
    <div className={`${WIDTH} space-y-10`}>
      <div className="space-y-4">
        <PageHeader
          className="mb-0"
          title={t.title}
          subtitle={report ? t.subtitle(period.label, formatDateCs(report.deadline)) : undefined}
        />
        <p className="text-sm text-muted-foreground text-pretty">
          <span className="font-medium text-foreground">{t.disclaimer}</span> {t.disclaimerText}
        </p>
      </div>
      <PeriodPicker period={period} options={options} deadline={report?.deadline} />
      <VatExports input={input} report={report} />
      <FilingDetails profile={profile} />

      {query.isError && <ErrorState onRetry={() => query.refetch()} />}
      {query.isPending && <Skeleton className="h-64 rounded-xl" aria-busy="true" />}
      {report && (
        <ReportBody
          key={`${period.kind}-${period.year}-${period.idx}`}
          report={report}
          manual={manual}
        />
      )}
      <FilingGuide />
    </div>
  )
}
