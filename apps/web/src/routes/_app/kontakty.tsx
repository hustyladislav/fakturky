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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@fakturky/ui/components/table'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'
import { cs } from '@/i18n/cs'
import { orpc } from '@/lib/orpc'

export const Route = createFileRoute('/_app/kontakty')({
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{cs.contacts.title}</h1>
        <NewContact />
      </div>
      {list.data?.length === 0 ? (
        <p className="text-muted-foreground">{cs.contacts.empty}</p>
      ) : (
        <Table>
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
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => archive.mutate({ id: c.id })}>
                    {cs.common.archive}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}

function NewContact() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
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
