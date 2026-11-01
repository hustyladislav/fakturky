import { Card, CardContent, CardHeader, CardTitle } from '@fakturky/ui/components/card'
import { createFileRoute } from '@tanstack/react-router'
import { cs } from '@/i18n/cs'

export const Route = createFileRoute('/_app/')({
  component: Overview,
})

function Overview() {
  const { user } = Route.useRouteContext()
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{cs.overview.title}</h1>
      <Card>
        <CardHeader>
          <CardTitle>
            {cs.overview.welcome}, {user.name}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground">{cs.overview.empty}</CardContent>
      </Card>
    </div>
  )
}
