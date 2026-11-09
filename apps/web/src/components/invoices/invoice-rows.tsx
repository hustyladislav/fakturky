import type { RouterOutputs } from '@fakturky/core/router'
import { formatDateCs } from '@fakturky/domain/dates'
import { Amount } from '@fakturky/ui/components/amount'
import { Button } from '@fakturky/ui/components/button'
import { RelativeDate } from '@fakturky/ui/components/relative-date'
import { Tooltip, TooltipContent, TooltipTrigger } from '@fakturky/ui/components/tooltip'
import { diffDays, parseIsoDate, startOfDay } from '@fakturky/ui/lib/dates'
import { cn } from '@fakturky/ui/lib/utils'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { Check, CopyPlus, FileDown } from 'lucide-react'
import type { MouseEvent } from 'react'
import { toast } from 'sonner'
import { InvoiceStatus } from '@/components/invoice-status'
import { cs } from '@/i18n/cs'
import { refreshDocumentData } from '@/lib/document-cache'
import { apiErrorMessage } from '@/lib/errors'
import { orpc } from '@/lib/orpc'
import { undoPaidInput } from './undo-paid'

export type Doc = RouterOutputs['documents']['list'][number]

const t = cs.invoices

export const isPayable = (d: Doc) =>
  d.type !== 'credit_note' && ['issued', 'overdue', 'partially_paid'].includes(d.displayStatus)

export const docPath = (d: Doc) => (d.status === 'draft' ? '/faktury/$id/upravit' : '/faktury/$id')

export function overdueDays(d: Doc): number | undefined {
  if (d.displayStatus !== 'overdue') return undefined
  const due = parseIsoDate(d.dueDate)
  return due ? diffDays(startOfDay(new Date()), due) : undefined
}

/** "3. 11." from an ISO day. */
const shortDay = (iso: string) => `${Number(iso.slice(8, 10))}. ${Number(iso.slice(5, 7))}.`

function DueCell({ d }: { d: Doc }) {
  if (d.displayStatus === 'paid' && d.paidOn) {
    return <span className="text-muted-foreground">{t.paidOn(shortDay(d.paidOn))}</span>
  }
  if (!d.dueDate || d.displayStatus === 'cancelled') {
    return <span className="text-muted-foreground">—</span>
  }
  const open = d.displayStatus === 'overdue' || d.displayStatus === 'issued'
  return (
    <RelativeDate
      date={d.dueDate}
      tone={open || d.displayStatus === 'partially_paid' ? 'due' : 'default'}
      className={cn(!open && d.displayStatus !== 'partially_paid' && 'text-muted-foreground')}
    />
  )
}

export function useDocActions() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const refresh = () => refreshDocumentData(qc)
  const markUnpaid = useMutation(
    orpc.documents.markUnpaid.mutationOptions({
      onSuccess: refresh,
      onError: (e) => toast.error(apiErrorMessage(e)),
    }),
  )
  const undoPaid = (paid: Parameters<typeof undoPaidInput>[0]) => {
    const input = undoPaidInput(paid)
    if (input) markUnpaid.mutate(input)
  }
  const markPaid = useMutation(
    orpc.documents.markPaid.mutationOptions({
      onSuccess: (d) => {
        refresh()
        toast.success(t.rowActions.markedPaid, {
          action: { label: t.rowActions.undo, onClick: () => undoPaid(d) },
        })
      },
      onError: (e) => toast.error(apiErrorMessage(e)),
    }),
  )
  const duplicate = useMutation(
    orpc.documents.duplicate.mutationOptions({
      onSuccess: (d) => {
        refresh()
        navigate({ to: '/faktury/$id/upravit', params: { id: d.id } })
      },
      onError: (e) => toast.error(apiErrorMessage(e)),
    }),
  )
  return { markPaid, undoPaid, duplicate, refresh }
}

function ActionButton({
  label,
  children,
  ...props
}: { label: string } & React.ComponentProps<typeof Button>) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label={label} {...props}>
            {children}
          </Button>
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

/** Hover/focus quick actions: PDF, mark paid, duplicate. */
export function RowActions({ d }: { d: Doc }) {
  const { markPaid, duplicate } = useDocActions()
  const stop = (e: MouseEvent) => e.stopPropagation()
  return (
    <div className="row-actions flex items-center justify-end gap-0.5" onClick={stop}>
      {d.status !== 'draft' && (
        <ActionButton
          label={t.rowActions.pdf}
          nativeButton={false}
          render={<a href={`/api/documents/${d.id}/pdf`} download />}
        >
          <FileDown />
        </ActionButton>
      )}
      {isPayable(d) && (
        <ActionButton
          label={t.rowActions.markPaid}
          disabled={markPaid.isPending}
          onClick={() => markPaid.mutate({ id: d.id })}
        >
          <Check />
        </ActionButton>
      )}
      <ActionButton
        label={t.rowActions.duplicate}
        disabled={duplicate.isPending}
        onClick={() => duplicate.mutate({ id: d.id })}
      >
        <CopyPlus />
      </ActionButton>
    </div>
  )
}

function isInteractive(target: EventTarget | null) {
  return target instanceof Element && !!target.closest('a,button,input,label,[role=checkbox]')
}

const typeShort = (d: Doc) =>
  d.type === 'invoice' ? null : (t.typeShort[d.type as keyof typeof t.typeShort] ?? d.type)

const CELL = 'border-b border-border/70'

/** Desktop table row: select, name, number, dates, amount, status; quick actions on hover/focus. */
export function InvoiceRow({
  d,
  selected,
  active,
  onToggle,
}: {
  d: Doc
  selected: boolean
  active: boolean
  onToggle: () => void
}) {
  const navigate = useNavigate()
  const name = d.customerName ?? '—'
  const type = typeShort(d)
  return (
    <tr
      data-doc-id={d.id}
      data-active={active || undefined}
      aria-selected={selected}
      onClick={(e) => {
        if (!isInteractive(e.target)) navigate({ to: docPath(d), params: { id: d.id } })
      }}
      className={cn(
        'row-hover cursor-pointer',
        selected && 'bg-primary/[0.05]',
        active && 'bg-primary/[0.06] [&>td:first-child]:shadow-[inset_2px_0_0_var(--primary)]',
      )}
    >
      <td className={cn(CELL, 'w-9 pl-1')}>
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          aria-label={t.bulk.selectRow(name)}
          className="size-4 cursor-pointer align-middle"
        />
      </td>
      <td className={cn(CELL, 'max-w-0 py-3 pr-4')}>
        <Link
          to={docPath(d)}
          params={{ id: d.id }}
          className="block truncate text-sm font-medium outline-none focus-visible:underline"
        >
          {name}
        </Link>
      </td>
      <td className={cn(CELL, 'pr-4 text-sm whitespace-nowrap text-muted-foreground tabular-nums')}>
        {d.number ? (
          <Link to={docPath(d)} params={{ id: d.id }} tabIndex={-1}>
            {d.number}
          </Link>
        ) : (
          <span className="italic">{t.noNumber}</span>
        )}
        {type && <span className="ml-2 text-xs">{type}</span>}
      </td>
      <td className={cn(CELL, 'pr-4 text-sm whitespace-nowrap text-muted-foreground tabular-nums')}>
        {d.issueDate ? formatDateCs(d.issueDate) : '—'}
      </td>
      <td className={cn(CELL, 'pr-4 text-sm whitespace-nowrap')}>
        <DueCell d={d} />
      </td>
      <td className={cn(CELL, 'pr-4 text-right whitespace-nowrap')}>
        <Amount value={d.total} currency={d.currency} size="inline" />
      </td>
      <td className={cn(CELL, 'pr-2')}>
        <InvoiceStatus status={d.displayStatus} viaAssistant={d.viaAssistant} />
      </td>
      <td className={cn(CELL, 'w-28 pr-1')}>
        <RowActions d={d} />
      </td>
    </tr>
  )
}

/** Phone row (56 px+, one link): name and amount, then number, due state and status. */
export function InvoiceCompactRow({ d }: { d: Doc }) {
  const name = d.customerName ?? '—'
  // Overdue and paid statuses already say it; the date only adds value for open documents.
  const showDue = ['draft', 'issued', 'partially_paid'].includes(d.displayStatus) && !!d.dueDate
  const type = typeShort(d)
  return (
    <li>
      <Link
        to={docPath(d)}
        params={{ id: d.id }}
        className="flex min-h-14 flex-col justify-center gap-0.5 border-b border-border/70 py-1.5 outline-none active:bg-accent focus-visible:bg-accent"
      >
        <span className="flex items-baseline justify-between gap-3">
          <span className="truncate text-[15px] leading-5 font-medium">{name}</span>
          <Amount value={d.total} currency={d.currency} size="inline" className="shrink-0" />
        </span>
        <span className="flex items-baseline justify-between gap-3 text-[13px] leading-[18px] text-muted-foreground">
          <span className="min-w-0 truncate tabular-nums">
            {d.number ?? t.noNumber}
            {type && ` · ${type}`}
            {showDue && (
              <>
                {' · '}
                <DueCell d={d} />
              </>
            )}
          </span>
          <InvoiceStatus
            status={d.displayStatus}
            viaAssistant={d.viaAssistant}
            overdueDays={overdueDays(d)}
          />
        </span>
      </Link>
    </li>
  )
}
