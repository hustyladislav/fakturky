import { Button } from '@fakturky/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@fakturky/ui/components/dialog'
import { EmptyState } from '@fakturky/ui/components/empty-state'
import { Input } from '@fakturky/ui/components/input'
import { Label } from '@fakturky/ui/components/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@fakturky/ui/components/table'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { CsvDownload } from '@/components/csv-download'
import { cs } from '@/i18n/cs'
import { orpc } from '@/lib/orpc'

export const Route = createFileRoute('/_app/kontakty')({
  validateSearch: (search: Record<string, unknown>): { novy?: boolean } =>
    search.novy === true || search.novy === 'true' ? { novy: true } : {},
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(orpc.contacts.list.queryOptions({ input: {} })),
  component: Contacts,
})

function Contacts() {
  const queryClient = useQueryClient()
  const list = useQuery(orpc.contacts.list.queryOptions({ input: {} }))
  const archive = useMutation(
    orpc.contacts.archive.mutationOptions({
      onSuccess: async () => {
        toast.success(cs.contacts.archived)
        await queryClient.invalidateQueries({ queryKey: orpc.contacts.key() })
      },
    }),
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{cs.contacts.title}</h1>
        <div className="flex flex-wrap gap-2">
          <CsvDownload kind="contacts" />
          <NewContact />
        </div>
      </div>
      {list.data?.length === 0 ? (
        <EmptyState icon={Users} title={cs.contacts.emptyTitle}>
          {cs.contacts.empty}
        </EmptyState>
      ) : (
        <>
          <ul className="divide-y overflow-hidden rounded-xl border sm:hidden">
            {list.data?.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{c.name}</div>
                  <div className="truncate text-sm text-muted-foreground">
                    {[c.ico && `${cs.contacts.ico} ${c.ico}`, c.emails[0]]
                      .filter(Boolean)
                      .join(' · ') || '—'}
                  </div>
                </div>
                <EditContact contact={c} />
                <Button variant="ghost" size="sm" onClick={() => archive.mutate({ id: c.id })}>
                  {cs.common.archive}
                </Button>
              </li>
            ))}
          </ul>
          <Table className="hidden sm:table">
            <TableHeader>
              <TableRow>
                <TableHead>{cs.contacts.name}</TableHead>
                <TableHead>{cs.contacts.ico}</TableHead>
                <TableHead>{cs.contacts.email}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.data?.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{c.ico}</TableCell>
                  <TableCell>{c.emails[0]}</TableCell>
                  <TableCell className="space-x-1 text-right">
                    <EditContact contact={c} />
                    <Button variant="ghost" size="sm" onClick={() => archive.mutate({ id: c.id })}>
                      {cs.common.archive}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}
    </div>
  )
}

function NewContact() {
  const queryClient = useQueryClient()
  const { novy } = Route.useSearch()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  // ?novy opens the dialog (used by the ⌘K "Nový kontakt" action), then clears itself.
  useEffect(() => {
    if (!novy) return
    setOpen(true)
    void navigate({ to: '/kontakty', search: {}, replace: true })
  }, [novy, navigate])
  const create = useMutation(
    orpc.contacts.create.mutationOptions({
      onSuccess: async () => {
        toast.success(cs.contacts.created)
        setOpen(false)
        await queryClient.invalidateQueries({ queryKey: orpc.contacts.key() })
      },
      onError: () => toast.error(cs.common.error),
    }),
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>{cs.contacts.new}</DialogTrigger>
      <DialogContent>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            const form = new FormData(e.currentTarget)
            const text = (key: string) => String(form.get(key) ?? '').trim() || undefined
            const email = text('email')
            create.mutate({
              name: String(form.get('name') ?? ''),
              ico: text('ico'),
              dic: text('dic'),
              phone: text('phone'),
              address: { street: text('street'), city: text('city'), zip: text('zip') },
              emails: email ? [email] : [],
            })
          }}
        >
          <DialogHeader>
            <DialogTitle>{cs.contacts.new}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="name">{cs.contacts.name}</Label>
            <Input id="name" name="name" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ico">{cs.contacts.ico}</Label>
              <Input id="ico" name="ico" inputMode="numeric" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dic">{cs.contacts.dic}</Label>
              <Input id="dic" name="dic" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="street">{cs.contacts.street}</Label>
            <Input id="street" name="street" autoComplete="off" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">{cs.contacts.city}</Label>
              <Input id="city" name="city" autoComplete="off" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="zip">{cs.contacts.zip}</Label>
              <Input id="zip" name="zip" autoComplete="off" />
            </div>
          </div>
          <p className="text-muted-foreground text-xs">{cs.contacts.taxDocHint}</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">{cs.contacts.email}</Label>
              <Input id="email" name="email" type="email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">{cs.contacts.phone}</Label>
              <Input id="phone" name="phone" type="tel" />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={create.isPending}>
              {cs.common.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

type ContactRow = Awaited<ReturnType<typeof import('@/lib/orpc').client.contacts.get>>

/** Edit an existing contact, e.g. to add the address a VAT payer's tax document requires. */
function EditContact({ contact }: { contact: ContactRow }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const update = useMutation(
    orpc.contacts.update.mutationOptions({
      onSuccess: async () => {
        toast.success(cs.contacts.updated)
        setOpen(false)
        await queryClient.invalidateQueries({ queryKey: orpc.contacts.key() })
      },
      onError: () => toast.error(cs.common.error),
    }),
  )
  const field = (id: string, label: string, value: string | null | undefined, extra = {}) => (
    <div className="space-y-2">
      <Label htmlFor={`e-${id}`}>{label}</Label>
      <Input id={`e-${id}`} name={id} defaultValue={value ?? ''} autoComplete="off" {...extra} />
    </div>
  )
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="sm" />}>{cs.common.edit}</DialogTrigger>
      <DialogContent>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            const f = new FormData(e.currentTarget)
            const text = (k: string) => String(f.get(k) ?? '').trim()
            const email = text('email')
            update.mutate({
              id: contact.id,
              patch: {
                name: text('name'),
                ico: text('ico') || null,
                dic: text('dic') || null,
                phone: text('phone') || null,
                address: {
                  ...contact.address,
                  street: text('street'),
                  city: text('city'),
                  zip: text('zip'),
                },
                emails: email ? [email] : [],
              },
            })
          }}
        >
          <DialogHeader>
            <DialogTitle>{cs.contacts.edit}</DialogTitle>
          </DialogHeader>
          {field('name', cs.contacts.name, contact.name, { required: true })}
          <div className="grid grid-cols-2 gap-4">
            {field('ico', cs.contacts.ico, contact.ico, { inputMode: 'numeric' })}
            {field('dic', cs.contacts.dic, contact.dic)}
          </div>
          {field('street', cs.contacts.street, contact.address.street)}
          <div className="grid grid-cols-2 gap-4">
            {field('city', cs.contacts.city, contact.address.city)}
            {field('zip', cs.contacts.zip, contact.address.zip)}
          </div>
          <p className="text-muted-foreground text-xs">{cs.contacts.taxDocHint}</p>
          <div className="grid grid-cols-2 gap-4">
            {field('email', cs.contacts.email, contact.emails[0], { type: 'email' })}
            {field('phone', cs.contacts.phone, contact.phone, { type: 'tel' })}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={update.isPending}>
              {cs.common.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
