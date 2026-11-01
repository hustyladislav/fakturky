import { OrganizationSwitcher, UserButton } from '@clerk/tanstack-react-start'
import { BRAND } from '@fakturky/core/brand'
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
import { createFileRoute, Link, Outlet, redirect } from '@tanstack/react-router'
import { FileText, Heart, LayoutDashboard, Settings, Users } from 'lucide-react'
import { cs } from '@/i18n/cs'
import { getAuthStateFn } from '@/server/session'

export const Route = createFileRoute('/_app')({
  beforeLoad: async () => {
    const { userId, orgId } = await getAuthStateFn()
    if (!userId) throw redirect({ href: '/prihlaseni' })
    if (!orgId) throw redirect({ to: '/onboarding' })
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
          <div className="flex items-center justify-between gap-2 px-2">
            <OrganizationSwitcher hidePersonal afterSelectOrganizationUrl="/" />
            <UserButton />
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-12 items-center gap-2 border-b px-4">
          <SidebarTrigger />
        </header>
        <div className="p-6">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
