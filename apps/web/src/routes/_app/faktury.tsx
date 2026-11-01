import { createFileRoute } from '@tanstack/react-router'
import { cs } from '@/i18n/cs'

export const Route = createFileRoute('/_app/faktury')({
  component: () => (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">{cs.invoices.title}</h1>
      <p className="text-muted-foreground">{cs.invoices.soon}</p>
    </div>
  ),
})
