import { Button } from '@fakturky/ui/components/button'
import { useMutation } from '@tanstack/react-query'
import { BellRing, Check, Download, X } from 'lucide-react'
import { toast } from 'sonner'
import { cs } from '@/i18n/cs'
import { downloadCsv } from '@/lib/csv'
import { client } from '@/lib/orpc'
import { type Doc, isPayable, useDocActions } from './invoice-rows'
import { crowns } from './summary-strip'

const t = cs.invoices.bulk

/**
 * Floating bar for a multi-selection: sum, export (client-side CSV of the selected rows),
 * mark paid and reminders. Mark paid is undoable from the toast.
 */
export function BulkBar({
  selected,
  sum,
  onClear,
}: {
  selected: Doc[]
  sum: string
  onClear: () => void
}) {
  const { refresh, markUnpaid } = useDocActions()
  const payable = selected.filter(isPayable)
  const overdue = selected.filter((d) => d.displayStatus === 'overdue')

  const pay = useMutation({
    mutationFn: async () => {
      const done: string[] = []
      for (const d of payable) {
        try {
          await client.documents.markPaid({ id: d.id })
          done.push(d.id)
        } catch {
          // keep going: report what worked
        }
      }
      return done
    },
    onSuccess: (done) => {
      refresh()
      onClear()
      toast.success(t.paidDone(done.length), {
        action: {
          label: cs.invoices.rowActions.undo,
          onClick: () => {
            for (const id of done) markUnpaid.mutate({ id })
          },
        },
      })
    },
  })

  const remind = useMutation({
    mutationFn: async () => {
      let ok = 0
      let failed = 0
      for (const d of overdue) {
        try {
          await client.documents.send({ id: d.id, reminder: true })
          ok++
        } catch {
          failed++
        }
      }
      return { ok, failed }
    },
    onSuccess: ({ ok, failed }) => {
      refresh()
      onClear()
      if (failed === 0) toast.success(t.remindDone(ok, failed))
      else toast.error(t.remindDone(ok, failed))
    },
  })

  return (
    <div
      role="toolbar"
      aria-label={t.selected(selected.length)}
      className="shadow-floating fixed bottom-6 left-1/2 z-40 hidden -translate-x-1/2 items-center gap-1 rounded-xl bg-popover p-1.5 pl-4 md:flex motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2"
    >
      <span className="pr-3 text-sm font-medium tabular-nums">
        {t.selected(selected.length)}
        <span className="ml-2 font-normal text-muted-foreground">{crowns(sum)}</span>
      </span>
      <Button variant="ghost" size="sm" onClick={() => downloadCsv(selected)}>
        <Download /> {t.exportCsv}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        disabled={payable.length === 0 || pay.isPending}
        onClick={() => pay.mutate()}
      >
        <Check /> {t.markPaid}
        {payable.length > 0 && <span className="tabular-nums">({payable.length})</span>}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        disabled={overdue.length === 0 || remind.isPending}
        onClick={() => remind.mutate()}
      >
        <BellRing /> {t.remind}
        {overdue.length > 0 && <span className="tabular-nums">({overdue.length})</span>}
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label={t.clear} onClick={onClear}>
        <X />
      </Button>
    </div>
  )
}
