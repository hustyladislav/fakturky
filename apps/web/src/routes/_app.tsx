import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { AppShell } from '@/components/shell/app-shell'
import { getOnboardedFn, getSessionFn } from '@/server/session'

export const Route = createFileRoute('/_app')({
  beforeLoad: async () => {
    const session = await getSessionFn()
    if (!session) throw redirect({ to: '/prihlaseni' })
    if (!(await getOnboardedFn())) throw redirect({ to: '/onboarding' })
    return { user: session.user }
  },
  component: Layout,
})

function Layout() {
  const { user } = Route.useRouteContext()
  return (
    <AppShell user={user}>
      <Outlet />
    </AppShell>
  )
}
