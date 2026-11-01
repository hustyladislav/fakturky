import { createFileRoute } from '@tanstack/react-router'
import { cs } from '@/i18n/cs'

export const Route = createFileRoute('/_app/nastaveni')({
  component: () => (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">{cs.settings.title}</h1>
      <p className="text-muted-foreground">{cs.settings.soon}</p>
    </div>
  ),
})
