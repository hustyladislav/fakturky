import { CreateOrganization } from '@clerk/tanstack-react-start'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { getAuthStateFn } from '@/server/session'

export const Route = createFileRoute('/onboarding')({
  beforeLoad: async () => {
    const { userId, orgId } = await getAuthStateFn()
    if (!userId) throw redirect({ href: '/prihlaseni' })
    if (orgId) throw redirect({ to: '/' })
  },
  component: () => (
    <main className="flex min-h-svh items-center justify-center p-6">
      <CreateOrganization afterCreateOrganizationUrl="/" skipInvitationScreen />
    </main>
  ),
})
