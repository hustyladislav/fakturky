import { Button } from '@fakturky/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@fakturky/ui/components/dialog'
import { Input } from '@fakturky/ui/components/input'
import { Label } from '@fakturky/ui/components/label'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { CountrySelect } from '@/components/country-select'
import { cs } from '@/i18n/cs'
import { apiErrorMessage } from '@/lib/errors'
import { orpc } from '@/lib/orpc'

export function NewContact({
  openOnMount,
  onOpened,
}: {
  openOnMount?: boolean
  onOpened?: () => void
}) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  // ?novy opens the dialog (used by the ⌘K "Nový kontakt" action), then clears itself.
  useEffect(() => {
    if (!openOnMount) return
    setOpen(true)
    onOpened?.()
  }, [openOnMount, onOpened])
  const create = useMutation(
    orpc.contacts.create.mutationOptions({
      onSuccess: async () => {
        toast.success(cs.contacts.created)
        setOpen(false)
        await queryClient.invalidateQueries({ queryKey: orpc.contacts.key() })
      },
      onError: (e) => toast.error(apiErrorMessage(e)),
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
              country: text('country') ?? 'CZ',
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
          <div className="space-y-2">
            <Label htmlFor="country">{cs.contacts.country}</Label>
            <CountrySelect id="country" />
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
export function EditContactDialog({
  contact,
  open,
  onOpenChange: setOpen,
}: {
  contact: ContactRow
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const update = useMutation(
    orpc.contacts.update.mutationOptions({
      onSuccess: async () => {
        toast.success(cs.contacts.updated)
        setOpen(false)
        await queryClient.invalidateQueries({ queryKey: orpc.contacts.key() })
      },
      onError: (e) => toast.error(apiErrorMessage(e)),
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
                country: text('country') || 'CZ',
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
          <div className="space-y-2">
            <Label htmlFor="e-country">{cs.contacts.country}</Label>
            <CountrySelect id="e-country" defaultValue={contact.country} />
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
