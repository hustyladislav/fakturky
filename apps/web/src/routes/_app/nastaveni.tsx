import { Button } from '@fakturky/ui/components/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@fakturky/ui/components/card'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ApiKeys } from '@/components/api-keys'
import { BankAccountsCard } from '@/components/bank-accounts-card'
import { BusinessProfileForm } from '@/components/business-profile-form'
import { NumberSeriesCard } from '@/components/number-series-card'
import { DataExport, ReminderSettings } from '@/components/reminder-settings'
import { cs } from '@/i18n/cs'
import { pageHead } from '@/lib/head'
import { orpc } from '@/lib/orpc'

export const Route = createFileRoute('/_app/nastaveni')({
  head: pageHead(cs.settings.title),
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(orpc.businessProfile.get.queryOptions()),
  component: Settings,
})

function Settings() {
  const { data: profile } = useQuery(orpc.businessProfile.get.queryOptions())
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">{cs.settings.title}</h1>
      <section className="space-y-4 rounded-xl border bg-card p-5">
        <h2 className="text-lg font-medium">{cs.settings.profileTitle}</h2>
        {profile && <BusinessProfileForm profile={profile} submitLabel={cs.common.save} />}
      </section>
      <BankAccountsCard />
      <NumberSeriesCard />
      <ReminderSettings />
      <DataExport />
      <Card>
        <CardHeader>
          <CardTitle>{cs.import.settingsCardTitle}</CardTitle>
          <CardDescription>{cs.import.settingsCardDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button render={<Link to="/import" />}>{cs.import.open}</Button>
        </CardContent>
      </Card>
      <div className="rounded-xl border bg-card p-5">
        <ApiKeys />
      </div>
    </div>
  )
}
