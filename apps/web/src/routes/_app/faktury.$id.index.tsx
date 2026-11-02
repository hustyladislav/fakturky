import { formatDateCs, todayPrague } from '@fakturky/domain/dates'
import { Button, buttonVariants } from '@fakturky/ui/components/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@fakturky/ui/components/dropdown-menu'
import { Input } from '@fakturky/ui/components/input'
import { Label } from '@fakturky/ui/components/label'
import { Money } from '@fakturky/ui/components/money'
import { NativeSelect } from '@fakturky/ui/components/native-select'
import { Skeleton } from '@fakturky/ui/components/skeleton'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import {
  Ban,
  BookmarkPlus,
  Check,
  ChevronDown,
  Copy,
  CopyPlus,
  Download,
  ExternalLink,
  FileCheck,
  FileMinus,
  Pencil,
  Receipt,
  RefreshCw,
  Send,
  Trash2,
  Undo2,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ErrorState } from '@/components/error-state'
import { InvoiceStatus } from '@/components/invoice-status'
import { PaymentQr } from '@/components/payment-qr'
import { PromptDialog } from '@/components/prompt-dialog'
import { cs } from '@/i18n/cs'
import { apiErrorMessage } from '@/lib/errors'
import { pageHead } from '@/lib/head'
import { orpc } from '@/lib/orpc'

export const Route = createFileRoute('/_app/faktury/$id/')({
  head: pageHead(cs.invoices.title),
  component: InvoiceDetail,
})

const t = cs.invoices.detail

function Field({
  label,
  children,
  wide,
}: {
  label: string
  children: React.ReactNode
  wide?: boolean
}) {
  return (
    <div className={wide ? 'col-span-2 break-all' : undefined}>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  )
}

function Party({ title, p }: { title: string; p: Record<string, unknown> | null }) {
  if (!p) return null
  const a = (p.address ?? {}) as Record<string, string | undefined>
  return (
    <div className="space-y-0.5 text-sm">
      <div className="text-muted-foreground text-xs">{title}</div>
      <div className="font-medium">{String(p.name ?? '')}</div>
      {a.street && <div>{a.street}</div>}
      {(a.zip || a.city) && (
        <div>
          {a.zip} {a.city}
        </div>
      )}
      {p.ico ? <div>IČO {String(p.ico)}</div> : null}
      {p.dic ? <div>DIČ {String(p.dic)}</div> : null}
    </div>
  )
}

function InvoiceDetail() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const q = useQuery(orpc.documents.get.queryOptions({ input: { id } }))
  const [paying, setPaying] = useState(false)
  const [dialog, setDialog] = useState<
    'cancel' | 'delete' | 'rotate' | 'template' | 'credit' | 'receipt' | null
  >(null)
  const [rate12, setRate12] = useState('')
  const [receiptRate, setReceiptRate] = useState<'21' | '12' | 'split'>('21')
  const [amount, setAmount] = useState('')
  const [paidOn, setPaidOn] = useState('')

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
  if (q.isError) {
    // A missing invoice is final; anything else (offline, 5xx) is worth another try.
    const code = (q.error as { code?: string } | null)?.code
    if (code === 'NOT_FOUND' || code === 'BAD_REQUEST') {
      return <p className="text-muted-foreground">{t.notFound}</p>
    }
    return <ErrorState onRetry={() => q.refetch()} />
  }
  if (!d) {
    return (
      <div className="mx-auto max-w-3xl space-y-4" aria-busy="true">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-[520px] rounded-xl" />
      </div>
    )
  }

  const doc = d
  const isDraft = d.status === 'draft'
  const open = d.status === 'issued' && d.type !== 'credit_note'
  const bank = d.bankSnapshot as Record<string, string | null> | null
  const publicUrl = d.publicToken ? `${window.location.origin}/f/${d.publicToken}` : null
  const defaultTo = ((d.customerSnapshot?.emails as string[] | undefined) ?? [])[0]
  const busy = issue.isPending || markPaid.isPending || cancel.isPending

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-28 sm:pb-6">
      <Link to="/faktury" className="text-muted-foreground text-sm hover:underline">
        ← {t.back}
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tabular-nums">
            {d.number ?? cs.invoices.draftNumber}
          </h1>
          {d.type !== 'invoice' && (
            <span className="text-muted-foreground text-sm">
              {cs.invoices.type[d.type as keyof typeof cs.invoices.type]}
            </span>
          )}
          <InvoiceStatus status={d.displayStatus} viaAssistant={d.viaAssistant} />
          {d.importedFrom && (
            <span className="rounded-full border px-2 py-0.5 text-muted-foreground text-xs">
              {cs.import.imported}
            </span>
          )}
        </div>
        <div className="hidden flex-wrap gap-2 sm:flex">
          <Actions />
        </div>
      </div>
      {(() => {
        const bankPayments = d.payments.filter((p) => p.source === 'bank')
        const last = bankPayments[bankPayments.length - 1]
        if (!last) return null
        const date = formatDateCs(last.paidOn)
        return (
          <p className="text-muted-foreground text-sm" data-testid="paid-by-transfer">
            {d.status === 'paid' ? t.paidByTransfer(date) : t.partlyPaidByTransfer(date)}
          </p>
        )
      })()}
      <div className="flex flex-wrap gap-2 sm:hidden">
        <Actions part="secondary" />
      </div>

      <section className="space-y-5 rounded-xl border p-4 sm:p-6">
        <div className="grid gap-5 sm:grid-cols-2">
          <Party title={t.supplier} p={d.supplierSnapshot} />
          <Party title={t.customer} p={d.customerSnapshot ?? { name: d.customerName }} />
        </div>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label={t.issueDate}>{d.issueDate ? formatDateCs(d.issueDate) : '—'}</Field>
          <Field label={t.dueDate}>{d.dueDate ? formatDateCs(d.dueDate) : '—'}</Field>
          {d.vatMode !== 'none' && (
            <Field label={t.taxableDate}>{d.taxableDate ? formatDateCs(d.taxableDate) : '—'}</Field>
          )}
          {!d.paymentQr && d.variableSymbol && (
            <Field label={t.variableSymbol}>{d.variableSymbol}</Field>
          )}
          {!d.paymentQr && bank?.iban && (
            <Field wide label={t.iban}>
              {bank.iban}
            </Field>
          )}
          {!d.paymentQr && bank?.accountNumber && (
            <Field wide label={t.account}>
              {bank.accountNumber}/{bank.bankCode}
            </Field>
          )}
        </dl>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-sm">
            <thead className="text-muted-foreground text-left text-xs">
              <tr className="border-b">
                <th className="py-2 font-medium">{cs.invoices.form.description}</th>
                <th className="py-2 text-right font-medium">{cs.invoices.form.quantity}</th>
                <th className="py-2 text-right font-medium">{cs.invoices.form.unitPrice}</th>
                {d.vatMode !== 'none' && (
                  <th className="py-2 text-right font-medium">{cs.invoices.form.vatRate}</th>
                )}
                <th className="py-2 text-right font-medium">
                  {d.vatMode !== 'none'
                    ? cs.invoices.form.lineTotalNet
                    : cs.invoices.form.lineTotal}
                </th>
              </tr>
            </thead>
            <tbody>
              {d.lines.map((l) => (
                <tr key={l.id} className="border-b">
                  <td className="py-2">{l.description}</td>
                  <td className="py-2 text-right tabular-nums">
                    {Number(l.quantity)} {l.unit}
                  </td>
                  <td className="py-2 text-right">
                    <Money amount={l.unitPrice} currency={d.currency} />
                  </td>
                  {d.vatMode !== 'none' && (
                    <td className="py-2 text-right tabular-nums">
                      {l.vatTreatment === 'standard'
                        ? `${Number(l.vatRate)} %`
                        : (cs.invoices.vatTreatment[
                            l.vatTreatment as keyof typeof cs.invoices.vatTreatment
                          ] ?? l.vatTreatment)}
                    </td>
                  )}
                  <td className="py-2 text-right">
                    <Money amount={l.lineSubtotal} currency={d.currency} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="ml-auto max-w-xs space-y-1 text-sm">
          {d.vatMode !== 'none' &&
            d.vatRecap.map((r) => (
              <div
                key={`${r.vatTreatment}-${r.vatRate}`}
                className="text-muted-foreground flex justify-between"
              >
                <span>
                  {cs.invoices.form.vat}{' '}
                  {r.vatTreatment === 'standard'
                    ? `${Number(r.vatRate)} %`
                    : (cs.invoices.vatTreatment[
                        r.vatTreatment as keyof typeof cs.invoices.vatTreatment
                      ] ?? r.vatTreatment)}
                </span>
                <Money amount={r.vat} currency={d.currency} />
              </div>
            ))}
          {Number(d.rounding) !== 0 && (
            <div className="text-muted-foreground flex justify-between">
              <span>{cs.invoices.form.rounding}</span>
              <Money amount={d.rounding} currency={d.currency} />
            </div>
          )}
          <div className="flex items-baseline justify-between border-t pt-2 text-lg font-semibold">
            <span>{cs.invoices.form.total}</span>
            <Money amount={d.total} currency={d.currency} />
          </div>
          {Number(d.paidAmount) > 0 && (
            <>
              <div className="text-muted-foreground flex justify-between">
                <span>{t.paidSoFar}</span>
                <Money amount={d.paidAmount} currency={d.currency} />
              </div>
              {d.payments
                .filter((p) => p.method === 'credit_note')
                .map((p) => (
                  <div key={p.id} className="text-muted-foreground flex justify-between">
                    <span>{t.creditedBy(p.note ?? '')}</span>
                    <Money amount={p.amount} currency={d.currency} />
                  </div>
                ))}
              {open && (
                <div className="flex justify-between font-medium">
                  <span>{t.remaining}</span>
                  <Money amount={d.remaining} currency={d.currency} />
                </div>
              )}
            </>
          )}
        </div>

        {d.introText && <p className="text-sm whitespace-pre-line">{d.introText}</p>}
        {d.footerText && (
          <p className="text-muted-foreground text-sm whitespace-pre-line">{d.footerText}</p>
        )}
      </section>

      {d.paymentQr && (
        <section
          className="flex flex-col items-center gap-5 rounded-xl border p-4 sm:flex-row sm:items-start sm:gap-8 sm:p-6"
          aria-labelledby="payment-card-title"
          data-testid="payment-card"
        >
          <div className="w-full min-w-0 flex-1 space-y-3">
            <h2 id="payment-card-title" className="font-semibold">
              {t.payment}
            </h2>
            <dl className="grid grid-cols-2 gap-4">
              <Field label={t.amountDue}>
                <span className="font-medium">
                  <Money amount={d.remaining} currency={d.currency} />
                </span>
              </Field>
              {d.variableSymbol && <Field label={t.variableSymbol}>{d.variableSymbol}</Field>}
              {bank?.accountNumber && (
                <Field wide label={t.account}>
                  {bank.accountNumber}/{bank.bankCode}
                </Field>
              )}
              {bank?.iban && (
                <Field wide label={t.iban}>
                  {bank.iban}
                </Field>
              )}
            </dl>
          </div>
          <figure className="shrink-0 space-y-1.5 text-center">
            <PaymentQr qr={d.paymentQr} className="mx-auto" />
            <figcaption className="text-xs">
              <div className="font-medium">
                {d.paymentQr.kind === 'spayd' ? cs.paymentQr.platba : cs.paymentQr.epc}
              </div>
              <div className="text-muted-foreground">{cs.paymentQr.hint}</div>
            </figcaption>
          </figure>
        </section>
      )}

      {(d.parent || d.related.length > 0) && (
        <section className="space-y-2 rounded-xl border p-4 text-sm" aria-label={t.relatedTitle}>
          <h2 className="font-semibold">{t.relatedTitle}</h2>
          <ul className="space-y-1">
            {d.parent && (
              <li>
                <span className="text-muted-foreground">{t.relatedParent}: </span>
                <Link
                  to="/faktury/$id"
                  params={{ id: d.parent.id }}
                  className="underline underline-offset-2"
                >
                  {d.parent.number ?? cs.invoices.draftNumber}
                </Link>{' '}
                <span className="text-muted-foreground">
                  ({cs.invoices.type[d.parent.type as keyof typeof cs.invoices.type]})
                </span>
              </li>
            )}
            {d.related.map((r) => (
              <li key={r.id}>
                <span className="text-muted-foreground">
                  {cs.invoices.type[r.type as keyof typeof cs.invoices.type]}:{' '}
                </span>
                <Link
                  to="/faktury/$id"
                  params={{ id: r.id }}
                  className="underline underline-offset-2"
                >
                  {r.number ?? cs.invoices.draftNumber}
                </Link>
                {r.status === 'cancelled' && (
                  <span className="text-muted-foreground"> ({cs.invoices.status.cancelled})</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {sending && (
        <RevealPanel>
          <h2 className="font-semibold">{t.sendTitle}</h2>
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
      )}

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

      {paying && (
        <RevealPanel>
          <div className="grid gap-3 sm:grid-cols-2">
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
              <Input
                id="paidOn"
                type="date"
                value={paidOn}
                onChange={(e) => setPaidOn(e.target.value)}
              />
            </div>
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
      )}

      {publicUrl && (
        <section className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-sm">
          <span className="text-muted-foreground">{t.publicLink}</span>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await navigator.clipboard.writeText(publicUrl)
                toast.success(t.linkCopied)
              }}
            >
              <Copy /> {t.copyLink}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={rotateLink.isPending}
              onClick={() => setDialog('rotate')}
            >
              <RefreshCw /> {t.rotateLink}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              nativeButton={false}
              render={
                <a href={publicUrl} target="_blank" rel="noreferrer" aria-label={t.publicLink} />
              }
            >
              <ExternalLink />
            </Button>
          </div>
        </section>
      )}

      <section className="space-y-2 rounded-xl border p-4">
        <h2 className="text-sm font-semibold">{t.history}</h2>
        <ol className="space-y-1.5">
          {d.activity.map((a) => (
            <li key={a.id} className="flex items-center gap-2 text-sm">
              <Check className="text-muted-foreground size-3.5" />
              <span>{t.timeline[a.action as keyof typeof t.timeline] ?? a.action}</span>
              <span className="text-muted-foreground">
                {formatDateCs(todayPrague(a.createdAt))}
                {(a.data as { amount?: string } | null)?.amount ? (
                  <>
                    {' · '}
                    <Money amount={(a.data as { amount: string }).amount} currency={d.currency} />
                    {' · '}
                    {t.manual}
                  </>
                ) : null}
              </span>
            </li>
          ))}
        </ol>
      </section>

      {/* Sits above the mobile tab bar (h-16); only the primary action is pinned, the rest is in flow.
          Hidden while the pay/send panel is open: its own confirm button is the action then. */}
      {!paying && !sending && (
        <div className="from-background fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 flex flex-col gap-2 bg-gradient-to-t p-4 sm:hidden">
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
    const full = mobile ? 'w-full' : ''
    const isProforma = doc.type === 'proforma'
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
        className={full}
        nativeButton={false}
        render={<a href={`/api/documents/${id}/pdf`} download />}
      >
        <Download /> {t.downloadPdf}
      </Button>
    )

    const primaryButton = (() => {
      switch (primary) {
        case 'issue':
          return (
            <Button className={full} disabled={busy} onClick={() => issue.mutate({ id })}>
              {t.issue}
            </Button>
          )
        case 'pay':
          return (
            <Button className={full} onClick={() => setPaying(true)}>
              {t.markPaid}
            </Button>
          )
        case 'receipt':
          return (
            <Button
              className={full}
              disabled={receipt.isPending}
              onClick={() => setDialog('receipt')}
            >
              {t.receipt}
            </Button>
          )
        case 'final':
          return (
            <Button
              className={full}
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
            className={full}
            nativeButton={false}
            render={<Link to="/faktury/$id/upravit" params={{ id }} />}
          >
            <Pencil /> {t.edit}
          </Button>
        )}
        {!isDraft && canSend && (
          <Button variant="outline" className={full} onClick={() => setSending(true)}>
            <Send /> {doc.displayStatus === 'overdue' ? t.remind : t.send}
          </Button>
        )}
        {!isDraft && primary !== 'pdf' && pdfButton('outline')}
        <DropdownMenu>
          <DropdownMenuTrigger className={buttonVariants({ variant: 'outline', className: full })}>
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

/** Inline panel that scrolls into view when it opens (it renders below the fold on long documents). */
function RevealPanel({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    ref.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [])
  return (
    <section ref={ref} className="space-y-3 rounded-xl border bg-card p-4">
      {children}
    </section>
  )
}
