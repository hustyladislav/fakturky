import { formatDateCs, todayPrague } from '@fakturky/domain/dates'
import { Button } from '@fakturky/ui/components/button'
import { Input } from '@fakturky/ui/components/input'
import { Label } from '@fakturky/ui/components/label'
import { Money } from '@fakturky/ui/components/money'
import { Skeleton } from '@fakturky/ui/components/skeleton'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Check, Copy, Download, ExternalLink, Pencil, RefreshCw, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { InvoiceStatus } from '@/components/invoice-status'
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
  if (q.isError) return <p className="text-muted-foreground">{t.notFound}</p>
  if (!d) {
    return (
      <div className="mx-auto max-w-3xl space-y-4" aria-busy="true">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-[520px] rounded-xl" />
      </div>
    )
  }

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
        </div>
        <div className="hidden flex-wrap gap-2 sm:flex">
          <Actions />
        </div>
      </div>
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
          {d.variableSymbol && <Field label={t.variableSymbol}>{d.variableSymbol}</Field>}
          {bank?.iban && (
            <Field wide label={t.iban}>
              {bank.iban}
            </Field>
          )}
          {bank?.accountNumber && (
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

      {sending && (
        <section className="space-y-3 rounded-xl border p-4">
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
        </section>
      )}

      {paying && (
        <section className="space-y-3 rounded-xl border p-4">
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
        </section>
      )}

      {publicUrl && (
        <section className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-sm">
          <span className="text-muted-foreground">{t.publicLink}</span>
          <div className="flex gap-2">
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
              onClick={() => window.confirm(t.rotateLinkConfirm) && rotateLink.mutate({ id })}
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

      {/* Sits above the mobile tab bar (h-16); only the primary action is pinned, the rest is in flow. */}
      <div className="from-background fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 flex flex-col gap-2 bg-gradient-to-t p-4 sm:hidden">
        <Actions mobile part="primary" />
      </div>
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
    const showSecondary = part !== 'primary'
    const showPrimary = part !== 'secondary'
    if (isDraft) {
      return (
        <>
          {showSecondary && (
            <>
              <Button
                variant="outline"
                className={full}
                nativeButton={false}
                render={<Link to="/faktury/$id/upravit" params={{ id }} />}
              >
                <Pencil /> {t.edit}
              </Button>
              <Button
                variant="ghost"
                className={full}
                onClick={() => window.confirm(t.deleteConfirm) && remove.mutate({ id })}
              >
                <Trash2 /> {t.delete}
              </Button>
            </>
          )}
          {showPrimary && (
            <Button className={full} disabled={busy} onClick={() => issue.mutate({ id })}>
              {t.issue}
            </Button>
          )}
        </>
      )
    }
    return (
      <>
        {showSecondary && (
          <>
            {!isDraft && (
              <Button
                variant="outline"
                className={full}
                nativeButton={false}
                render={<a href={`/api/documents/${id}/pdf`} download />}
              >
                <Download /> {t.downloadPdf}
              </Button>
            )}
            {d?.status === 'cancelled' ? null : (
              <Button
                variant="ghost"
                className={full}
                disabled={busy}
                onClick={() => window.confirm(t.cancelConfirm) && cancel.mutate({ id })}
              >
                {t.cancel}
              </Button>
            )}
            <Button
              variant="outline"
              className={full}
              onClick={() => {
                const name = window.prompt(cs.templates.namePrompt, d?.customerName ?? '')
                if (name?.trim()) saveTemplate.mutate({ documentId: id, name: name.trim() })
              }}
            >
              {cs.templates.saveAs}
            </Button>
            {d?.type === 'proforma' &&
              d.status === 'paid' &&
              defaults.data?.vatPayer &&
              !d.related.some((r) => r.type === 'payment_receipt' && r.status !== 'cancelled') && (
                <Button
                  className={full}
                  disabled={receipt.isPending}
                  onClick={() => {
                    const rate = window.prompt(t.receiptRatePrompt, '21')
                    if (rate === '21' || rate === '12') receipt.mutate({ id, vatRate: rate })
                  }}
                >
                  {t.receipt}
                </Button>
              )}
            {d?.type === 'proforma' &&
              d.status === 'paid' &&
              (!defaults.data?.vatPayer ||
                d.related.some((r) => r.type === 'payment_receipt' && r.status === 'paid')) && (
                <Button
                  className={full}
                  disabled={finalInvoice.isPending}
                  onClick={() => finalInvoice.mutate({ id })}
                >
                  {t.finalInvoice}
                </Button>
              )}
            {d?.type === 'invoice' && (open || d.status === 'paid') && (
              <Button
                variant="outline"
                className={full}
                onClick={() => {
                  const reason = window.prompt(t.creditNotePrompt, '')
                  if (reason !== null) creditNote.mutate({ id, reason: reason.trim() || undefined })
                }}
              >
                {t.creditNote}
              </Button>
            )}
            <Button variant="outline" className={full} onClick={() => duplicate.mutate({ id })}>
              {t.duplicate}
            </Button>
            {d?.status === 'paid' && !(d.type === 'invoice' && Number(d.total) <= 0) && (
              <Button variant="outline" className={full} onClick={() => markUnpaid.mutate({ id })}>
                {t.markUnpaid}
              </Button>
            )}
            {(open ||
              d?.status === 'paid' ||
              (d?.type === 'credit_note' && d.status === 'issued')) && (
              <Button variant="outline" className={full} onClick={() => setSending(true)}>
                {d?.displayStatus === 'overdue' ? t.remind : t.send}
              </Button>
            )}
          </>
        )}
        {showPrimary && open && (
          <Button className={full} onClick={() => setPaying(true)}>
            {t.markPaid}
          </Button>
        )}
      </>
    )
  }
}
