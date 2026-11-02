import { cn } from 'cn'
import { Check, ChevronsUpDown, Search } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from './popover'

const COMMON = ['CZK', 'EUR', 'USD', 'GBP', 'PLN', 'CHF'] as const

const FALLBACK = [
  'AUD',
  'BGN',
  'CAD',
  'CNY',
  'DKK',
  'HUF',
  'JPY',
  'NOK',
  'RON',
  'SEK',
  'TRY',
  'UAH',
] as const

function allCodes(): string[] {
  try {
    const list = (
      Intl as unknown as { supportedValuesOf?: (key: string) => string[] }
    ).supportedValuesOf?.('currency')
    if (list?.length) return list
  } catch {
    // older runtimes
  }
  return [...FALLBACK]
}

/** Common currencies first, then all ISO 4217 codes alphabetically. */
export function defaultCurrencyCodes(): string[] {
  return [
    ...COMMON,
    ...allCodes()
      .filter((c) => !(COMMON as readonly string[]).includes(c))
      .sort(),
  ]
}

/** Regional-indicator flag emoji for a currency code (EUR gets the EU flag; non-country codes get none). */
export function currencyFlag(code: string): string {
  const region = code === 'EUR' ? 'EU' : code.slice(0, 2)
  if (!/^[A-Z]{2}$/.test(region) || code.startsWith('X')) return ''
  return String.fromCodePoint(...[...region].map((c) => 0x1f1a5 + c.charCodeAt(0)))
}

function nameOf(code: string): string {
  try {
    const n = new Intl.DisplayNames(['cs'], { type: 'currency' }).of(code)
    return n && n !== code ? n : ''
  } catch {
    return ''
  }
}

/** Searchable currency picker: flag, ISO code and Czech name; keyboard navigable. */
function CurrencyCombobox({
  value,
  onChange,
  codes,
  id,
  disabled,
  className,
  ...aria
}: {
  value: string
  onChange: (code: string) => void
  codes?: readonly string[]
  id?: string
  disabled?: boolean
  className?: string
  'aria-label'?: string
  'aria-invalid'?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const listId = useId()
  const items = useMemo(
    () => (codes ?? defaultCurrencyCodes()).map((code) => ({ code, name: nameOf(code) })),
    [codes],
  )
  const q = query.trim().toLowerCase()
  const filtered = q
    ? items.filter((i) => i.code.toLowerCase().includes(q) || i.name.toLowerCase().includes(q))
    : items
  const select = (code: string) => {
    onChange(code)
    setOpen(false)
  }
  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) {
          setQuery('')
          setActive(
            Math.max(
              0,
              items.findIndex((i) => i.code === value),
            ),
          )
        }
      }}
    >
      <PopoverTrigger
        id={id}
        disabled={disabled}
        className={cn(
          'flex h-8 w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-2.5 text-left text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-[invalid=true]:border-destructive md:text-sm dark:bg-input/30',
          className,
        )}
        {...aria}
      >
        <span className="flex items-center gap-2">
          <span aria-hidden>{currencyFlag(value)}</span>
          <span className="font-medium">{value}</span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0">
        <div className="hairline-b flex items-center gap-2 px-3">
          <Search className="size-4 text-muted-foreground" aria-hidden />
          <input
            autoFocus
            role="combobox"
            aria-expanded
            aria-controls={listId}
            aria-label="Hledat měnu"
            placeholder="Hledat měnu…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setActive((a) => Math.min(a + 1, filtered.length - 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActive((a) => Math.max(a - 1, 0))
              } else if (e.key === 'Enter') {
                e.preventDefault()
                const hit = filtered[active]
                if (hit) select(hit.code)
              }
            }}
            className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <ul id={listId} role="listbox" className="max-h-64 overflow-y-auto p-1">
          {filtered.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">Nic nenalezeno</li>
          )}
          {filtered.map((item, i) => (
            <li
              key={item.code}
              role="option"
              aria-selected={item.code === value}
              ref={(el) => {
                if (el && i === active) el.scrollIntoView({ block: 'nearest' })
              }}
              onMouseMove={() => setActive(i)}
              onClick={() => select(item.code)}
              onKeyDown={() => {}}
              className={cn(
                'flex h-9 cursor-default items-center gap-2 rounded-md px-2 text-sm',
                i === active && 'bg-accent text-accent-foreground',
              )}
            >
              <span aria-hidden className="w-5 text-center">
                {currencyFlag(item.code)}
              </span>
              <span className="w-10 font-medium tabular-nums">{item.code}</span>
              <span className="min-w-0 flex-1 truncate text-muted-foreground">{item.name}</span>
              {item.code === value && <Check className="size-4 text-primary" aria-hidden />}
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  )
}

export { CurrencyCombobox }
