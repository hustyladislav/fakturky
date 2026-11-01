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
  X,
} from 'lucide-react'
import { type ReactNode, useMemo, useState } from 'react'
import { cs } from '@/i18n/cs'
import { authClient } from '@/lib/auth-client'
import { CommandPalette, useRecordRecent } from './command-palette'
import { NEW_INVOICE_PATH, navItems } from './nav'
import { ShellContext, type ShellState, useShell as useShellState } from './shell-context'
import { ShortcutsHelp, useModKey } from './shortcuts-help'
import { useShortcuts } from './use-shortcuts'

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
  const [question, setQuestion] = useState<string | null>(null)

  const state = useMemo<ShellState>(
    () => ({
      paletteOpen,
      setPaletteOpen,
      helpOpen,
      setHelpOpen,
      assistantOpen,
      setAssistantOpen,
      askAssistant: (q) => {
        setQuestion(q)
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
  question: string | null
  children: ReactNode
}) {
  const { setPaletteOpen, assistantOpen, setAssistantOpen } = useShellState()
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
          <Link to="/" className="md:hidden" aria-label={BRAND.name}>
            <LogoMark letter={BRAND.name.charAt(0)} className="size-7" />
          </Link>
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="ml-auto flex h-9 items-center gap-2 rounded-lg border bg-card px-3 text-sm text-muted-foreground transition-colors hover:text-foreground md:ml-0 md:w-72 md:justify-between"
            aria-label={cs.shell.search}
          >
            <span className="flex items-center gap-2">
              <Search className="size-4" aria-hidden />
              <span className="hidden md:inline">{cs.shell.search}</span>
            </span>
            <span className="hidden gap-1 md:flex">
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
              onClick={() => setAssistantOpen(!assistantOpen)}
            >
              <PanelRight />
            </Button>
            <ThemeToggle labels={cs.theme} />
            <Button
              size="lg"
              className="ml-2 hidden md:inline-flex"
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
        <main id="obsah" className="mx-auto w-full max-w-[1200px] px-4 py-6 pb-28 md:px-8 md:pb-10">
          {children}
        </main>
      </div>

      <AssistantPanel question={question} />
      <MobileTabs />
      <CommandPalette />
      <ShortcutsHelp />
    </div>
  )
}

function Sidebar({ user }: { user: { name: string; email: string } }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-16 flex-col border-r bg-sidebar text-sidebar-foreground md:flex lg:w-60">
      <div className="flex h-14 items-center px-4 max-lg:justify-center max-lg:px-0">
        <Link to="/" aria-label={BRAND.name}>
          <Logo name={BRAND.name} className="max-lg:hidden" markClassName="size-7" />
          <LogoMark letter={BRAND.name.charAt(0)} className="size-8 lg:hidden" />
        </Link>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-2 max-lg:px-2" aria-label={cs.shell.navigation}>
        {navItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            activeOptions={{ exact: item.to === '/' }}
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
      <DropdownMenuTrigger
        className="flex h-12 w-full items-center gap-3 rounded-lg px-2 text-left outline-none transition-colors hover:bg-sidebar-accent focus-visible:ring-3 focus-visible:ring-ring/50 max-lg:justify-center"
        aria-label={cs.shell.account}
      >
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
            await authClient.signOut()
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
  const [overview, invoices, contacts] = navItems
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

function AssistantPanel({ question }: { question: string | null }) {
  const { assistantOpen, setAssistantOpen } = useShellState()
  if (!assistantOpen) return null
  return (
    <aside
      className="fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l bg-muted sm:w-[380px]"
      aria-label={cs.shell.assistant}
    >
      <div className="flex h-14 items-center justify-between border-b px-4">
        <span className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="size-4 text-primary" aria-hidden />
          {cs.shell.assistant}
        </span>
        <Button
          variant="ghost"
          size="icon"
          aria-label={cs.common.close}
          onClick={() => setAssistantOpen(false)}
        >
          <X />
        </Button>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <Sparkles className="size-8 text-muted-foreground" aria-hidden />
        <p className="font-serif text-lg font-medium">{cs.shell.assistantSoonTitle}</p>
        <p className="text-sm text-muted-foreground">{cs.shell.assistantSoonBody}</p>
        {question && (
          <p className="mt-2 rounded-lg border bg-card px-3 py-2 text-sm text-muted-foreground">
            „{question}“
          </p>
        )}
      </div>
    </aside>
  )
}

function MoreMenu({ tabClass }: { tabClass: string }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={cn(tabClass, 'outline-none')} aria-label={cs.shell.more}>
        <Ellipsis aria-hidden />
        {cs.shell.more}
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="end" className="mb-2">
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
            await authClient.signOut()
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
