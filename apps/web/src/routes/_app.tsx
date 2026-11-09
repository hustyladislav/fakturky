import { createFileRoute, Outlet } from '@tanstack/react-router'
import { AppShell } from '@/components/shell/app-shell'
import { requireAppAccess } from '@/lib/app-access'

export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ context }) => ({ user: await requireAppAccess(context.queryClient) }),
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
