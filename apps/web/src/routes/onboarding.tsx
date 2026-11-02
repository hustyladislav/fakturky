import { Button } from '@fakturky/ui/components/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@fakturky/ui/components/card'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { BusinessProfileForm } from '@/components/business-profile-form'
import { cs } from '@/i18n/cs'
import { pageHead } from '@/lib/head'
import { client, orpc } from '@/lib/orpc'
import { getSessionFn } from '@/server/session'

export const Route = createFileRoute('/onboarding')({
  head: pageHead(cs.onboarding.pageTitle),
  beforeLoad: async () => {
    if (!(await getSessionFn())) throw redirect({ to: '/prihlaseni' })
  },
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(orpc.businessProfile.get.queryOptions()),
  component: Onboarding,
})

function Onboarding() {
  const navigate = useNavigate()
  const { data: profile } = useQuery(orpc.businessProfile.get.queryOptions())
  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>{cs.onboarding.title}</CardTitle>
          <CardDescription>{cs.onboarding.description}</CardDescription>
        </CardHeader>
        <CardContent>
          {profile && (
            <BusinessProfileForm
              profile={profile}
              submitLabel={cs.onboarding.submit}
              onSaved={() => navigate({ to: '/prehled' })}
            />
          )}
          {profile && (
            <Button
              type="button"
              variant="ghost"
              className="mt-2 w-full"
              onClick={async () => {
                // Finishing onboarding stamps onboardedAt; keep whatever is already stored.
                await client.businessProfile.update({ legalName: profile.legalName })
                await navigate({ to: '/prehled' })
              }}
            >
              {cs.onboarding.skip}
            </Button>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
