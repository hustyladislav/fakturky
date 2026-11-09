import type { RouterOutputs } from '@fakturky/core/router'
import { Amount } from '@fakturky/ui/components/amount'
import { Avatar } from '@fakturky/ui/components/avatar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@fakturky/ui/components/dialog'
import { Kbd } from '@fakturky/ui/components/kbd'
import { cn } from '@fakturky/ui/lib/utils'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import {
  AlarmClock,
  CircleCheck,
  FilePen,
  FilePlus2,
  FileText,
  Keyboard,
  type LucideIcon,
  Search,
  Sparkles,
  UserPlus,
  Wallet,
} from 'lucide-react'
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { useNewInvoiceFor } from '@/components/contacts/contact-menu'
import { InvoiceStatus } from '@/components/invoice-status'
import {
  fuzzyScore,
  PALETTE_POOL,
  parseIntent,
  searchTerm,
} from '@/components/shell/palette-search'
import { cs } from '@/i18n/cs'
import { orpc } from '@/lib/orpc'
import { NEW_INVOICE_PATH, useNavItems } from './nav'
import { readRecent } from './recent-pages'
import { useShell } from './shell-context'

type Found = RouterOutputs['search']['global']
type FoundDoc = Found['documents'][number]
type FoundContact = Found['contacts'][number]

type Group = 'intent' | 'documents' | 'contacts' | 'actions' | 'goto' | 'recent' | 'assistant'

interface Command {
  id: string
  group: Group
  label: string
  icon?: LucideIcon
  hint?: string
  /** Rich row content (document and contact rows); the label stays for screen readers. */
  content?: ReactNode
  run: () => void
}

const SHOWN = { documents: 4, contacts: 3 } as const
const PAYABLE = ['issued', 'overdue', 'partially_paid']

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const h = setTimeout(() => setV(value), ms)
    return () => clearTimeout(h)
  }, [value, ms])
  return v
}

function localSearch(pool: Found, term: string): Found {
  const digits = term.replace(/[\s ]/g, '')
  const amount = /^\d+([.,]\d+)?$/.test(digits) ? digits.replace(',', '.') : null
  const documents = pool.documents
    .map((d) => ({
      d,
      s: Math.max(
        fuzzyScore(d.number ?? '', term),
        fuzzyScore(d.customerName ?? '', term),
        fuzzyScore(d.variableSymbol ?? '', term),
        amount && d.total.includes(amount) ? 50 : -1,
      ),
    }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.d)
  const contacts = pool.contacts
    .map((c) => ({ c, s: Math.max(fuzzyScore(c.name, term), fuzzyScore(c.ico ?? '', term)) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.c)
  return { documents, contacts }
}

function DocRow({ d }: { d: FoundDoc }) {
  return (
    <>
      <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block truncate">{d.customerName ?? '—'}</span>
        <span className="block truncate text-xs text-muted-foreground">
          <span className="font-mono tabular-nums">{d.number ?? cs.invoices.noNumber}</span>
          {d.variableSymbol && <span> · VS {d.variableSymbol}</span>}
        </span>
      </span>
      <Amount value={d.total} currency={d.currency} size="sm" />
      <span className="hidden sm:block">
        <InvoiceStatus status={d.displayStatus} viaAssistant={d.viaAssistant} />
      </span>
    </>
  )
}

function ContactRow({ c }: { c: FoundContact }) {
  return (
    <>
      <Avatar name={c.name} size="xs" />
      <span className="min-w-0 flex-1 truncate">{c.name}</span>
      {c.ico && <span className="text-xs text-muted-foreground tabular-nums">IČO {c.ico}</span>}
    </>
  )
}

export function CommandPalette() {
  const { paletteOpen, setPaletteOpen, setHelpOpen, askAssistant } = useShell()
  const navigate = useNavigate()
  const newInvoiceFor = useNewInvoiceFor()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const navItems = useNavItems()

  useEffect(() => {
    if (paletteOpen) {
      setQuery('')
      setActive(0)
    }
  }, [paletteOpen])

  const q = query.trim()
  const intent = useMemo(() => parseIntent(q), [q])
  const term = searchTerm(q)
  const debounced = useDebounced(term, 80)

  const pool = useQuery({
    ...orpc.search.global.queryOptions({ input: PALETTE_POOL }),
    staleTime: 30_000,
    enabled: paletteOpen,
  })
  const remote = useQuery({
    ...orpc.search.global.queryOptions({ input: { query: debounced, limit: 8 } }),
    staleTime: 60_000,
    enabled: paletteOpen && debounced.length > 0,
  })

  // Instant: filter the prefetched pool while the server query for this exact term is in flight.
  const found: Found = useMemo(() => {
    if (!term) return pool.data ?? { documents: [], contacts: [] }
    if (remote.data && debounced === term) return remote.data
    return localSearch(pool.data ?? { documents: [], contacts: [] }, term)
  }, [term, debounced, remote.data, pool.data])

  const items = useMemo(() => {
    const close = () => setPaletteOpen(false)
    const go = (to: string, search?: Record<string, unknown>) => () => {
      close()
      void navigate({ to: to as never, search: search as never })
    }
    const openDoc = (d: FoundDoc) => () => {
      close()
      void navigate({
        to: d.status === 'draft' ? '/faktury/$id/upravit' : '/faktury/$id',
        params: { id: d.id },
      })
    }
    const docCommand = (d: FoundDoc): Command => ({
      id: `doc-${d.id}`,
      group: 'documents',
      label: `${d.number ?? cs.invoices.noNumber} ${d.customerName ?? ''}`,
      content: <DocRow d={d} />,
      run: openDoc(d),
    })
    const contactCommand = (c: FoundContact): Command => ({
      id: `contact-${c.id}`,
      group: 'contacts',
      label: c.name,
      content: <ContactRow c={c} />,
      run: () => {
        close()
        void navigate({ to: '/kontakty/$id', params: { id: c.id } })
      },
    })
    const invoiceForCommand = (c: FoundContact, group: Group): Command => ({
      id: `new-invoice-for-${c.id}`,
      group,
      label: cs.palette.newInvoiceFor(c.name),
      icon: FilePlus2,
      run: () => {
        close()
        newInvoiceFor(c.id)
      },
    })

    const statics: (Command & { keywords?: string })[] = [
      {
        id: 'new-invoice',
        group: 'actions',
        label: cs.palette.newInvoice,
        icon: FilePlus2,
        hint: 'N',
        run: go(NEW_INVOICE_PATH),
      },
      {
        id: 'new-contact',
        group: 'actions',
        label: cs.palette.newContact,
        icon: UserPlus,
        run: go('/kontakty', { novy: true }),
      },
      {
        id: 'filter-overdue',
        group: 'actions',
        label: cs.palette.overdue,
        icon: AlarmClock,
        keywords: 'splatnost dluh upomínka',
        run: go('/faktury', { filter: 'overdue' }),
      },
      {
        id: 'filter-unpaid',
        group: 'actions',
        label: cs.palette.unpaid,
        icon: Wallet,
        keywords: 'neplaceno k úhradě',
        run: go('/faktury', { filter: 'unpaid' }),
      },
      {
        id: 'filter-paid',
        group: 'actions',
        label: cs.palette.paid,
        icon: CircleCheck,
        run: go('/faktury', { filter: 'paid' }),
      },
      {
        id: 'filter-draft',
        group: 'actions',
        label: cs.palette.drafts,
        icon: FilePen,
        keywords: 'rozpracované',
        run: go('/faktury', { filter: 'draft' }),
      },
      {
        id: 'help',
        group: 'actions',
        label: cs.palette.shortcuts,
        icon: Keyboard,
        hint: '?',
        run: () => {
          close()
          setHelpOpen(true)
        },
      },
    ]
    const gotos: Command[] = navItems.map((n) => ({
      id: `go-${n.to}`,
      group: 'goto' as const,
      label: n.label,
      icon: n.icon,
      hint: `G ${n.goKey.toUpperCase()}`,
      run: go(n.to),
    }))

    if (!q) {
      const recentPages = readRecent()
        .map((p) => navItems.find((n) => n.to === p))
        .filter((n): n is NonNullable<typeof n> => Boolean(n))
        .map<Command>((n) => ({
          id: `recent-${n.to}`,
          group: 'recent',
          label: n.label,
          icon: n.icon,
          run: go(n.to),
        }))
      return [
        ...statics.filter((c) => ['new-invoice', 'new-contact', 'filter-overdue'].includes(c.id)),
        ...found.documents.slice(0, 5).map(docCommand),
        ...found.contacts.slice(0, 3).map(contactCommand),
        ...recentPages,
        ...gotos,
      ]
    }

    const out: Command[] = []
    if (intent?.kind === 'invoice-for') {
      for (const c of found.contacts.slice(0, 3)) out.push(invoiceForCommand(c, 'intent'))
    } else if (intent?.kind === 'mark-paid') {
      const wanted = intent.number.replace(/\D/g, '')
      for (const d of found.documents) {
        const matches = (d.number ?? '').replace(/\D/g, '').includes(wanted)
        if (!matches || !PAYABLE.includes(d.displayStatus) || d.type === 'credit_note') continue
        out.push({
          id: `mark-paid-${d.id}`,
          group: 'intent',
          label: cs.palette.markPaidFor(d.number ?? '', d.customerName ?? '—'),
          icon: CircleCheck,
          run: go(`/faktury/${d.id}`, { zaplatit: true }),
        })
        if (out.length >= 2) break
      }
    }
    out.push(...found.documents.slice(0, SHOWN.documents).map(docCommand))
    out.push(...found.contacts.slice(0, SHOWN.contacts).map(contactCommand))
    const top = found.contacts[0]
    if (top && intent?.kind !== 'invoice-for') out.push(invoiceForCommand(top, 'actions'))
    if (!intent && found.documents.length > 0) {
      out.push({
        id: 'search-invoices',
        group: 'actions',
        label: cs.palette.searchInvoices(q),
        icon: Search,
        run: go('/faktury', { q }),
      })
    }
    const scored = (c: Command & { keywords?: string }) =>
      fuzzyScore(`${c.label} ${c.keywords ?? ''}`, q)
    out.push(
      ...statics
        .map((c) => ({ c, s: scored(c) }))
        .filter((x) => x.s >= 0)
        .sort((a, b) => b.s - a.s)
        .map((x) => x.c),
      ...gotos.filter((c) => fuzzyScore(c.label, q) >= 0),
    )
    // Free text always has a way out: the assistant, last.
    out.push({
      id: 'ask',
      group: 'assistant',
      label: `${cs.palette.ask}: „${q}“`,
      icon: Sparkles,
      run: () => {
        close()
        askAssistant(q)
      },
    })
    return out
  }, [
    q,
    intent,
    found,
    navigate,
    newInvoiceFor,
    setPaletteOpen,
    setHelpOpen,
    askAssistant,
    navItems,
  ])

  useEffect(() => {
    setActive((a) => Math.min(a, Math.max(items.length - 1, 0)))
  }, [items.length])

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const groupLabel = (g: Group) =>
    ({
      intent: cs.palette.quick,
      documents: q ? cs.palette.documents : cs.palette.recentDocuments,
      contacts: q ? cs.palette.contacts : cs.palette.recentContacts,
      actions: cs.palette.actions,
      goto: cs.palette.goTo,
      recent: cs.palette.recent,
      assistant: cs.palette.assistant,
    })[g]

  const groups: { key: Group; items: Command[] }[] = []
  for (const item of items) {
    const last = groups[groups.length - 1]
    if (last?.key === item.group) last.items.push(item)
    else groups.push({ key: item.group, items: [item] })
  }

  return (
    <Dialog open={paletteOpen} onOpenChange={setPaletteOpen}>
      <DialogContent
        showCloseButton={false}
        instant
        className="top-[14%] max-w-2xl translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-2xl"
      >
        <DialogTitle className="sr-only">{cs.palette.title}</DialogTitle>
        <DialogDescription className="sr-only">{cs.palette.description}</DialogDescription>
        <div className="flex items-center gap-2 border-b px-3">
          <Search className="size-4 text-muted-foreground" aria-hidden />
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown' || (e.ctrlKey && e.key === 'n')) {
                e.preventDefault()
                setActive((a) => (a + 1) % Math.max(items.length, 1))
              } else if (e.key === 'ArrowUp' || (e.ctrlKey && e.key === 'p')) {
                e.preventDefault()
                setActive((a) => (a - 1 + items.length) % Math.max(items.length, 1))
              } else if (e.key === 'Enter') {
                e.preventDefault()
                items[active]?.run()
              }
            }}
            placeholder={cs.palette.placeholder}
            aria-label={cs.palette.title}
            className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <Kbd>Esc</Kbd>
        </div>
        <div ref={listRef} className="max-h-[26rem] overflow-y-auto p-1.5">
          {items.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              {cs.palette.empty}
            </p>
          )}
          {groups.map((g, gi) => (
            <div key={`${g.key}-${gi}`} className="pb-1">
              <div className="px-2 pt-2 pb-1 text-xs font-medium text-foreground/70">
                {groupLabel(g.key)}
              </div>
              {g.items.map((c) => {
                const index = items.indexOf(c)
                return (
                  <button
                    key={c.id}
                    type="button"
                    data-active={index === active}
                    onMouseMove={() => setActive(index)}
                    onClick={c.run}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-md px-2 text-left text-sm data-[active=true]:bg-accent data-[active=true]:text-accent-foreground',
                      c.content ? 'min-h-11 py-1' : 'h-10',
                    )}
                  >
                    {c.content ?? (
                      <>
                        {c.icon && <c.icon className="size-4 text-muted-foreground" aria-hidden />}
                        <span className="flex-1 truncate">{c.label}</span>
                      </>
                    )}
                    {c.hint && (
                      <span className="flex gap-1">
                        {c.hint.split(' ').map((k) => (
                          <Kbd key={k}>{k}</Kbd>
                        ))}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
        <div className="hidden items-center gap-4 border-t px-3 py-2 text-xs text-muted-foreground sm:flex">
          <span className="flex items-center gap-1">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> {cs.palette.footer.move}
          </span>
          <span className="flex items-center gap-1">
            <Kbd>↵</Kbd> {cs.palette.footer.open}
          </span>
          <span className="flex items-center gap-1">
            <Kbd>Esc</Kbd> {cs.palette.footer.close}
          </span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
