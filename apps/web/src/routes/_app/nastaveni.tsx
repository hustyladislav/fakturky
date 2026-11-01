import { createFileRoute } from '@tanstack/react-router'
import { BankAccountsCard } from '@/components/bank-accounts-card'
import { cs } from '@/i18n/cs'

export const Route = createFileRoute('/_app/nastaveni')({
  component: () => (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">{cs.settings.title}</h1>
      <BankAccountsCard />
    </div>
  ),
})
