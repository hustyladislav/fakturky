import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@fakturky/ui/components/dialog'
import { Kbd } from '@fakturky/ui/components/kbd'
import { useNavigate } from '@tanstack/react-router'
import { FilePlus2, Keyboard, type LucideIcon, Search, Sparkles, UserPlus } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { cs } from '@/i18n/cs'
import { NEW_INVOICE_PATH, useNavItems } from './nav'
import { readRecent } from './recent-pages'
import { useShell } from './shell-context'

interface Command {
  id: string
  group: 'actions' | 'goto' | 'recent' | 'assistant'
  label: string
  icon: LucideIcon
  hint?: string
  run: () => void
}

const groupLabels = {
  actions: cs.palette.actions,
  goto: cs.palette.goTo,
  recent: cs.palette.recent,
  assistant: cs.palette.assistant,
} as const

export function CommandPalette() {
  const { paletteOpen, setPaletteOpen, setHelpOpen, askAssistant } = useShell()
  const navigate = useNavigate()
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

  const items = useMemo(() => {
    const close = () => setPaletteOpen(false)
    const go = (to: string) => () => {
      close()
      void navigate({ to: to as never })
    }
    const all: Command[] = [
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
        run: () => {
          close()
          void navigate({ to: '/kontakty', search: { novy: true } })
        },
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
      ...navItems.map((n) => ({
        id: `go-${n.to}`,
        group: 'goto' as const,
        label: n.label,
        icon: n.icon,
        hint: `G ${n.goKey.toUpperCase()}`,
        run: go(n.to),
      })),
    ]
    const q = query.trim().toLowerCase()
    let result: Command[]
    if (q) {
      result = all.filter((c) => c.label.toLowerCase().includes(q))
    } else {
      const recent = readRecent()
        .map((p) => navItems.find((n) => n.to === p))
        .filter((n): n is NonNullable<typeof n> => Boolean(n))
        .map((n) => ({
          id: `recent-${n.to}`,
          group: 'recent' as const,
          label: n.label,
          icon: n.icon,
          run: go(n.to),
        }))
      result = [
        ...all.filter((c) => c.group === 'actions'),
        ...recent,
        ...all.filter((c) => c.group === 'goto'),
      ]
    }
    // "Zeptat se asistenta" when the query reads like a sentence (3+ words) or nothing matched.
    if (q && (q.split(/\s+/).length >= 3 || result.length === 0)) {
      result.push({
        id: 'ask',
        group: 'assistant',
        label: `${cs.palette.ask}: „${query.trim()}“`,
        icon: Sparkles,
        run: () => {
          close()
          askAssistant(query.trim())
        },
      })
    }
    return result
  }, [query, navigate, setPaletteOpen, setHelpOpen, askAssistant, navItems])

  useEffect(() => {
    setActive((a) => Math.min(a, Math.max(items.length - 1, 0)))
  }, [items.length])

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const groups: { key: Command['group']; items: Command[] }[] = []
  for (const item of items) {
    const last = groups[groups.length - 1]
    if (last?.key === item.group) last.items.push(item)
    else groups.push({ key: item.group, items: [item] })
  }

  return (
    <Dialog open={paletteOpen} onOpenChange={setPaletteOpen}>
      <DialogContent
        showCloseButton={false}
        className="top-[18%] max-w-xl translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl"
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
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setActive((a) => (a + 1) % Math.max(items.length, 1))
              } else if (e.key === 'ArrowUp') {
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
        <div ref={listRef} className="max-h-80 overflow-y-auto p-1.5">
          {items.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              {cs.palette.empty}
            </p>
          )}
          {groups.map((g) => (
            <div key={g.key} className="pb-1">
              <div className="px-2 pt-2 pb-1 text-xs font-medium text-foreground/70">
                {groupLabels[g.key]}
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
                    className="flex h-10 w-full items-center gap-3 rounded-md px-2 text-left text-sm data-[active=true]:bg-accent data-[active=true]:text-accent-foreground"
                  >
                    <c.icon className="size-4 text-muted-foreground" aria-hidden />
                    <span className="flex-1 truncate">{c.label}</span>
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
      </DialogContent>
    </Dialog>
  )
}
