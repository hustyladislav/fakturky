import { BRAND } from '@fakturky/core/brand'
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
import { Logo, LogoMark } from '@fakturky/ui/components/logo'
import { ThemeToggle } from '@fakturky/ui/components/theme'
import { cn } from '@fakturky/ui/lib/utils'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import {
  Coffee,
  Ellipsis,
  LogOut,
  MessageSquare,
  PanelRight,
  Plus,
  Search,
  Settings,
  Sparkles,
} from 'lucide-react'
import { lazy, type ReactNode, Suspense, useMemo, useState } from 'react'
import { clearAssistantStorage } from '@/components/assistant/assistant-storage'
import { InstallHint } from '@/components/pwa/install-hint'
import { cs } from '@/i18n/cs'
import { type NavItem, NEW_INVOICE_PATH, navItems, useNavItems } from './nav'
import { useRecordRecent } from './recent-pages'
import { ShellContext, type ShellState, useShell as useShellState } from './shell-context'
import { useModKey } from './use-mod-key'
import { useShortcuts } from './use-shortcuts'

const CommandPalette = lazy(() =>
  import('./command-palette').then((m) => ({ default: m.CommandPalette })),
)
const ShortcutsHelp = lazy(() =>
  import('./shortcuts-help').then((m) => ({ default: m.ShortcutsHelp })),
)
const loadAssistant = () => import('@/components/assistant/assistant-root')
const AssistantRoot = lazy(loadAssistant)

const navLink =
  'group/nav flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground data-[status=active]:bg-sidebar-accent data-[status=active]:text-sidebar-foreground max-lg:justify-center max-lg:px-0 [&_svg]:size-4 [&_svg]:shrink-0'

export function AppShell({
  user,
  children,
}: {
  user: { name: string; email: string }
  children: ReactNode
}) {
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [question, setQuestion] = useState<{ id: number; text: string } | null>(null)

  const state = useMemo<ShellState>(
    () => ({
      paletteOpen,
      setPaletteOpen,
      helpOpen,
      setHelpOpen,
      assistantOpen,
      setAssistantOpen,
      askAssistant: (q) => {
        setQuestion((prev) => ({ id: (prev?.id ?? 0) + 1, text: q }))
        setAssistantOpen(true)
      },
    }),
    [paletteOpen, helpOpen, assistantOpen],
  )

  return (
    <ShellContext.Provider value={state}>
      <ShellInner user={user} question={question}>
        {children}
      </ShellInner>
    </ShellContext.Provider>
  )
}

function ShellInner({
  user,
  question,
  children,
}: {
  user: { name: string; email: string }
  question: { id: number; text: string } | null
  children: ReactNode
}) {
  const { setPaletteOpen, paletteOpen, helpOpen, assistantOpen, setAssistantOpen } = useShellState()
  // Dialog code loads the first time it is needed (palette: on first open or intent).
  const [dialogsSeen, setDialogsSeen] = useState({ palette: false, help: false })
  if (paletteOpen && !dialogsSeen.palette) setDialogsSeen((d) => ({ ...d, palette: true }))
  if (helpOpen && !dialogsSeen.help) setDialogsSeen((d) => ({ ...d, help: true }))
  // Mounted on first open and kept, so the conversation survives closing the panel and navigation.
  const [assistantMounted, setAssistantMounted] = useState(false)
  if (assistantOpen && !assistantMounted) setAssistantMounted(true)
  useShortcuts()
  useRecordRecent()
  const modKey = useModKey()

  return (
    <div className="min-h-svh">
      <a
        href="#obsah"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2"
      >
        {cs.shell.skip}
      </a>
      <Sidebar user={user} />

      <div className={cn('md:pl-16 lg:pl-60', assistantOpen && 'lg:pr-[380px]')}>
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur md:px-8">
          <Link to="/prehled" className="md:hidden">
            <LogoMark letter={BRAND.name.charAt(0)} className="size-7" />
            <span className="sr-only">{BRAND.name}</span>
          </Link>
          <button
            type="button"
            onPointerEnter={() => void import('./command-palette')}
            onFocus={() => void import('./command-palette')}
            onClick={() => setPaletteOpen(true)}
            className="ml-auto flex h-9 items-center gap-2 rounded-lg border bg-card px-3 text-sm text-muted-foreground transition-colors hover:text-foreground md:ml-0 md:w-72 md:justify-between"
          >
            <span className="flex items-center gap-2">
              <Search className="size-4" aria-hidden />
              <span className="sr-only md:not-sr-only">{cs.shell.search}</span>
            </span>
            <span className="hidden gap-1 md:flex" aria-hidden>
              <Kbd>{modKey}</Kbd>
              <Kbd>K</Kbd>
            </span>
          </button>
          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="max-lg:hidden"
              aria-label={cs.shell.assistant}
              title={`${cs.shell.assistant} (${modKey} J)`}
              aria-pressed={assistantOpen}
              onPointerEnter={() => void loadAssistant()}
              onFocus={() => void loadAssistant()}
              onClick={() => setAssistantOpen(!assistantOpen)}
            >
              <PanelRight />
            </Button>
            <ThemeToggle labels={cs.theme} />
            <Button
              size="lg"
              className="ml-2 hidden md:inline-flex"
              nativeButton={false}
              render={<Link to={NEW_INVOICE_PATH as never} />}
            >
              <Plus data-icon="inline-start" />
              {cs.shell.newInvoice}
              <Kbd className="ml-1 border-primary-foreground/30 bg-transparent text-primary-foreground/80">
                N
              </Kbd>
            </Button>
          </div>
        </header>
        <main
          id="obsah"
          className="vt-page mx-auto w-full max-w-[1200px] px-4 py-6 pb-28 md:px-8 md:pb-10"
        >
          <InstallHint />
          {children}
        </main>
      </div>

      {assistantMounted && (
        <Suspense fallback={null}>
          <AssistantRoot
            userKey={user.email}
            pendingQuestion={question}
            open={assistantOpen}
            onClose={() => setAssistantOpen(false)}
          />
        </Suspense>
      )}
      <MobileTabs />
      <Suspense fallback={null}>
        {dialogsSeen.palette && <CommandPalette />}
        {dialogsSeen.help && <ShortcutsHelp />}
      </Suspense>
    </div>
  )
}

function Sidebar({ user }: { user: { name: string; email: string } }) {
  const items = useNavItems()
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-16 flex-col border-r bg-sidebar text-sidebar-foreground md:flex lg:w-60">
      <div className="flex h-14 items-center px-4 max-lg:justify-center max-lg:px-0">
        <Link to="/prehled">
          <Logo name={BRAND.name} className="max-lg:hidden" markClassName="size-7" />
          <LogoMark letter={BRAND.name.charAt(0)} className="size-8 lg:hidden" />
          <span className="sr-only lg:hidden">{BRAND.name}</span>
        </Link>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-2 max-lg:px-2" aria-label={cs.shell.navigation}>
        {items.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            activeOptions={{ exact: false }}
            className={navLink}
            title={item.label}
          >
            <item.icon aria-hidden />
            <span className="max-lg:sr-only">{item.label}</span>
            <Kbd className="ml-auto hidden border-transparent bg-transparent opacity-0 transition-opacity group-hover/nav:opacity-100 lg:inline-flex">
              G {item.goKey.toUpperCase()}
            </Kbd>
          </Link>
        ))}
      </nav>
      <div className="space-y-1 border-t px-3 py-3 max-lg:px-2">
        <a
          href={BRAND.supportUrl}
          target="_blank"
          rel="noreferrer"
          className={navLink}
          title={cs.shell.coffee}
        >
          <Coffee aria-hidden />
          <span className="max-lg:sr-only">{cs.shell.coffee}</span>
        </a>
        <a
          href={BRAND.issuesUrl}
          target="_blank"
          rel="noreferrer"
          className={navLink}
          title={cs.shell.feedback}
        >
          <MessageSquare aria-hidden />
          <span className="max-lg:sr-only">{cs.shell.feedback}</span>
        </a>
        <AccountMenu user={user} />
      </div>
    </aside>
  )
}

function AccountMenu({ user }: { user: { name: string; email: string } }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex h-12 w-full items-center gap-3 rounded-lg px-2 text-left outline-none transition-colors hover:bg-sidebar-accent focus-visible:ring-3 focus-visible:ring-ring/50 max-lg:justify-center">
        <span className="sr-only lg:hidden">{cs.shell.account}</span>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-medium text-accent-foreground">
          {user.name.charAt(0).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1 max-lg:hidden">
          <span className="block truncate text-sm font-medium">{user.name}</span>
          <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
        </span>
        <Ellipsis className="size-4 text-muted-foreground max-lg:hidden" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start">
        <DropdownMenuLabel>{user.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link to="/nastaveni" />}>{cs.nav.settings}</DropdownMenuItem>
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

function MobileTabs() {
  const tab =
    'flex h-full flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted-foreground data-[status=active]:text-primary [&_svg]:size-5'
  const [overview, invoices, contacts] = navItems as readonly [NavItem, NavItem, NavItem]
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-stretch border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      aria-label={cs.shell.navigation}
    >
      <Link to={overview.to} activeOptions={{ exact: true }} className={tab}>
        <overview.icon aria-hidden />
        {overview.label}
      </Link>
      <Link to={invoices.to} className={tab}>
        <invoices.icon aria-hidden />
        {invoices.label}
      </Link>
      <div className="flex flex-1 items-center justify-center">
        <Link
          to={NEW_INVOICE_PATH as never}
          aria-label={cs.shell.newInvoice}
          className="-mt-5 flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25 active:translate-y-px"
        >
          <Plus className="size-6" aria-hidden />
        </Link>
      </div>
      <Link to={contacts.to} className={tab}>
        <contacts.icon aria-hidden />
        {contacts.label}
      </Link>
      <MoreMenu tabClass={tab} />
    </nav>
  )
}

function MoreMenu({ tabClass }: { tabClass: string }) {
  const { setAssistantOpen } = useShellState()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const secondary = useNavItems().filter((n) => ['/banka', '/dph', '/sablony'].includes(n.to))
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={cn(tabClass, 'outline-none')} aria-label={cs.shell.more}>
        <Ellipsis aria-hidden />
        {cs.shell.more}
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="end" className="mb-2">
        <DropdownMenuItem onClick={() => setAssistantOpen(true)}>
          <Sparkles aria-hidden />
          {cs.shell.assistant}
        </DropdownMenuItem>
        {secondary.map((n) => (
          <DropdownMenuItem key={n.to} render={<Link to={n.to} />}>
            <n.icon aria-hidden />
            {n.label}
          </DropdownMenuItem>
        ))}
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
