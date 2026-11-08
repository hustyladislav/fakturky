import { todayPrague } from '@fakturky/domain/dates'
import { Button } from '@fakturky/ui/components/button'
import { DatePicker } from '@fakturky/ui/components/date-picker'
import { Input } from '@fakturky/ui/components/input'
import { Label } from '@fakturky/ui/components/label'
import { useEffect, useRef, useState } from 'react'
import type { InvoiceController } from '@/components/invoice-detail/use-invoice-controller'
import { cs } from '@/i18n/cs'
import type { DocumentDetail } from '@/lib/document-sheet'

const t = cs.invoices.detail

/** Inline form that scrolls into view when it opens (it can render below the fold on phones). */
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [])
  return (
    <section ref={ref} className="hairline mt-5 space-y-3 pt-5">
      <h2 className="label-caps">{title}</h2>
      {children}
    </section>
  )
}

export function SendPanel({ d, ctrl }: { d: DocumentDetail; ctrl: InvoiceController }) {
  const [to, setTo] = useState('')
  const [message, setMessage] = useState('')
  const defaultTo = ((d.customerSnapshot?.emails as string[] | undefined) ?? [])[0]
  return (
    <Panel title={t.sendTitle}>
      <div className="space-y-2">
        <Label htmlFor="mailTo">{t.sendTo}</Label>
        <Input
          id="mailTo"
          type="email"
          value={to}
          placeholder={defaultTo ?? ''}
          onChange={(e) => setTo(e.target.value)}
        />
        {!defaultTo && <p className="text-muted-foreground text-xs">{t.sendNoEmail}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="mailMsg">{t.sendMessage}</Label>
        <textarea
          id="mailMsg"
          rows={3}
          className="border-input bg-background w-full rounded-md border p-2 text-sm"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </div>
      <div className="flex gap-2">
        <Button
          disabled={ctrl.send.isPending || !(to || defaultTo)}
          onClick={() =>
            ctrl.send.mutate({
              id: ctrl.id,
              to: to || undefined,
              message: message || undefined,
              reminder: d.displayStatus === 'overdue',
            })
          }
        >
          {t.sendConfirm}
        </Button>
        <Button variant="ghost" onClick={() => ctrl.setPanel(null)}>
          {cs.common.cancel}
        </Button>
      </div>
    </Panel>
  )
}

export function PayPanel({ d, ctrl }: { d: DocumentDetail; ctrl: InvoiceController }) {
  const [amount, setAmount] = useState('')
  const [paidOn, setPaidOn] = useState(() => todayPrague())
  return (
    <Panel title={t.hero.receipt}>
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
          disabled={ctrl.markPaid.isPending}
          onClick={() =>
            ctrl.markPaid.mutate({
              id: ctrl.id,
              amount: amount ? amount.replace(',', '.') : null,
              paidOn: paidOn || undefined,
            })
          }
        >
          {t.markPaidConfirm}
        </Button>
        <Button variant="ghost" onClick={() => ctrl.setPanel(null)}>
          {cs.common.cancel}
        </Button>
      </div>
    </Panel>
  )
}
