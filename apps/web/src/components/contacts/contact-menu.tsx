import { Button } from '@fakturky/ui/components/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@fakturky/ui/components/dropdown-menu'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Archive, FilePlus2, MoreHorizontal, Pencil } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { cs } from '@/i18n/cs'
import { setInvoicePrefill } from '@/lib/invoice-prefill'
import { orpc } from '@/lib/orpc'
import { EditContactDialog } from './contact-dialogs'

type Contact = Parameters<typeof EditContactDialog>[0]['contact']

/** Starts a new invoice with this contact already chosen as the customer. */
export function useNewInvoiceFor() {
  const navigate = useNavigate()
  return (contactId: string) => {
    setInvoicePrefill({ contactId, lines: [] })
    void navigate({ to: '/faktury/nova' })
  }
}

/** "…" row menu: edit, new invoice for the contact, archive. */
export function ContactMenu({
  contact,
  onArchived,
}: {
  contact: Contact
  onArchived?: () => void
}) {
  const queryClient = useQueryClient()
  const newInvoice = useNewInvoiceFor()
  const [editing, setEditing] = useState(false)
  const archive = useMutation(
    orpc.contacts.archive.mutationOptions({
      onSuccess: async () => {
        toast.success(cs.contacts.archived)
        await queryClient.invalidateQueries({ queryKey: orpc.contacts.key() })
        onArchived?.()
      },
    }),
  )
  return (
    <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon" aria-label={cs.contacts.menu} />}
        >
          <MoreHorizontal aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent side="bottom" align="end" className="min-w-48">
          <DropdownMenuItem onClick={() => setEditing(true)}>
            <Pencil aria-hidden /> {cs.common.edit}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => newInvoice(contact.id)}>
            <FilePlus2 aria-hidden /> {cs.contacts.newInvoiceFor}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => archive.mutate({ id: contact.id })}>
            <Archive aria-hidden /> {cs.common.archive}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {editing && <EditContactDialog contact={contact} open onOpenChange={setEditing} />}
    </div>
  )
}
