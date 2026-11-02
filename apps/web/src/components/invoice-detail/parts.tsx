import { formatDateCs, todayPrague } from '@fakturky/domain/dates'
import { InvoiceSheet, type InvoiceSheetDraft, type QrData } from '@fakturky/pdf/html'
import { Amount } from '@fakturky/ui/components/amount'
import { Button } from '@fakturky/ui/components/button'
import { SectionLabel } from '@fakturky/ui/components/page-header'
import { RelativeDate } from '@fakturky/ui/components/relative-date'
import { diffDays, parseIsoDate } from '@fakturky/ui/lib/dates'
import { formatMoney } from '@fakturky/ui/lib/money'
import { cn } from '@fakturky/ui/lib/utils'
import { Link } from '@tanstack/react-router'
import {
  Ban,
  Bell,
  Check,
  ChevronDown,
  CircleDashed,
  Copy,
  ExternalLink,
  Eye,
  FileCheck,
  FileMinus,
  FilePen,
  FilePlus,
  FileText,
  Landmark,
  Link2,
  RefreshCw,
  Send,
  Trash2,
  Undo2,
  Wallet,
} from 'lucide-react'
import type { ComponentType, ReactNode } from 'react'
import { toast } from 'sonner'
import { InvoiceStatus } from '@/components/invoice-status'
import { PaymentQr } from '@/components/payment-qr'
import { cs } from '@/i18n/cs'
import type { DocumentDetail } from '@/lib/document-sheet'

const t = cs.invoices.detail

type Snap = Record<string, string | null> | null

/** Days past the due date (0 when not overdue). */
function overdueDaysOf(d: DocumentDetail): number {
  if (d.displayStatus !== 'overdue' || !d.dueDate) return 0
  const due = parseIsoDate(d.dueDate)
  const today = parseIsoDate(todayPrague())
  return due && today ? Math.max(0, diffDays(today, due)) : 0
}

// --------------------------------------------------------------------------------------------------------
// Hero: status, the amount that matters, the due date
// --------------------------------------------------------------------------------------------------------

export function DocHero({ d, children }: { d: DocumentDetail; children?: ReactNode }) {
  const isDraft = d.status === 'draft'
  const open = d.status === 'issued' && d.type !== 'credit_note'
  const overdueDays = overdueDaysOf(d)
  const paidPart = Number(d.paidAmount)
  const totalNum = Number(d.total)
  const bankPayments = d.payments.filter((p) => p.source === 'bank')
  const lastBank = bankPayments[bankPayments.length - 1]

  const mode: 'draft' | 'open' | 'paid' | 'cancelled' | 'creditNote' | 'receipt' = isDraft
    ? 'draft'
    : d.status === 'cancelled'
      ? 'cancelled'
      : d.type === 'credit_note'
        ? 'creditNote'
        : d.type === 'payment_receipt'
          ? 'receipt'
          : open
            ? 'open'
            : 'paid'
  const value = mode === 'open' ? d.remaining : d.total
  const showProgress = mode === 'open' && paidPart > 0 && totalNum > 0

  return (
    <section className="sheet p-5" aria-label={t.hero[mode]} data-testid="doc-hero">
      <div className="flex items-center justify-between gap-3">
        <InvoiceStatus
          status={d.displayStatus}
          viaAssistant={d.viaAssistant}
          {...(overdueDays ? { overdueDays } : {})}
        />
        {d.importedFrom && (
          <span className="label-caps rounded-md border px-1.5 py-0.5">{cs.import.imported}</span>
        )}
      </div>

      <div className="mt-5">
        <div className="label-caps">{t.hero[mode]}</div>
        <div className="mt-1.5">
          <Amount
            size="hero"
            value={value}
            currency={d.currency}
            animate
            tone={
              d.displayStatus === 'overdue'
                ? 'overdue'
                : mode === 'cancelled' || mode === 'creditNote'
                  ? 'muted'
                  : mode === 'paid'
                    ? 'success'
                    : 'default'
            }
            className="text-[40px]"
          />
        </div>
      </div>

      {showProgress && (
        <div className="mt-3">
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.min(100, Math.round((paidPart / totalNum) * 100))}
            aria-label={t.hero.paidOfTotal(
              formatMoney(d.paidAmount, d.currency),
              formatMoney(d.total, d.currency),
            )}
            className="h-1.5 overflow-hidden rounded-full bg-muted"
          >
            <div
              className="h-full rounded-full bg-success"
              style={{ width: `${Math.min(100, (paidPart / totalNum) * 100)}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground tabular-nums">
            {t.hero.paidOfTotal(
              formatMoney(d.paidAmount, d.currency),
              formatMoney(d.total, d.currency),
            )}
          </p>
        </div>
      )}

      <dl className="mt-4 space-y-1.5 text-sm">
        {mode === 'draft' && <p className="text-muted-foreground">{t.hero.draftHint}</p>}
        {mode === 'open' && d.dueDate && (
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted-foreground">{t.hero.dueOn}</dt>
            <dd className="text-right">
              <RelativeDate date={d.dueDate} tone="due" />
              <span className="text-muted-foreground">
                {' · '}
                {formatDateCs(d.dueDate)}
              </span>
            </dd>
          </div>
        )}
        {mode === 'paid' && d.paidAt && (
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted-foreground">{t.hero.paid}</dt>
            <dd>{formatDateCs(todayPrague(d.paidAt))}</dd>
          </div>
        )}
        {mode === 'creditNote' && d.parent && (
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted-foreground">{t.hero.correctsDocument}</dt>
            <dd>
              <Link
                to="/faktury/$id"
                params={{ id: d.parent.id }}
                className="underline underline-offset-2"
              >
                {d.parent.number ?? cs.invoices.draftNumber}
              </Link>
            </dd>
          </div>
        )}
        {d.payments
          .filter((p) => p.method === 'credit_note')
          .map((p) => (
            <div key={p.id} className="flex items-baseline justify-between gap-3">
              <dt className="text-muted-foreground">{t.creditedBy(p.note ?? '')}</dt>
              <dd>
                <Amount value={p.amount} currency={d.currency} size="sm" />
              </dd>
            </div>
          ))}
        {lastBank && (
          <p className="text-muted-foreground" data-testid="paid-by-transfer">
            {d.status === 'paid'
              ? t.paidByTransfer(formatDateCs(lastBank.paidOn))
              : t.partlyPaidByTransfer(formatDateCs(lastBank.paidOn))}
          </p>
        )}
      </dl>

      {children && <div className="mt-5 space-y-2 hairline pt-5">{children}</div>}
    </section>
  )
}

// --------------------------------------------------------------------------------------------------------
// Payment: QR + the numbers a bank form asks for
// --------------------------------------------------------------------------------------------------------

function CopyRow({ label, value, shown }: { label: string; value: string; shown?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <dt className="label-caps shrink-0">{label}</dt>
      <dd className="flex min-w-0 items-center gap-1">
        <span className="min-w-0 truncate text-sm tabular-nums" title={shown ?? value}>
          {shown ?? value}
        </span>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={`${t.copy}: ${label}`}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value)
              toast.success(t.copied)
            } catch {
              /* clipboard blocked: nothing to do */
            }
          }}
        >
          <Copy />
        </Button>
      </dd>
    </div>
  )
}

export function PaymentCard({ d }: { d: DocumentDetail }) {
  const bank = d.bankSnapshot as Snap
  const open = d.status === 'issued' && d.type !== 'credit_note'
  if (!d.paymentQr && !(open && bank?.iban)) return null
  const account = bank?.accountNumber ? `${bank.accountNumber}/${bank.bankCode}` : null
  return (
    <section className="sheet p-5" aria-labelledby="payment-card-title" data-testid="payment-card">
      <SectionLabel>
        <span id="payment-card-title">{t.payment}</span>
      </SectionLabel>
      {d.paymentQr && (
        <div className="mt-4 flex items-center gap-4">
          <PaymentQr qr={d.paymentQr} className="size-40 sm:size-40 ring-1 ring-border" />
          <figure className="min-w-0 space-y-1 text-sm">
            <figcaption className="font-medium">
              {d.paymentQr.kind === 'spayd' ? cs.paymentQr.platba : cs.paymentQr.epc}
            </figcaption>
            <p className="text-xs text-muted-foreground">{cs.paymentQr.hint}</p>
            <p className="pt-1">
              <Amount value={d.remaining} currency={d.currency} size="inline" />
            </p>
          </figure>
        </div>
      )}
      <dl className={cn('divide-y divide-border', d.paymentQr && 'mt-3')}>
        {account && <CopyRow label={t.account} value={account} />}
        {bank?.iban && <CopyRow label={t.iban} value={bank.iban} />}
        {d.variableSymbol && <CopyRow label={t.variableSymbol} value={d.variableSymbol} />}
      </dl>
    </section>
  )
}

// --------------------------------------------------------------------------------------------------------
// Timeline
// --------------------------------------------------------------------------------------------------------

const STEP_ICON: Record<string, ComponentType<{ className?: string }>> = {
  created: FilePlus,
  updated: FilePen,
  issued: FileText,
  sent: Send,
  reminded: Bell,
  viewed: Eye,
  paid: Check,
  partially_paid: Wallet,
  unpaid: Undo2,
  bank_matched: Landmark,
  bank_unmatched: Landmark,
  cancelled: Ban,
  deleted: Trash2,
  link_rotated: Link2,
  credit_note_created: FileMinus,
  final_invoice_created: FileCheck,
}

const TIME = new Intl.DateTimeFormat('cs-CZ', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Prague',
})

export function Timeline({ d }: { d: DocumentDetail }) {
  const open = d.status === 'issued' && d.type !== 'credit_note'
  return (
    <section className="sheet p-5" aria-labelledby="timeline-title">
      <SectionLabel>
        <span id="timeline-title">{t.history}</span>
      </SectionLabel>
      <ol className="mt-4">
        {d.activity.map((a, i) => {
          const data = (a.data ?? {}) as { amount?: string; to?: string; auto?: boolean }
          const Icon = STEP_ICON[a.action] ?? Check
          const settled = a.action === 'paid' || a.action === 'bank_matched'
          const last = i === d.activity.length - 1 && !(open && d.dueDate)
          return (
            <li key={a.id} className="relative flex gap-3 pb-4 last:pb-0">
              {!last && (
                <span aria-hidden className="absolute top-6 bottom-0 left-[11px] w-px bg-border" />
              )}
              <span
                aria-hidden
                className={cn(
                  'relative grid size-6 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground',
                  settled && 'bg-success/14 text-success',
                  a.action === 'cancelled' && 'bg-destructive/10 text-destructive',
                )}
              >
                <Icon className="size-3.5" />
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="text-sm font-medium">
                    {t.timeline[a.action as keyof typeof t.timeline] ?? a.action}
                  </span>
                  <time
                    dateTime={a.createdAt.toISOString()}
                    className="text-xs text-muted-foreground tabular-nums"
                  >
                    {formatDateCs(todayPrague(a.createdAt))} · {TIME.format(a.createdAt)}
                  </time>
                </div>
                {data.amount && (
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                    <Amount value={data.amount} currency={d.currency} size="sm" />
                    <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium">
                      {a.action === 'bank_matched' ? t.viaBank : t.manual}
                    </span>
                  </p>
                )}
                {data.to && (
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{data.to}</p>
                )}
              </div>
            </li>
          )
        })}
        {open && d.dueDate && (
          <li className="relative flex gap-3">
            <span
              aria-hidden
              className="grid size-6 shrink-0 place-items-center rounded-full border border-dashed border-input text-muted-foreground"
            >
              <CircleDashed className="size-3.5" />
            </span>
            <div className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-3 pt-0.5">
              <span className="text-sm text-muted-foreground">{t.dueStep}</span>
              <span className="text-xs tabular-nums">
                <RelativeDate date={d.dueDate} tone="due" />
                <span className="text-muted-foreground"> · {formatDateCs(d.dueDate)}</span>
              </span>
            </div>
          </li>
        )}
      </ol>
    </section>
  )
}

// --------------------------------------------------------------------------------------------------------
// Related documents, public link
// --------------------------------------------------------------------------------------------------------

export function RelatedDocs({ d }: { d: DocumentDetail }) {
  if (!d.parent && d.related.length === 0) return null
  const row = (
    kind: string,
    doc: { id: string; number: string | null; status: string; type: string },
    lead?: string,
  ) => (
    <li
      key={`${kind}-${doc.id}`}
      className="row-hover relative -mx-2 flex items-center gap-3 rounded-lg px-2 py-2 text-sm"
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
        <FileText className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs text-muted-foreground">
          {lead ?? cs.invoices.type[doc.type as keyof typeof cs.invoices.type]}
          {doc.status === 'cancelled' && ` · ${cs.invoices.status.cancelled}`}
        </span>
        {/* The link is just the number (its accessible name); the stretched ::after makes the row clickable. */}
        <Link
          to="/faktury/$id"
          params={{ id: doc.id }}
          className="block font-medium tabular-nums outline-none after:absolute after:inset-0 after:rounded-lg focus-visible:after:ring-3 focus-visible:after:ring-ring/50"
        >
          {doc.number ?? cs.invoices.draftNumber}
        </Link>
      </span>
    </li>
  )
  return (
    <section className="sheet p-5" aria-label={t.relatedTitle}>
      <SectionLabel>{t.relatedTitle}</SectionLabel>
      <ul className="mt-3">
        {d.parent && row('parent', d.parent, t.relatedParent)}
        {d.related.map((r) => row('rel', r))}
      </ul>
    </section>
  )
}

export function PublicLinkCard({
  url,
  rotating,
  onRotate,
}: {
  url: string
  rotating: boolean
  onRotate: () => void
}) {
  return (
    <section className="sheet p-5" aria-label={t.publicLink}>
      <SectionLabel>{t.publicLink}</SectionLabel>
      <p className="mt-3 truncate rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground tabular-nums">
        {url.replace(/^https?:\/\//, '')}
      </p>
      <div className="mt-3 flex gap-2">
        <Button
          variant="outline"
          className="flex-1"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url)
              toast.success(t.linkCopied)
            } catch {
              /* clipboard blocked */
            }
          }}
        >
          <Copy /> {t.copyLink}
        </Button>
        <Button
          variant="outline"
          size="icon"
          nativeButton={false}
          render={<a href={url} target="_blank" rel="noreferrer" aria-label={t.openPublic} />}
        >
          <ExternalLink />
        </Button>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="mt-2 -ml-1.5 text-muted-foreground"
        disabled={rotating}
        onClick={onRotate}
      >
        <RefreshCw /> {t.rotateLink}
      </Button>
    </section>
  )
}

// --------------------------------------------------------------------------------------------------------
// The paper
// --------------------------------------------------------------------------------------------------------

/**
 * The real document (HTML twin of the PDF) lying on the desk. Below `lg` it is collapsed behind a toggle:
 * the hero and the QR are what a phone needs first.
 */
export function DocumentPaper({
  doc,
  qr,
  open,
  onToggle,
  className,
}: {
  doc: InvoiceSheetDraft
  qr: QrData | null | undefined
  open: boolean
  onToggle: () => void
  className?: string
}) {
  return (
    <div className={className}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls="doc-paper"
        className="sheet flex w-full items-center justify-between px-4 py-3 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50 lg:hidden"
      >
        <span className="flex items-center gap-2">
          <FileText className="size-4 text-muted-foreground" aria-hidden />
          {open ? t.hideDocument : t.showDocument}
        </span>
        <ChevronDown
          className={cn('size-4 text-muted-foreground transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </button>
      <div
        id="doc-paper"
        className={cn('mx-auto mt-3 max-w-[780px] lg:mt-0', !open && 'max-lg:hidden')}
      >
        <div className="overflow-hidden rounded-[3px] shadow-[var(--shadow-sheet)]">
          <InvoiceSheet doc={doc} {...(qr !== undefined ? { qr } : {})} maxScale={1.5} />
        </div>
      </div>
    </div>
  )
}
