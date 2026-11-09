import { formatDateCs } from '@fakturky/domain/dates'
import { formatMoney } from '@fakturky/ui/lib/money'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { ActionId } from '@/components/invoice-detail/actions'
import { useShareLink } from '@/components/invoice-detail/share-pay'
import { cs } from '@/i18n/cs'
import { refreshDocumentData } from '@/lib/document-cache'
import type { DocumentDetail } from '@/lib/document-sheet'
import { apiErrorMessage } from '@/lib/errors'
import { orpc } from '@/lib/orpc'

const t = cs.invoices.detail

export type DetailDialog = 'cancel' | 'delete' | 'rotate' | 'template' | 'credit' | 'receipt'
export type DetailPanel = 'pay' | 'send'

/**
 * Everything the invoice detail does to a document: the mutations, which dialog or inline panel is open,
 * and `run(action)` so a button only has to name the action it stands for.
 */
export function useInvoiceController(id: string, d: DocumentDetail | undefined, openPay: boolean) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [panel, setPanel] = useState<DetailPanel | null>(null)
  const [dialog, setDialog] = useState<DetailDialog | null>(null)
  useEffect(() => {
    // `?zaplatit` opens the payment panel (⌘K "zaplatit 2026-0028").
    if (openPay) setPanel('pay')
  }, [openPay])
  const { share, copied } = useShareLink()

  const refresh = () => refreshDocumentData(queryClient)
  const toDraftEditor = (message: string) => async (n: { id: string }) => {
    toast.success(message)
    await refresh()
    navigate({ to: '/faktury/$id/upravit', params: { id: n.id } })
  }

  const issue = useMutation(
    orpc.documents.issue.mutationOptions({
      onSuccess: async (n) => {
        toast.success(t.issued(n.number ?? ''))
        await refresh()
      },
    }),
  )
  const markUnpaid = useMutation(
    orpc.documents.markUnpaid.mutationOptions({
      onSuccess: async () => {
        toast.success(t.unpaid)
        await refresh()
      },
    }),
  )
  const markPaid = useMutation(
    orpc.documents.markPaid.mutationOptions({
      onSuccess: async (paid, vars) => {
        // The new payment is the one that was not on the page before; undo removes only that one.
        const before = new Set((d?.payments ?? []).map((p) => p.id))
        const added = paid.payments.find((p) => !before.has(p.id))
        toast.success(t.paid, {
          duration: 5000,
          ...(added && {
            action: {
              label: t.undo,
              onClick: () => markUnpaid.mutate({ id: vars.id, paymentId: added.id }),
            },
          }),
        })
        setPanel(null)
        await refresh()
      },
    }),
  )
  const cancel = useMutation(
    orpc.documents.cancel.mutationOptions({
      onSuccess: async () => {
        toast.success(t.cancelled)
        await refresh()
      },
    }),
  )
  const rotateLink = useMutation(
    orpc.documents.rotateLink.mutationOptions({
      onSuccess: async () => {
        toast.success(t.linkRotated)
        await refresh()
      },
    }),
  )
  const duplicate = useMutation(
    orpc.documents.duplicate.mutationOptions({ onSuccess: toDraftEditor(t.duplicated) }),
  )
  const send = useMutation(
    orpc.documents.send.mutationOptions({
      onSuccess: async (_n, v) => {
        toast.success(v.reminder ? t.reminded : t.sent)
        setPanel(null)
        await refresh()
      },
      onError: (e) => {
        const reason = (e as { data?: { reason?: keyof typeof t.mail } }).data?.reason
        toast.error(reason ? t.mail[reason] : apiErrorMessage(e))
      },
    }),
  )
  const creditNote = useMutation(
    orpc.documents.createCreditNote.mutationOptions({
      onSuccess: toDraftEditor(t.creditNoteCreated),
    }),
  )
  const finalInvoice = useMutation(
    orpc.documents.createFinalInvoice.mutationOptions({
      onSuccess: toDraftEditor(t.finalInvoiceCreated),
    }),
  )
  const receipt = useMutation(
    orpc.documents.createPaymentReceipt.mutationOptions({
      onSuccess: toDraftEditor(t.receiptCreated),
    }),
  )
  const saveTemplate = useMutation(
    orpc.templates.createFromDocument.mutationOptions({
      onSuccess: async (tpl) => {
        toast.success(cs.templates.saved, {
          duration: 8000,
          action: {
            label: cs.templates.setUpRepeat,
            onClick: () => navigate({ to: '/sablony', search: { opakovat: tpl.id } }),
          },
        })
        await queryClient.invalidateQueries({ queryKey: orpc.templates.key() })
      },
    }),
  )
  const remove = useMutation(
    orpc.documents.delete.mutationOptions({
      onSuccess: async () => {
        toast.success(t.deleted)
        await refresh()
        navigate({ to: '/faktury' })
      },
    }),
  )

  const publicUrl = d?.publicToken ? `${window.location.origin}/f/${d.publicToken}` : null

  const shareLink = () => {
    if (!d || !publicUrl) return
    const what =
      `${cs.invoices.type[d.type as keyof typeof cs.invoices.type]} ${d.number ?? ''}`.trim()
    return share({
      url: publicUrl,
      pdfUrl: `/api/documents/${id}/pdf`,
      title: what,
      text: t.shareText(
        what,
        formatMoney(d.remaining, d.currency),
        d.dueDate ? formatDateCs(d.dueDate) : null,
      ),
      fileName: `${d.number ?? 'doklad'}.pdf`,
    })
  }

  const pending: Partial<Record<ActionId, boolean>> = {
    issue: issue.isPending,
    pay: markPaid.isPending,
    send: send.isPending,
    markUnpaid: markUnpaid.isPending,
    duplicate: duplicate.isPending,
    final: finalInvoice.isPending,
    receipt: receipt.isPending,
    template: saveTemplate.isPending,
    credit: creditNote.isPending,
    cancel: cancel.isPending,
    delete: remove.isPending,
  }

  /** Runs an action that is not a plain link (edit and pdf are links). */
  const run = (action: ActionId) => {
    // One in flight per action: a second click or menu pick must not create a second document.
    if (pending[action]) return
    switch (action) {
      case 'issue':
        return issue.mutate({ id })
      case 'pay':
        return markPaid.mutate({ id })
      case 'share':
        return void shareLink()
      case 'send':
        return setPanel('send')
      case 'markUnpaid':
        return markUnpaid.mutate({ id })
      case 'duplicate':
        return duplicate.mutate({ id })
      case 'final':
        return finalInvoice.mutate({ id })
      case 'template':
      case 'credit':
      case 'receipt':
      case 'cancel':
      case 'delete':
        return setDialog(action)
      default:
        return
    }
  }

  return {
    id,
    publicUrl,
    copied,
    panel,
    setPanel,
    dialog,
    setDialog,
    pending,
    run,
    markPaid,
    send,
    cancel,
    remove,
    rotateLink,
    saveTemplate,
    creditNote,
    receipt,
  }
}

export type InvoiceController = ReturnType<typeof useInvoiceController>
