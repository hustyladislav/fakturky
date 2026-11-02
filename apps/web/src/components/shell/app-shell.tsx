import { BRAND } from '@fakturky/core/brand'
import { Button } from '@fakturky/ui/components/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@fakturky/ui/components/dropdown-menu'
import { Kbd } from '@fakturky/ui/components/kbd'
import { LogoMark } from '@fakturky/ui/components/logo'
import { cn } from '@fakturky/ui/lib/utils'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
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
import { lazy, type ReactNode, Suspense, useEffect, useMemo, useState } from 'react'
import { clearAssistantStorage } from '@/components/assistant/assistant-storage'
import { InstallHint } from '@/components/pwa/install-hint'
import { cs } from '@/i18n/cs'
import { type NavItem, NEW_INVOICE_PATH, navItems, useNavItems } from './nav'
import { useRecordRecent } from './recent-pages'
import { ShellContext, type ShellState, useShell as useShellState } from './shell-context'
import { Breadcrumbs, NewInvoiceButton, Sidebar } from './sidebar'
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

const COLLAPSE_KEY = 'sidebar-collapsed'

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

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  useEffect(() => {
    try {
      setSidebarCollapsed(localStorage.getItem(COLLAPSE_KEY) === '1')
    } catch {
      // storage unavailable: stay expanded
    }
  }, [])

  const state = useMemo<ShellState>(
    () => ({
      sidebarCollapsed,
      toggleSidebar: () =>
        setSidebarCollapsed((c) => {
          try {
            localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1')
          } catch {
            // ignore
          }
          return !c
        }),
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
    [paletteOpen, helpOpen, assistantOpen, sidebarCollapsed],
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
  const {
    setPaletteOpen,
    paletteOpen,
    helpOpen,
    assistantOpen,
    setAssistantOpen,
    sidebarCollapsed,
  } = useShellState()
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
    <div className="group/shell min-h-svh" data-collapsed={sidebarCollapsed}>
      <a
        href="#obsah"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2"
      >
        {cs.shell.skip}
      </a>
      <Sidebar user={user} />

      <div
        className={cn(
          'transition-[padding] duration-200 md:pl-16 lg:pl-[15.5rem] lg:group-data-[collapsed=true]/shell:pl-16',
          assistantOpen && 'lg:pr-[380px]',
        )}
      >
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 bg-background/80 px-4 backdrop-blur md:px-8">
          <Link to="/prehled" className="md:hidden">
            <LogoMark letter={BRAND.name.charAt(0)} className="size-7" />
            <span className="sr-only">{BRAND.name}</span>
          </Link>
          <Breadcrumbs />
          <button
            type="button"
            onPointerEnter={() => void import('./command-palette')}
            onFocus={() => void import('./command-palette')}
            onClick={() => setPaletteOpen(true)}
            className="sheet !rounded-lg ml-auto flex h-9 items-center gap-2 px-3 text-sm text-muted-foreground transition-colors hover:text-foreground md:w-80 md:justify-between xl:w-[26rem]"
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
          <div className="flex items-center gap-1">
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
            <NewInvoiceButton />
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

function MobileTabs() {
  const tab =
    'flex h-full flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted-foreground data-[status=active]:text-primary [&_svg]:size-5'
  const [overview, invoices, contacts] = navItems as readonly [NavItem, NavItem, NavItem]
  // The editor has its own sticky action bar; a second "+" there only crowds it.
  const inEditor = useRouterState({
    select: (s) => /^\/faktury\/(nova|[^/]+\/upravit)$/.test(s.location.pathname),
  })
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
        {!inEditor && (
          <Link
            to={NEW_INVOICE_PATH as never}
            aria-label={cs.shell.newInvoice}
            className="-mt-5 flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25 active:translate-y-px"
          >
            <Plus className="size-6" aria-hidden />
          </Link>
        )}
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
