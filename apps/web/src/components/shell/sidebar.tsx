import { BRAND } from '@fakturky/core/brand'
import { Avatar } from '@fakturky/ui/components/avatar'
import { Button } from '@fakturky/ui/components/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@fakturky/ui/components/dropdown-menu'
import { Kbd } from '@fakturky/ui/components/kbd'
import { LogoMark } from '@fakturky/ui/components/logo'
import {
  readThemePreference,
  setThemePreference,
  type ThemePreference,
} from '@fakturky/ui/components/theme'
import { cn } from '@fakturky/ui/lib/utils'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useLocation, useNavigate, useParams } from '@tanstack/react-router'
import {
  Check,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  Coffee,
  Ellipsis,
  FileStack,
  FileText,
  LogOut,
  MessageSquare,
  Monitor,
  Moon,
  PanelLeft,
  Plus,
  Settings,
  Sun,
} from 'lucide-react'
import { Fragment, useState } from 'react'
import { toast } from 'sonner'
import { clearAssistantStorage } from '@/components/assistant/assistant-storage'
import { cs } from '@/i18n/cs'
import { refreshDocumentData } from '@/lib/document-cache'
import { orpc } from '@/lib/orpc'
import { NEW_INVOICE_PATH, navItems, useNavItems } from './nav'
import { useShell } from './shell-context'
import { useModKey } from './use-mod-key'

export const navLink =
  'group/nav relative flex h-9 items-center gap-3 rounded-md px-3 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-muted hover:text-sidebar-foreground data-[status=active]:bg-muted data-[status=active]:text-sidebar-foreground max-lg:justify-center max-lg:px-0 lg:group-data-[collapsed=true]/shell:justify-center lg:group-data-[collapsed=true]/shell:px-0 [&_svg]:size-4 [&_svg]:shrink-0'

/** Hide a label when the sidebar shows icons only (always below lg, or collapsed with ⌘\). */
export const labelCls = 'max-lg:sr-only lg:group-data-[collapsed=true]/shell:sr-only'

/** Overdue document count for the Faktury badge (shares the dashboard query cache). */
function useOverdueCount() {
  const summary = useQuery(orpc.dashboard.summary.queryOptions({ input: {} }))
  return summary.data?.overdueCount ?? 0
}

export function Sidebar({ user }: { user: { name: string; email: string } }) {
  const items = useNavItems()
  const overdue = useOverdueCount()
  const { toggleSidebar, sidebarCollapsed } = useShell()
  const modKey = useModKey()
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-16 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex lg:w-[15.5rem] lg:group-data-[collapsed=true]/shell:w-16">
      <div className="flex h-14 items-center px-3 max-lg:justify-center max-lg:px-2 lg:group-data-[collapsed=true]/shell:justify-center lg:group-data-[collapsed=true]/shell:px-2">
        <OrgSwitcher />
      </div>
      <nav className="flex-1 space-y-0.5 px-3 py-3 max-lg:px-2" aria-label={cs.shell.navigation}>
        {items.map((item) => {
          const count = item.to === '/faktury' ? overdue : 0
          return (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: false }}
              className={navLink}
              title={item.label}
            >
              <item.icon aria-hidden />
              <span className={labelCls}>{item.label}</span>
              {count > 0 && (
                <>
                  <span
                    className="ml-auto text-xs font-medium text-destructive tabular-nums group-hover/nav:hidden max-lg:hidden lg:group-data-[collapsed=true]/shell:hidden"
                    title={`${count} ${cs.shell.overdueCount}`}
                  >
                    {count}
                  </span>
                  <span
                    aria-hidden
                    className="absolute top-2 right-2 hidden size-2 rounded-full bg-destructive max-lg:block lg:group-data-[collapsed=true]/shell:block"
                  />
                  <span className="sr-only">{`${count} ${cs.shell.overdueCount}`}</span>
                </>
              )}
              <Kbd
                className={cn(
                  'ml-auto hidden border-transparent bg-transparent opacity-0 transition-opacity group-hover/nav:opacity-100 lg:inline-flex lg:group-data-[collapsed=true]/shell:hidden',
                  count > 0 && 'group-hover/nav:ml-auto',
                  count === 0 && 'ml-auto',
                )}
              >
                G {item.goKey.toUpperCase()}
              </Kbd>
            </Link>
          )
        })}
      </nav>
      <div className="space-y-0.5 border-t border-sidebar-border px-3 py-3 max-lg:px-2">
        <button
          type="button"
          onClick={toggleSidebar}
          title={`${sidebarCollapsed ? cs.shell.expand : cs.shell.collapse} (${modKey} \\)`}
          className={cn(navLink, 'w-full max-lg:hidden')}
        >
          <PanelLeft aria-hidden />
          <span className={labelCls}>{sidebarCollapsed ? cs.shell.expand : cs.shell.collapse}</span>
          <Kbd className="ml-auto hidden border-transparent bg-transparent lg:inline-flex lg:group-data-[collapsed=true]/shell:hidden">
            {modKey} \
          </Kbd>
        </button>
        <AccountMenu user={user} />
      </div>
    </aside>
  )
}

/** Top of the sidebar: the active business (name + IČO) with a switcher dropdown. */
function OrgSwitcher() {
  const profile = useQuery(orpc.businessProfile.get.queryOptions())
  const name = profile.data?.legalName ?? BRAND.name
  const ico = profile.data?.ico
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex h-9 w-full min-w-0 items-center gap-2 rounded-md px-2 text-left outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 max-lg:justify-center max-lg:px-0 lg:group-data-[collapsed=true]/shell:justify-center lg:group-data-[collapsed=true]/shell:px-0">
        <LogoMark letter={BRAND.name.charAt(0)} className="size-6" />
        <span className={cn('min-w-0 flex-1 truncate text-sm font-medium', labelCls)}>{name}</span>
        <ChevronsUpDown className={cn('size-4 text-muted-foreground', labelCls)} aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="start" className="w-64">
        <DropdownMenuLabel className="label-caps !px-2 !py-1.5">
          {cs.shell.business}
        </DropdownMenuLabel>
        <DropdownMenuItem render={<Link to="/nastaveni" />} className="h-12">
          <Avatar name={name} size="sm" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-foreground">{name}</span>
            {ico && <span className="block text-xs text-muted-foreground">IČO {ico}</span>}
          </span>
          <Check className="!text-primary" aria-hidden />
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link to="/nastaveni" />}>
          <Settings aria-hidden />
          {cs.nav.settings}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const themeOptions: { pref: ThemePreference; icon: typeof Sun }[] = [
  { pref: 'system', icon: Monitor },
  { pref: 'light', icon: Sun },
  { pref: 'dark', icon: Moon },
]

function ThemePicker() {
  const [pref, setPref] = useState<ThemePreference>(() =>
    typeof window === 'undefined' ? 'system' : readThemePreference(),
  )
  return (
    <div className="px-2 py-1.5">
      <div className="label-caps mb-1.5">{cs.shell.theme}</div>
      <div role="radiogroup" aria-label={cs.shell.theme} className="flex rounded-lg bg-muted p-0.5">
        {themeOptions.map(({ pref: p, icon: Icon }) => (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={pref === p}
            aria-label={cs.theme[p]}
            title={cs.theme[p]}
            onClick={() => {
              setThemePreference(p)
              setPref(p)
            }}
            className={cn(
              'flex h-7 flex-1 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 [&_svg]:size-4',
              pref === p && 'bg-background text-foreground shadow-xs',
            )}
          >
            <Icon aria-hidden />
          </button>
        ))}
      </div>
    </div>
  )
}

export function AccountMenu({ user }: { user: { name: string; email: string } }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex h-11 w-full items-center gap-3 rounded-md px-2 text-left outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 max-lg:justify-center lg:group-data-[collapsed=true]/shell:justify-center">
        <span className="sr-only lg:hidden">{cs.shell.account}</span>
        <Avatar name={user.name} size="sm" />
        <span className={cn('min-w-0 flex-1', labelCls)}>
          <span className="block truncate text-sm font-medium">{user.name}</span>
          <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
        </span>
        <Ellipsis className={cn('size-4 text-muted-foreground', labelCls)} aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-64">
        <DropdownMenuLabel>{user.email}</DropdownMenuLabel>
        <ThemePicker />
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link to="/nastaveni" />}>
          <Settings aria-hidden />
          {cs.nav.settings}
        </DropdownMenuItem>
        <DropdownMenuItem render={<a href={BRAND.supportUrl} target="_blank" rel="noreferrer" />}>
          <Coffee aria-hidden />
          {cs.shell.coffee}
        </DropdownMenuItem>
        <DropdownMenuItem render={<a href={BRAND.issuesUrl} target="_blank" rel="noreferrer" />}>
          <MessageSquare aria-hidden />
          {cs.shell.feedback}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={async () => {
            clearAssistantStorage()
            await (await import('@/lib/auth-client')).authClient.signOut()
            queryClient.clear()
            await navigate({ to: '/prihlaseni' })
          }}
        >
          <LogOut aria-hidden />
          {cs.common.signOut}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Top bar breadcrumbs: Faktury / 2026-0028 (the detail crumb reads the cached document). */
export function Breadcrumbs() {
  const { pathname } = useLocation()
  const params = useParams({ strict: false }) as { id?: string }
  const segments = pathname.split('/').filter(Boolean)
  const section = navItems.find((n) => n.to === `/${segments[0]}`)
  const id =
    segments[0] === 'faktury' && segments[1] && segments[1] !== 'nova' ? params.id : undefined
  const doc = useQuery({
    ...orpc.documents.get.queryOptions({ input: { id: id ?? '' } }),
    enabled: !!id,
  })
  if (!section) return null
  const crumbs: { label: string; to?: string }[] = [{ label: section.label, to: section.to }]
  if (segments[0] === 'faktury' && segments[1] === 'nova') {
    crumbs.push({ label: cs.shell.crumbNew })
  } else if (id) {
    crumbs.push({ label: doc.data?.number ?? cs.invoices.status.draft })
    if (segments[2] === 'upravit') crumbs.push({ label: cs.shell.crumbEdit })
  }
  return (
    <nav
      aria-label="Drobečková navigace"
      className="hidden min-w-0 items-center gap-1.5 text-sm md:flex"
    >
      {crumbs.map((c, i) => (
        <Fragment key={c.label}>
          {i > 0 && (
            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/60" aria-hidden />
          )}
          {c.to && i < crumbs.length - 1 ? (
            <Link
              to={c.to as never}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              {c.label}
            </Link>
          ) : (
            <span
              aria-current={i === crumbs.length - 1 ? 'page' : undefined}
              className="truncate font-medium text-foreground tabular-nums"
            >
              {c.label}
            </span>
          )}
        </Fragment>
      ))}
    </nav>
  )
}

/** Primary action: "Nová faktura" with a split menu (Prázdná / Ze šablony). */
export function NewInvoiceButton() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const templates = useQuery(orpc.templates.list.queryOptions({ input: {} }))
  const use = useMutation(
    orpc.templates.use.mutationOptions({
      onSuccess: async (d) => {
        toast.success(cs.templates.used)
        await refreshDocumentData(queryClient)
        await navigate({ to: '/faktury/$id/upravit', params: { id: d.id } })
      },
      onError: (e) => toast.error((e as Error).message || cs.common.error),
    }),
  )
  return (
    <div className="ml-2 hidden items-stretch md:flex">
      <Button
        variant="brand"
        className="rounded-r-none"
        nativeButton={false}
        render={<Link to={NEW_INVOICE_PATH as never} />}
      >
        <Plus data-icon="inline-start" />
        {cs.shell.newInvoice}
        <Kbd className="ml-1 border-brand-foreground/25 bg-transparent text-brand-foreground/70">
          N
        </Kbd>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={cs.shell.newInvoiceMenu}
          className="flex h-9 w-8 items-center justify-center rounded-r-lg border-l pointer-coarse:h-11 border-brand-foreground/15 bg-brand text-brand-foreground outline-none transition-colors hover:bg-brand/80 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <ChevronDown className="size-4" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent side="bottom" align="end" className="w-56">
          <DropdownMenuItem render={<Link to={NEW_INVOICE_PATH as never} />}>
            <FileText aria-hidden />
            {cs.shell.blankInvoice}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="label-caps !px-2 !py-1.5">
            {cs.shell.fromTemplate}
          </DropdownMenuLabel>
          {(templates.data ?? []).slice(0, 8).map((tpl) => (
            <DropdownMenuItem
              key={tpl.id}
              disabled={use.isPending}
              onClick={() => use.mutate({ id: tpl.id })}
            >
              <FileStack aria-hidden />
              <span className="truncate">{tpl.name}</span>
            </DropdownMenuItem>
          ))}
          {templates.data?.length === 0 && (
            <DropdownMenuItem render={<Link to="/sablony" />}>
              <Plus aria-hidden />
              {cs.shell.noTemplates}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
