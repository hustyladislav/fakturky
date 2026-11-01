import { Input } from '@fakturky/ui/components/input'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { cs } from '@/i18n/cs'
import { client, orpc } from '@/lib/orpc'

export type PickedCustomer = { id: string; name: string; ico?: string | null }

const t = cs.invoices.form

/** Search own contacts; an 8-digit IČO additionally offers an ARES lookup that creates the contact. */
export function CustomerPicker({
  value,
  onChange,
}: {
  value: PickedCustomer | null
  onChange: (c: PickedCustomer | null) => void
}) {
  const queryClient = useQueryClient()
  const [term, setTerm] = useState('')
  const [open, setOpen] = useState(false)
  const q = term.trim()
  const isIco = /^\d{8}$/.test(q.replace(/\s/g, ''))

  const contacts = useQuery(
    orpc.contacts.list.queryOptions({ input: { search: q || undefined, limit: 8 } }),
  )
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
    onError: () => toast.error(cs.common.error),
  })

  function pick(c: PickedCustomer) {
    onChange(c)
    setOpen(false)
    setTerm('')
  }

  if (value) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
        <div>
          <div className="font-medium">{value.name}</div>
          {value.ico && <div className="text-muted-foreground text-sm">IČO {value.ico}</div>}
        </div>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm"
          onClick={() => onChange(null)}
        >
          <X className="size-4" /> {t.customerChange}
        </button>
      </div>
    )
  }

  const own = contacts.data ?? []
  const aresNew = ares.data && !own.some((c) => c.ico === ares.data?.ico) ? ares.data : null

  return (
    <div className="relative">
      <Input
        value={term}
        onChange={(e) => {
          setTerm(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={t.customerSearch}
        aria-label={t.customer}
        autoComplete="off"
      />
      {open && (
        <div className="bg-popover absolute z-20 mt-1 w-full overflow-hidden rounded-lg border shadow-md">
          {own.length > 0 && (
            <div>
              <div className="text-muted-foreground px-3 pt-2 text-xs">{t.customerYours}</div>
              {own.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="hover:bg-muted flex w-full items-center justify-between px-3 py-2 text-left text-sm"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick({ id: c.id, name: c.name, ico: c.ico })}
                >
                  <span>{c.name}</span>
                  {c.ico && <span className="text-muted-foreground tabular-nums">{c.ico}</span>}
                </button>
              ))}
            </div>
          )}
          {aresNew && (
            <div>
              <div className="text-muted-foreground px-3 pt-2 text-xs">{t.customerAres}</div>
              <button
                type="button"
                className="hover:bg-muted flex w-full items-center justify-between px-3 py-2 text-left text-sm"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => fromAres.mutate()}
              >
                <span>{aresNew.name}</span>
                <span className="text-muted-foreground tabular-nums">{aresNew.ico}</span>
              </button>
            </div>
          )}
          {ares.isError && <p className="text-destructive px-3 py-2 text-sm">{t.aresFailed}</p>}
          {own.length === 0 && !aresNew && !ares.isFetching && (
            <p className="text-muted-foreground px-3 py-2 text-sm">{t.customerNone}</p>
          )}
          {ares.isFetching && (
            <p className="text-muted-foreground flex items-center gap-2 px-3 py-2 text-sm">
              <Check className="size-4 opacity-0" /> {cs.common.loading}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
