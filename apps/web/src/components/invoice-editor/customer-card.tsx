import { Button } from '@fakturky/ui/components/button'
import { Input } from '@fakturky/ui/components/input'
import { Label } from '@fakturky/ui/components/label'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus, X } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { cs } from '@/i18n/cs'
import { client, orpc } from '@/lib/orpc'

export type PickedCustomer = { id: string; name: string; ico?: string | null }

const t = cs.invoices.form

interface Details {
  dic?: string | null
  ico?: string | null
  address?: { street?: string | undefined; city?: string | undefined; zip?: string | undefined }
}

/**
 * The customer block of the invoice: a picked customer is shown like it will read on the document; before
 * that a search box (own contacts, 8-digit IČO -> ARES), chips for the people billed most recently and an
 * inline "Nový odběratel" form.
 */
export function CustomerCard({
  value,
  details,
  onChange,
  autoFocus,
}: {
  value: PickedCustomer | null
  /** Contact data of the picked customer (address, DIČ) for the summary. */
  details?: Details | undefined
  onChange: (c: PickedCustomer | null) => void
  /** Focus the search box on mount (a brand-new invoice starts here). */
  autoFocus?: boolean
}) {
  const queryClient = useQueryClient()
  const [term, setTerm] = useState('')
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [active, setActive] = useState(-1)
  // Enter on a typed IČO before ARES answered: pick the result as soon as it arrives.
  const [enterPending, setEnterPending] = useState(false)
  const listId = useId()
  const searchRef = useRef<HTMLInputElement>(null)
  const q = term.trim()
  const isIco = /^\d{8}$/.test(q.replace(/\s/g, ''))

  // The server-rendered input is typeable before React hydrates, and hydration resets a controlled input
  // to its state ('') - the text typed in that window vanished. Adopt it instead.
  useEffect(() => {
    const typed = searchRef.current?.value
    if (typed) {
      setTerm(typed)
      setOpen(true)
    }
  }, [])

  const hadValue = useRef(false)
  useEffect(() => {
    if (value) hadValue.current = true
    else if (hadValue.current) {
      hadValue.current = false
      searchRef.current?.focus()
    }
  }, [value])

  const contacts = useQuery(
    orpc.contacts.list.queryOptions({ input: { search: q || undefined, limit: 8 } }),
  )
  // "Recent": whoever was billed last. Drafts included, so a half-finished day still shows up.
  const recentDocs = useQuery({
    ...orpc.documents.list.queryOptions({ input: { filter: 'all', limit: 30 } }),
    enabled: !value,
    staleTime: 60_000,
  })
  const recent = useMemo(() => {
    const seen = new Map<string, string>()
    for (const d of recentDocs.data ?? []) {
      if (d.contactId && d.customerName && !seen.has(d.contactId))
        seen.set(d.contactId, d.customerName)
    }
    return [...seen].slice(0, 4).map(([id, name]) => ({ id, name }))
  }, [recentDocs.data])

  const ares = useQuery({
    queryKey: ['ares', q.replace(/\s/g, '')],
    queryFn: () => client.lookup.ares({ ico: q.replace(/\s/g, '') }),
    enabled: isIco,
    staleTime: 5 * 60_000,
    retry: false,
  })
  const fromAres = useMutation({
    mutationFn: async () => {
      const s = ares.data
      if (!s) throw new Error('no subject')
      return client.contacts.create({
        name: s.name,
        ico: s.ico,
        dic: s.dic,
        address: { street: s.address.street, city: s.address.city, zip: s.address.zip },
        country: s.address.country || 'CZ',
      })
    },
    onSuccess: async (c) => {
      await queryClient.invalidateQueries({ queryKey: orpc.contacts.key() })
      pick({ id: c.id, name: c.name, ico: c.ico })
    },
  })

  function pick(c: PickedCustomer) {
    onChange(c)
    setOpen(false)
    setTerm('')
    setCreating(false)
  }

  const own = contacts.data ?? []
  const aresNew = ares.data && !own.some((c) => c.ico === ares.data?.ico) ? ares.data : null
  // One flat list so arrow keys walk "Vaši odběratelé" and then the ARES result.
  const optionCount = own.length + (aresNew ? 1 : 0)
  const activeIndex = active >= 0 ? Math.min(active, optionCount - 1) : q ? 0 : -1
  const optionId = (i: number) => `${listId}-opt-${i}`

  function pickOption(i: number) {
    const c = own[i]
    if (c) pick({ id: c.id, name: c.name, ico: c.ico })
    else if (aresNew && i === own.length) fromAres.mutate()
  }

  // Enter pressed while ARES was still answering.
  useEffect(() => {
    if (!enterPending || ares.isFetching || contacts.isFetching) return
    setEnterPending(false)
    if (optionCount > 0) pickOption(own.length > 0 ? 0 : own.length)
  })

  function onSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.nativeEvent.isComposing) return
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (optionCount === 0) return
      e.preventDefault()
      setOpen(true)
      const dir = e.key === 'ArrowDown' ? 1 : -1
      setActive((activeIndex + dir + optionCount) % optionCount)
    } else if (e.key === 'Enter' && !(e.metaKey || e.ctrlKey)) {
      if (!q) return
      e.preventDefault()
      if (activeIndex >= 0 && optionCount > 0) pickOption(activeIndex)
      else if (isIco) setEnterPending(true)
    } else if (e.key === 'Escape' && open) {
      e.preventDefault()
      setOpen(false)
    }
  }

  if (value) {
    const a = details?.address
    const line = [a?.street, [a?.zip, a?.city].filter(Boolean).join(' ')].filter(Boolean)
    return (
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1 text-sm">
          <div className="text-[17px] leading-6">{value.name}</div>
          {line.map((l) => (
            <div key={l} className="text-muted-foreground">
              {l}
            </div>
          ))}
          {(value.ico || details?.ico || details?.dic) && (
            <div className="mt-0.5 text-muted-foreground tabular-nums">
              {(value.ico ?? details?.ico) && <>IČO {value.ico ?? details?.ico}</>}
              {(value.ico ?? details?.ico) && details?.dic && ' · '}
              {details?.dic && <>DIČ {details.dic}</>}
            </div>
          )}
        </div>
        <button
          type="button"
          className="flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-muted-foreground text-sm hover:bg-muted hover:text-foreground pointer-coarse:min-h-11"
          onClick={() => onChange(null)}
        >
          <X className="size-3.5" aria-hidden /> {t.customerChange}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Input
          ref={searchRef}
          value={term}
          onChange={(e) => {
            setTerm(e.target.value)
            setOpen(true)
            setActive(-1)
          }}
          onKeyDown={onSearchKeyDown}
          autoFocus={autoFocus}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && activeIndex >= 0 ? optionId(activeIndex) : undefined}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={t.customerSearch}
          aria-label={t.customer}
          autoComplete="off"
          enterKeyHint="search"
          className="h-10"
        />
        {open && (
          <div
            id={listId}
            className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg bg-popover shadow-floating"
          >
            {own.length > 0 && (
              <div className="py-1">
                <div className="px-3 pt-2 pb-1 text-muted-foreground text-xs">
                  {t.customerYours}
                </div>
                {own.map((c, i) => (
                  <button
                    key={c.id}
                    id={optionId(i)}
                    type="button"
                    tabIndex={-1}
                    data-active={i === activeIndex || undefined}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-muted data-[active]:bg-muted"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick({ id: c.id, name: c.name, ico: c.ico })}
                  >
                    <span className="min-w-0 flex-1 truncate">{c.name}</span>
                    {c.ico && <span className="text-muted-foreground tabular-nums">{c.ico}</span>}
                  </button>
                ))}
              </div>
            )}
            {aresNew && (
              <div className="py-1">
                <div className="px-3 pt-2 pb-1 text-muted-foreground text-xs">{t.customerAres}</div>
                <button
                  id={optionId(own.length)}
                  type="button"
                  tabIndex={-1}
                  data-active={own.length === activeIndex || undefined}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted data-[active]:bg-muted"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => fromAres.mutate()}
                >
                  <span className="min-w-0 truncate">{aresNew.name}</span>
                  <span className="text-muted-foreground tabular-nums">{aresNew.ico}</span>
                </button>
              </div>
            )}
            {ares.isError && <p className="px-3 py-2 text-destructive text-sm">{t.aresFailed}</p>}
            {own.length === 0 && !aresNew && !ares.isFetching && (
              <p className="px-3 py-2 text-muted-foreground text-sm">{t.customerNone}</p>
            )}
            {ares.isFetching && (
              <p className="flex items-center gap-2 px-3 py-2 text-muted-foreground text-sm">
                <Loader2 className="size-4 animate-spin" aria-hidden /> {cs.common.loading}
              </p>
            )}
          </div>
        )}
      </div>

      {!open && !q && recent.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-1 gap-y-0">
          <span className="text-muted-foreground text-sm">{t.customerRecent}:</span>
          <div className="contents">
            {recent.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => pick({ id: c.id, name: c.name })}
                className="max-w-full rounded-md px-2 py-1 text-sm transition-colors hover:bg-muted pointer-coarse:min-h-11"
              >
                <span className="truncate">{c.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {creating ? (
        <NewCustomer onCancel={() => setCreating(false)} onCreated={pick} />
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="-ml-2.5"
          onClick={() => setCreating(true)}
        >
          <Plus /> {t.customerNew}
        </Button>
      )}
    </div>
  )
}

/** Inline "Nový odběratel": name, IČO (ARES fills the rest), address. Creates the contact and picks it. */
function NewCustomer({
  onCancel,
  onCreated,
}: {
  onCancel: () => void
  onCreated: (c: PickedCustomer) => void
}) {
  const queryClient = useQueryClient()
  const id = useId()
  const [name, setName] = useState('')
  const [ico, setIco] = useState('')
  const [street, setStreet] = useState('')
  const [city, setCity] = useState('')
  const [zip, setZip] = useState('')
  const [dic, setDic] = useState<string | null>(null)
  const [filled, setFilled] = useState(false)

  async function lookup(value: string) {
    const digits = value.replace(/\s/g, '')
    if (!/^\d{8}$/.test(digits)) return
    try {
      const s = await client.lookup.ares({ ico: digits })
      if (!s) return
      setName((n) => n || s.name)
      setStreet((v) => v || s.address.street)
      setCity((v) => v || s.address.city)
      setZip((v) => v || s.address.zip)
      setDic(s.dic)
      setFilled(true)
    } catch {
      toast.error(t.aresFailed)
    }
  }

  const create = useMutation({
    mutationFn: () =>
      client.contacts.create({
        name: name.trim(),
        ico: ico.replace(/\s/g, '') || null,
        dic,
        address: { street, city, zip },
        country: 'CZ',
      }),
    onSuccess: async (c) => {
      await queryClient.invalidateQueries({ queryKey: orpc.contacts.key() })
      onCreated({ id: c.id, name: c.name, ico: c.ico })
    },
  })

  return (
    <div className="space-y-3 rounded-lg bg-muted/60 p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-ico`}>{t.customerNewIco}</Label>
          <Input
            id={`${id}-ico`}
            inputMode="numeric"
            value={ico}
            onChange={(e) => {
              setIco(e.target.value)
              void lookup(e.target.value)
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-name`}>{t.customerNewName}</Label>
          <Input id={`${id}-name`} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_6rem]">
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-street`}>{t.customerNewStreet}</Label>
          <Input id={`${id}-street`} value={street} onChange={(e) => setStreet(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-city`}>{t.customerNewCity}</Label>
          <Input id={`${id}-city`} value={city} onChange={(e) => setCity(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-zip`}>{t.customerNewZip}</Label>
          <Input id={`${id}-zip`} value={zip} onChange={(e) => setZip(e.target.value)} />
        </div>
      </div>
      {filled && <p className="text-muted-foreground text-xs">{t.customerAresFilled}</p>}
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          disabled={!name.trim() || create.isPending}
          onClick={() => create.mutate()}
        >
          {t.customerNewCreate}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          {cs.common.cancel}
        </Button>
      </div>
    </div>
  )
}
