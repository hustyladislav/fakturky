import { formatDateCs, todayPrague } from '@fakturky/domain/dates'
import { Button, buttonVariants } from '@fakturky/ui/components/button'
import { DatePicker } from '@fakturky/ui/components/date-picker'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@fakturky/ui/components/dropdown-menu'
import { Input } from '@fakturky/ui/components/input'
import { Label } from '@fakturky/ui/components/label'
import { NativeSelect } from '@fakturky/ui/components/native-select'
import { PageHeader } from '@fakturky/ui/components/page-header'
import { Skeleton } from '@fakturky/ui/components/skeleton'
import { cn } from '@fakturky/ui/lib/utils'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import {
  ArrowLeft,
  Ban,
  BookmarkPlus,
  ChevronDown,
  CopyPlus,
  Download,
  FileCheck,
  FileMinus,
  Pencil,
  Receipt,
  Send,
  Trash2,
  Undo2,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ErrorState } from '@/components/error-state'
import {
  DocHero,
  DocumentPaper,
  PaymentCard,
  PublicLinkCard,
  RelatedDocs,
  Timeline,
} from '@/components/invoice-detail/parts'
import { PromptDialog } from '@/components/prompt-dialog'
import { cs } from '@/i18n/cs'
import { detailToSheet } from '@/lib/document-sheet'
import { apiErrorMessage } from '@/lib/errors'
import { pageHead } from '@/lib/head'
import { orpc } from '@/lib/orpc'

export const Route = createFileRoute('/_app/faktury/$id/')({
  head: pageHead(cs.invoices.title),
  component: InvoiceDetail,
})

const t = cs.invoices.detail

function InvoiceDetail() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const q = useQuery(orpc.documents.get.queryOptions({ input: { id } }))
  const [paying, setPaying] = useState(false)
  const [docOpen, setDocOpen] = useState(false)
  const [dialog, setDialog] = useState<
    'cancel' | 'delete' | 'rotate' | 'template' | 'credit' | 'receipt' | null
  >(null)
  const [rate12, setRate12] = useState('')
  const [receiptRate, setReceiptRate] = useState<'21' | '12' | 'split'>('21')
  const [amount, setAmount] = useState('')
  const [paidOn, setPaidOn] = useState(() => todayPrague())

  const refresh = () => queryClient.invalidateQueries({ queryKey: orpc.documents.key() })
  const onError = (e: unknown) => toast.error(apiErrorMessage(e))
  const issue = useMutation(
    orpc.documents.issue.mutationOptions({
      onSuccess: async (d) => {
        toast.success(t.issued(d.number ?? ''))
        await refresh()
      },
      onError,
    }),
  )
  const markPaid = useMutation(
    orpc.documents.markPaid.mutationOptions({
      onSuccess: async () => {
        toast.success(t.paid)
        setPaying(false)
        await refresh()
      },
      onError,
    }),
  )
  const markUnpaid = useMutation(
    orpc.documents.markUnpaid.mutationOptions({
      onSuccess: async () => {
        toast.success(t.unpaid)
        await refresh()
      },
      onError,
    }),
  )
  const cancel = useMutation(
    orpc.documents.cancel.mutationOptions({
      onSuccess: async () => {
        toast.success(t.cancelled)
        await refresh()
      },
      onError,
    }),
  )
  const rotateLink = useMutation(
    orpc.documents.rotateLink.mutationOptions({
      onSuccess: async () => {
        toast.success(t.linkRotated)
        await refresh()
      },
      onError,
    }),
  )
  const duplicate = useMutation(
    orpc.documents.duplicate.mutationOptions({
      onSuccess: async (d) => {
        toast.success(t.duplicated)
        await refresh()
        navigate({ to: '/faktury/$id/upravit', params: { id: d.id } })
      },
      onError,
    }),
  )
  const [sending, setSending] = useState(false)
  const [mailTo, setMailTo] = useState('')
  const [mailMsg, setMailMsg] = useState('')
  const send = useMutation(
    orpc.documents.send.mutationOptions({
      onSuccess: async (_d, v) => {
        toast.success(v.reminder ? t.reminded : t.sent)
        setSending(false)
        await refresh()
      },
      onError: (e) => {
        const reason = (e as { data?: { reason?: keyof typeof t.mail } }).data?.reason
        toast.error(reason ? t.mail[reason] : (e as Error).message || cs.common.error)
      },
    }),
  )
  const creditNote = useMutation(
    orpc.documents.createCreditNote.mutationOptions({
      onSuccess: async (n) => {
        toast.success(t.creditNoteCreated)
        await refresh()
        navigate({ to: '/faktury/$id/upravit', params: { id: n.id } })
      },
      onError,
    }),
  )
  const finalInvoice = useMutation(
    orpc.documents.createFinalInvoice.mutationOptions({
      onSuccess: async (n) => {
        toast.success(t.finalInvoiceCreated)
        await refresh()
        navigate({ to: '/faktury/$id/upravit', params: { id: n.id } })
      },
      onError,
    }),
  )
  const defaults = useQuery(orpc.documents.defaults.queryOptions({ input: {} }))
  const receipt = useMutation(
    orpc.documents.createPaymentReceipt.mutationOptions({
      onSuccess: async (n) => {
        toast.success(t.receiptCreated)
        await refresh()
        navigate({ to: '/faktury/$id/upravit', params: { id: n.id } })
      },
      onError,
    }),
  )
  const saveTemplate = useMutation(
    orpc.templates.createFromDocument.mutationOptions({
      onSuccess: async () => {
        toast.success(cs.templates.saved)
        await queryClient.invalidateQueries({ queryKey: orpc.templates.key() })
      },
      onError,
    }),
  )
  const remove = useMutation(
    orpc.documents.delete.mutationOptions({
      onSuccess: async () => {
        toast.success(t.deleted)
        await refresh()
        navigate({ to: '/faktury' })
      },
      onError,
    }),
  )

  const d = q.data
  const isDraft = d?.status === 'draft'
  // The paper needs the look (logo, accent, signature); a draft has no snapshots yet, so it also reads the
  // live profile, contact and bank account.
  const profile = useQuery({
    ...orpc.businessProfile.get.queryOptions({ input: {} }),
    enabled: isDraft,
  })
  const contact = useQuery({
    ...orpc.contacts.get.queryOptions({ input: { id: d?.contactId ?? '' } }),
    enabled: isDraft && !!d?.contactId,
  })
  const accounts = useQuery({
    ...orpc.bankAccounts.list.queryOptions({ input: {} }),
    enabled: isDraft,
  })
  const sheet = useMemo(
    () =>
      d
        ? detailToSheet(d, {
            profile: profile.data,
            contact: contact.data,
            accounts: accounts.data,
          })
        : null,
    [d, profile.data, contact.data, accounts.data],
  )

  if (q.isError) {
    // A missing invoice is final; anything else (offline, 5xx) is worth another try.
    const code = (q.error as { code?: string } | null)?.code
    if (code === 'NOT_FOUND' || code === 'BAD_REQUEST') {
      return <p className="text-muted-foreground">{t.notFound}</p>
    }
    return <ErrorState onRetry={() => q.refetch()} />
  }
  if (!d || !sheet) {
    return (
      <div className="mx-auto max-w-[1136px]" aria-busy="true">
        <Skeleton className="mb-6 h-9 w-56" />
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          <Skeleton className="h-[640px] rounded-[3px]" />
          <Skeleton className="h-[320px] rounded-xl" />
        </div>
      </div>
    )
  }

  const doc = d
  const open = d.status === 'issued' && d.type !== 'credit_note'
  const publicUrl = d.publicToken ? `${window.location.origin}/f/${d.publicToken}` : null
  const defaultTo = ((d.customerSnapshot?.emails as string[] | undefined) ?? [])[0]
  const busy = issue.isPending || markPaid.isPending || cancel.isPending

  const sendPanel = sending && (
    <RevealPanel>
      <h2 className="label-caps !font-sans">{t.sendTitle}</h2>
      <div className="space-y-2">
        <Label htmlFor="mailTo">{t.sendTo}</Label>
        <Input
          id="mailTo"
          type="email"
          value={mailTo}
          placeholder={defaultTo ?? ''}
          onChange={(e) => setMailTo(e.target.value)}
        />
        {!defaultTo && <p className="text-muted-foreground text-xs">{t.sendNoEmail}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="mailMsg">{t.sendMessage}</Label>
        <textarea
          id="mailMsg"
          rows={3}
          className="border-input bg-background w-full rounded-md border p-2 text-sm"
          value={mailMsg}
          onChange={(e) => setMailMsg(e.target.value)}
        />
      </div>
      <div className="flex gap-2">
        <Button
          disabled={send.isPending || !(mailTo || defaultTo)}
          onClick={() =>
            send.mutate({
              id,
              to: mailTo || undefined,
              message: mailMsg || undefined,
              reminder: d.displayStatus === 'overdue',
            })
          }
        >
          {t.sendConfirm}
        </Button>
        <Button variant="ghost" onClick={() => setSending(false)}>
          {cs.common.cancel}
        </Button>
      </div>
    </RevealPanel>
  )

  const payPanel = paying && (
    <RevealPanel>
      <h2 className="label-caps !font-sans">{t.hero.receipt}</h2>
      <div className="space-y-2">
        <Label htmlFor="amount">{t.markPaidPartial}</Label>
        <Input
          id="amount"
          inputMode="decimal"
          placeholder={d.remaining}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="paidOn">{t.markPaidDate}</Label>
        <DatePicker id="paidOn" value={paidOn} onChange={setPaidOn} />
      </div>
      <div className="flex gap-2">
        <Button
          disabled={markPaid.isPending}
          onClick={() =>
            markPaid.mutate({
              id,
              amount: amount ? amount.replace(',', '.') : null,
              paidOn: paidOn || undefined,
            })
          }
        >
          {t.markPaidConfirm}
        </Button>
        <Button variant="ghost" onClick={() => setPaying(false)}>
          {cs.common.cancel}
        </Button>
      </div>
    </RevealPanel>
  )

  return (
    <div className="mx-auto max-w-[1136px]">
      <Link
        to="/faktury"
        className="mb-3 inline-flex items-center gap-1 text-muted-foreground text-sm hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" aria-hidden /> {t.back}
      </Link>
      <PageHeader
        eyebrow={cs.invoices.type[d.type as keyof typeof cs.invoices.type]}
        title={d.number ?? cs.invoices.draftNumber}
        subtitle={
          <>
            {d.customerName ?? '—'}
            {d.issueDate ? ` · ${formatDateCs(d.issueDate)}` : ''}
          </>
        }
      />

      {/* One DOM, two layouts: the rail is `display: contents` on small screens so hero, QR, paper and
          timeline can be ordered freely; from `lg` it is the sticky right column. */}
      <div className="flex flex-col gap-4 pb-28 md:pb-8 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-x-8">
        <aside
          aria-label={t.hero.open}
          className="contents lg:sticky lg:top-[4.5rem] lg:col-start-2 lg:row-start-1 lg:-mx-1 lg:-mt-1 lg:flex lg:max-h-[calc(100dvh-5.5rem)] lg:flex-col lg:gap-4 lg:overflow-y-auto lg:px-1 lg:pt-1 lg:pb-6 lg:[scrollbar-width:thin] lg:[mask-image:linear-gradient(to_bottom,#000_calc(100%-24px),transparent)]"
        >
          <div className="order-1 flex flex-col gap-4">
            <DocHero d={d}>
              <div className="hidden md:block">
                <Actions part="primary" />
              </div>
              <div className="flex gap-2 [&>*]:min-w-fit [&>*]:flex-1">
                <Actions part="secondary" />
              </div>
            </DocHero>
            {sendPanel}
            {payPanel}
          </div>
          <div className="order-2 empty:hidden">
            <PaymentCard d={d} />
          </div>
          <div className="order-4 empty:hidden">
            <RelatedDocs d={d} />
          </div>
          <div className="order-4">
            <Timeline d={d} />
          </div>
          {publicUrl && (
            <div className="order-4">
              <PublicLinkCard
                url={publicUrl}
                rotating={rotateLink.isPending}
                onRotate={() => setDialog('rotate')}
              />
            </div>
          )}
        </aside>

        <DocumentPaper
          className="order-3 min-w-0 lg:col-start-1 lg:row-start-1"
          doc={sheet.doc}
          qr={sheet.qr}
          open={docOpen}
          onToggle={() => setDocOpen((v) => !v)}
        />
      </div>

      <PromptDialog
        open={dialog === 'cancel'}
        onOpenChange={(o) => !o && setDialog(null)}
        title={t.cancel}
        description={t.cancelConfirm}
        confirmLabel={t.cancel}
        destructive
        pending={cancel.isPending}
        onConfirm={() => {
          setDialog(null)
          cancel.mutate({ id })
        }}
      />
      <PromptDialog
        open={dialog === 'delete'}
        onOpenChange={(o) => !o && setDialog(null)}
        title={t.delete}
        description={t.deleteConfirm}
        confirmLabel={t.delete}
        destructive
        pending={remove.isPending}
        onConfirm={() => {
          setDialog(null)
          remove.mutate({ id })
        }}
      />
      <PromptDialog
        open={dialog === 'rotate'}
        onOpenChange={(o) => !o && setDialog(null)}
        title={t.rotateLink}
        description={t.rotateLinkConfirm}
        confirmLabel={t.rotateLink}
        pending={rotateLink.isPending}
        onConfirm={() => {
          setDialog(null)
          rotateLink.mutate({ id })
        }}
      />
      <PromptDialog
        open={dialog === 'template'}
        onOpenChange={(o) => !o && setDialog(null)}
        title={cs.templates.saveAs}
        confirmLabel={cs.common.save}
        pending={saveTemplate.isPending}
        input={{
          label: cs.templates.namePrompt,
          defaultValue: d.customerName ?? '',
          required: true,
        }}
        onConfirm={(name) => {
          setDialog(null)
          saveTemplate.mutate({ documentId: id, name })
        }}
      />
      <PromptDialog
        open={dialog === 'credit'}
        onOpenChange={(o) => !o && setDialog(null)}
        title={t.creditNote}
        confirmLabel={t.creditNote}
        pending={creditNote.isPending}
        input={{ label: t.creditNotePrompt }}
        onConfirm={(reason) => {
          setDialog(null)
          creditNote.mutate({ id, reason: reason || undefined })
        }}
      />
      <PromptDialog
        open={dialog === 'receipt'}
        onOpenChange={(o) => !o && setDialog(null)}
        title={t.receipt}
        description={t.receiptDescription(d.paidAmount, d.currency)}
        confirmLabel={t.receipt}
        pending={receipt.isPending}
        onConfirm={() => {
          setDialog(null)
          if (receiptRate === 'split') {
            const reduced = Number(rate12.replace(',', '.') || 0)
            const total = Number(d.paidAmount)
            receipt.mutate({
              id,
              allocations: [
                { vatRate: '21', amount: (total - reduced).toFixed(2) },
                { vatRate: '12', amount: reduced.toFixed(2) },
              ],
            })
          } else {
            receipt.mutate({ id, vatRate: receiptRate })
          }
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="receipt-rate">{t.receiptRate}</Label>
          <NativeSelect
            id="receipt-rate"
            value={receiptRate}
            onChange={(e) => setReceiptRate(e.target.value as '21' | '12' | 'split')}
          >
            <option value="21">21 %</option>
            <option value="12">12 %</option>
            <option value="split">{t.receiptSplit}</option>
          </NativeSelect>
        </div>
        {receiptRate === 'split' && (
          <div className="space-y-2">
            <Label htmlFor="receipt-12">{t.receiptAmount12}</Label>
            <Input
              id="receipt-12"
              inputMode="decimal"
              value={rate12}
              onChange={(e) => setRate12(e.target.value)}
            />
            <p className="text-muted-foreground text-xs">
              {t.receiptAmount21(
                (Number(d.paidAmount) - Number(rate12.replace(',', '.') || 0)).toFixed(2),
              )}
            </p>
          </div>
        )}
      </PromptDialog>

      {/* Phones: sits above the tab bar (h-16); only the primary action is pinned, the rest is in the hero.
          Hidden while the pay/send panel is open: its own confirm button is the action then. */}
      {!paying && !sending && (
        <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 flex flex-col gap-2 border-t bg-background/95 p-3 backdrop-blur md:hidden">
          <Actions mobile part="primary" />
        </div>
      )}
    </div>
  )

  function Actions({
    mobile,
    part = 'all',
  }: {
    mobile?: boolean
    part?: 'all' | 'primary' | 'secondary'
  }) {
    const big = cn('h-10 w-full text-sm', mobile && 'h-11 text-base')
    const isProforma = doc.type === 'proforma'
    const isDraft = doc.status === 'draft'
    const hasReceipt = doc.related.some(
      (r) => r.type === 'payment_receipt' && r.status !== 'cancelled',
    )
    const canReceipt =
      isProforma && doc.status === 'paid' && !!defaults.data?.vatPayer && !hasReceipt
    const canFinal =
      isProforma &&
      doc.status === 'paid' &&
      (!defaults.data?.vatPayer ||
        doc.related.some((r) => r.type === 'payment_receipt' && r.status === 'paid'))
    const canSend =
      open || doc.status === 'paid' || (doc.type === 'credit_note' && doc.status === 'issued')
    const canCredit = doc.type === 'invoice' && (open || doc.status === 'paid')
    const canMarkUnpaid =
      doc.status === 'paid' && !(doc.type === 'invoice' && Number(doc.total) <= 0)

    // One primary action per status; the PDF is the primary only when nothing else is left to do.
    const primary: 'issue' | 'pay' | 'receipt' | 'final' | 'pdf' = isDraft
      ? 'issue'
      : open
        ? 'pay'
        : canReceipt
          ? 'receipt'
          : canFinal
            ? 'final'
            : 'pdf'

    const pdfButton = (variant: 'default' | 'outline') => (
      <Button
        variant={variant}
        className={variant === 'default' ? big : ''}
        nativeButton={false}
        render={<a href={`/api/documents/${id}/pdf`} download />}
      >
        <Download />
        {variant === 'default' ? (
          t.downloadPdf
        ) : (
          <>
            <span className="sr-only">{t.downloadPdfVerb} </span>
            <span>PDF</span>
          </>
        )}
      </Button>
    )

    const primaryButton = (() => {
      switch (primary) {
        case 'issue':
          return (
            <Button className={big} disabled={busy} onClick={() => issue.mutate({ id })}>
              {t.issue}
            </Button>
          )
        case 'pay':
          return (
            <Button className={big} onClick={() => setPaying(true)}>
              {t.markPaid}
            </Button>
          )
        case 'receipt':
          return (
            <Button
              className={big}
              disabled={receipt.isPending}
              onClick={() => setDialog('receipt')}
            >
              {t.receipt}
            </Button>
          )
        case 'final':
          return (
            <Button
              className={big}
              disabled={finalInvoice.isPending}
              onClick={() => finalInvoice.mutate({ id })}
            >
              {t.finalInvoice}
            </Button>
          )
        default:
          return pdfButton('default')
      }
    })()

    const secondary = (
      <>
        {isDraft && (
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link to="/faktury/$id/upravit" params={{ id }} />}
          >
            <Pencil /> {t.edit}
          </Button>
        )}
        {!isDraft && canSend && (
          <Button
            variant="outline"
            aria-label={doc.displayStatus === 'overdue' ? t.remind : t.send}
            onClick={() => setSending(true)}
          >
            <Send />
            <span>{doc.displayStatus === 'overdue' ? t.remindShort : t.sendShort}</span>
          </Button>
        )}
        {!isDraft && primary !== 'pdf' && pdfButton('outline')}
        <DropdownMenu>
          <DropdownMenuTrigger
            className={buttonVariants({ variant: 'outline', className: 'px-2' })}
          >
            {t.more}
            <ChevronDown aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="bottom" align="end">
            {isDraft ? (
              <DropdownMenuItem onClick={() => setDialog('delete')}>
                <Trash2 aria-hidden /> {t.delete}
              </DropdownMenuItem>
            ) : (
              <>
                {canMarkUnpaid && (
                  <DropdownMenuItem onClick={() => markUnpaid.mutate({ id })}>
                    <Undo2 aria-hidden /> {t.markUnpaid}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => duplicate.mutate({ id })}>
                  <CopyPlus aria-hidden /> {t.duplicate}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setDialog('template')}>
                  <BookmarkPlus aria-hidden /> {cs.templates.saveAs}
                </DropdownMenuItem>
                {canCredit && (
                  <DropdownMenuItem onClick={() => setDialog('credit')}>
                    <FileMinus aria-hidden /> {t.creditNote}
                  </DropdownMenuItem>
                )}
                {primary !== 'receipt' && canReceipt && (
                  <DropdownMenuItem onClick={() => setDialog('receipt')}>
                    <Receipt aria-hidden /> {t.receipt}
                  </DropdownMenuItem>
                )}
                {primary !== 'final' && canFinal && (
                  <DropdownMenuItem onClick={() => finalInvoice.mutate({ id })}>
                    <FileCheck aria-hidden /> {t.finalInvoice}
                  </DropdownMenuItem>
                )}
                {doc.status !== 'cancelled' && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive [&_svg]:text-destructive"
                      disabled={busy}
                      onClick={() => setDialog('cancel')}
                    >
                      <Ban aria-hidden /> {t.cancel}
                    </DropdownMenuItem>
                  </>
                )}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </>
    )

    return (
      <>
        {part !== 'primary' && secondary}
        {part !== 'secondary' && primaryButton}
      </>
    )
  }
}

/** Inline panel that scrolls into view when it opens (it can render below the fold on small screens). */
function RevealPanel({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [])
  return (
    <section ref={ref} className="sheet space-y-3 p-5">
      {children}
    </section>
  )
}
