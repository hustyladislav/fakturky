import { BRAND } from '@fakturky/core/brand'
import { Button } from '@fakturky/ui/components/button'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@fakturky/ui/components/sidebar'
import { ThemeToggle } from '@fakturky/ui/components/theme'
import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, Outlet, redirect, useNavigate } from '@tanstack/react-router'
import { FileText, Heart, LayoutDashboard, LogOut, Settings, Users } from 'lucide-react'
import { cs } from '@/i18n/cs'
import { authClient } from '@/lib/auth-client'
import { getOnboardedFn, getSessionFn } from '@/server/session'

export const Route = createFileRoute('/_app')({
  beforeLoad: async () => {
    const session = await getSessionFn()
    if (!session) throw redirect({ to: '/prihlaseni' })
    if (!(await getOnboardedFn())) throw redirect({ to: '/onboarding' })
    return { user: session.user }
  },
  component: AppShell,
})

const nav = [
  { to: '/', label: cs.nav.overview, icon: LayoutDashboard },
  { to: '/faktury', label: cs.nav.invoices, icon: FileText },
  { to: '/kontakty', label: cs.nav.contacts, icon: Users },
  { to: '/nastaveni', label: cs.nav.settings, icon: Settings },
] as const

function AppShell() {
  const { user } = Route.useRouteContext()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <span className="px-2 py-1 text-lg font-semibold">{cs.brand}</span>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarMenu>
              {nav.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton
                    render={<Link to={item.to} activeOptions={{ exact: item.to === '/' }} />}
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                render={<a href={BRAND.supportUrl} target="_blank" rel="noreferrer" />}
              >
                <Heart />
                <span>{cs.common.support}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <div className="flex items-center justify-between gap-2 px-2 text-sm">
            <span className="truncate text-muted-foreground">{user.email}</span>
            <Button
              variant="ghost"
              size="icon"
              aria-label={cs.common.signOut}
              onClick={async () => {
                await authClient.signOut()
                queryClient.clear()
                await navigate({ to: '/prihlaseni' })
              }}
            >
              <LogOut />
            </Button>
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-12 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <div className="ml-auto">
            <ThemeToggle labels={cs.theme} />
          </div>
        </header>
        <div className="p-6">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
